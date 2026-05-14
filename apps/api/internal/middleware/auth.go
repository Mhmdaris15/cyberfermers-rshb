package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/auth"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// Context keys used by handlers to read the authenticated user / session.
const (
	CtxKeyUser      = "auth.user"      // *models.UserPublic — set by RequireAuth
	CtxKeyUserID    = "auth.user_id"   // string (bare record id) — convenience
	CtxKeyRole      = "auth.role"      // string — convenience
	CtxKeySessionID = "auth.session"   // string — bare session record id
)

// RequireAuth validates the Bearer token and loads the user into the gin
// context. On failure it short-circuits with a 401 JSON body and a stable
// machine-readable `code` field so the FE can react predictably.
//
// The handler is intentionally NOT a closure-per-route — it's constructed
// once with the repo dependency and reused across the whole route group.
func RequireAuth(repo *db.Repo) gin.HandlerFunc {
	tt := newTouchTracker()

	return func(c *gin.Context) {
		raw := bearerFromHeader(c.GetHeader("Authorization"))
		if raw == "" {
			abortUnauthorized(c, "missing_authorization", "Missing or malformed Authorization header")
			return
		}

		hash := auth.HashToken(raw)
		sess, user, err := repo.FindSessionByTokenHash(hash)
		if err != nil {
			if err == db.ErrSessionNotFound {
				abortUnauthorized(c, "invalid_token", "Token is unknown, expired, or revoked")
				return
			}
			log.Error().Err(err).Msg("auth: session lookup failed")
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "internal server error",
				"code":  "auth_lookup_failed",
			})
			return
		}

		// Belt-and-braces — the repo query already filtered these, but a
		// future refactor could change that. Re-check critical invariants.
		if sess.Revoked {
			abortUnauthorized(c, "session_revoked", "Session has been revoked")
			return
		}
		if user.Disabled {
			abortUnauthorized(c, "account_disabled", "Account is disabled")
			return
		}

		// Load user + session into gin context for downstream handlers.
		pub := user.Public()
		c.Set(CtxKeyUser, &pub)
		c.Set(CtxKeyUserID, user.ID)
		c.Set(CtxKeyRole, user.Role)
		c.Set(CtxKeySessionID, sess.ID)

		// Debounced last_used_at bump. Skips DB writes on chatty endpoints.
		if tt.shouldTouch(sess.ID) {
			go func(id string) {
				if err := repo.TouchSession(id); err != nil {
					log.Warn().Err(err).Str("session_id", id).Msg("auth: touch failed")
				}
			}(sess.ID)
		}

		c.Next()
	}
}

// RequireAdmin chains AFTER RequireAuth. Returns 403 if role != "admin".
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get(CtxKeyRole)
		if r, ok := role.(string); !ok || r != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "forbidden",
				"code":  "admin_required",
			})
			return
		}
		c.Next()
	}
}

// UserFromContext extracts the authenticated user. Returns nil if missing
// (handlers should not be reachable without auth, but defense in depth).
func UserFromContext(c *gin.Context) *models.UserPublic {
	v, ok := c.Get(CtxKeyUser)
	if !ok {
		return nil
	}
	u, _ := v.(*models.UserPublic)
	return u
}

// SessionIDFromContext returns the bare session record id, e.g. for logout.
func SessionIDFromContext(c *gin.Context) string {
	v, _ := c.Get(CtxKeySessionID)
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// ─── helpers ───────────────────────────────────────────────────────────────

func bearerFromHeader(h string) string {
	if h == "" {
		return ""
	}
	const prefix = "Bearer "
	if !strings.HasPrefix(h, prefix) {
		return ""
	}
	return strings.TrimSpace(h[len(prefix):])
}

func abortUnauthorized(c *gin.Context, code, message string) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
		"error": message,
		"code":  code,
	})
}

// touchTracker debounces last_used_at updates so we don't write on every
// request. Stores per-session "last touched" timestamps in memory and only
// triggers a DB write when 60+ seconds have passed since the last one.
//
// Memory cost: ~80 bytes per active session. Cleared opportunistically
// when expired sessions are read.
type touchTracker struct {
	mu sync.Mutex
	m  map[string]time.Time
}

func newTouchTracker() *touchTracker {
	return &touchTracker{m: make(map[string]time.Time)}
}

func (t *touchTracker) shouldTouch(sessionID string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	now := time.Now()
	last, ok := t.m[sessionID]
	if !ok || now.Sub(last) > 60*time.Second {
		t.m[sessionID] = now
		return true
	}
	return false
}
