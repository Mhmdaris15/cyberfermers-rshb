package handlers

import (
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/auth"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/middleware"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   /api/auth/login    (public)
//   /api/auth/logout   (authed)
//   /api/auth/me       (authed)
// ============================================================

// Login validates credentials, issues a fresh session token. The raw token
// is returned to the client EXACTLY ONCE here — it is never queryable from
// the DB later, only its SHA-256 hash is stored.
func (d *Deps) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}

	username := strings.ToLower(strings.TrimSpace(req.Username))

	// ── Rate limit by username ────────────────────────────────────────
	// Sliding window in-process counter. Per-username (not per-IP) because
	// judges may sit behind the same NAT and a per-IP limit would lock
	// them out collectively. Acceptable for hackathon-grade — production
	// would back this with Redis for multi-replica deployments.
	if d.loginLimiter == nil {
		d.loginLimiter = newLoginRateLimiter(
			max(d.LoginRateLimit, 5),
			time.Duration(max(d.LoginRateWindowMin, 15))*time.Minute,
		)
	}
	if d.loginLimiter.blocked(username) {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "Too many failed login attempts. Try again later.",
			"code":  "rate_limited",
		})
		return
	}

	user, err := d.Repo.FindUserByUsername(username)
	// "Not found" is a normal auth branch, not an exceptional condition.
	// We treat three things as the same case:
	//   1. Repo signalled ErrUserNotFound explicitly
	//   2. Repo returned (nil, nil) — shouldn't happen but defense in depth
	//   3. Repo returned a row with no id (e.g. a partial-schema state)
	// All three map to 401 invalid_credentials. The dummy bcrypt verify
	// burns the same wall-clock as a real one would so username
	// enumeration via response-time analysis still doesn't leak signal.
	notFound := errors.Is(err, db.ErrUserNotFound) || (err == nil && (user == nil || user.ID == ""))
	if notFound {
		auth.DummyVerify(req.Password)
		d.loginLimiter.recordFailure(username)
		loginError(c, http.StatusUnauthorized, "invalid_credentials", "Invalid username or password")
		return
	}
	if err != nil {
		log.Error().Err(err).Msg("login: user lookup failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "internal server error",
			"code":  "lookup_failed",
		})
		return
	}

	if user.Disabled {
		// Disabled is intentionally distinguishable from invalid_credentials
		// so the FE can show "Account disabled — contact admin" rather than
		// suggesting a password retry that will never work.
		loginError(c, http.StatusForbidden, "account_disabled", "Account is disabled")
		return
	}

	if err := auth.VerifyPassword(user.PasswordHash, req.Password); err != nil {
		d.loginLimiter.recordFailure(username)
		loginError(c, http.StatusUnauthorized, "invalid_credentials", "Invalid username or password")
		return
	}

	// ── Success path — issue token ────────────────────────────────────
	d.loginLimiter.recordSuccess(username)

	raw, hash, err := auth.NewToken()
	if err != nil {
		log.Error().Err(err).Msg("login: token generation failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "internal server error",
			"code":  "token_failed",
		})
		return
	}
	ttl := d.SessionTTL
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour // safety default
	}
	expiresAt := time.Now().Add(ttl).UTC()

	ip := ipFromRequest(c)
	ua := strings.TrimSpace(c.GetHeader("User-Agent"))
	var ipPtr, uaPtr *string
	if ip != "" {
		ipPtr = &ip
	}
	if ua != "" {
		uaPtr = &ua
	}

	// One more defensive check before session creation — empty user.ID
	// would 500 in the repo with a confusing "missing record id" error.
	// We treated the empty-id case as "not found" above, so reaching
	// here with an empty id is a real bug — log loudly and fail closed.
	if user.ID == "" {
		log.Error().Str("username", username).Msg("login: user.ID empty after non-error lookup — bug")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "internal server error",
			"code":  "invalid_user_state",
		})
		return
	}

	if _, err := d.Repo.CreateSession(user.ID, hash, expiresAt, ipPtr, uaPtr); err != nil {
		log.Error().Err(err).Msg("login: session create failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "internal server error",
			"code":  "session_failed",
		})
		return
	}

	log.Info().
		Str("username", username).
		Str("user_id", user.ID).
		Str("ip", ip).
		Msg("login success")

	c.JSON(http.StatusOK, models.LoginResponse{
		Token:     raw,
		ExpiresAt: expiresAt,
		User:      user.Public(),
	})
}

// Logout revokes the session belonging to the Bearer token in use. The FE
// should also drop the token from localStorage on success; the response is
// 204 with no body either way.
func (d *Deps) Logout(c *gin.Context) {
	sessionID := middleware.SessionIDFromContext(c)
	if sessionID == "" {
		c.Status(http.StatusNoContent)
		return
	}
	if err := d.Repo.RevokeSession(sessionID); err != nil {
		log.Warn().Err(err).Str("session_id", sessionID).Msg("logout: revoke failed")
	}
	c.Status(http.StatusNoContent)
}

// Me returns the current user + minimal session info. The FE uses this to
// hydrate auth state on page load (avoids decoding localStorage on its own).
func (d *Deps) Me(c *gin.Context) {
	user := middleware.UserFromContext(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "no_session"})
		return
	}
	sessionID := middleware.SessionIDFromContext(c)

	resp := models.MeResponse{User: *user}

	// Best-effort lookup of session detail. Failure is non-fatal — the
	// caller still gets a valid user object.
	if sessionID != "" {
		// We don't have a dedicated FindSessionByID; ListActiveSessions is
		// cheap enough and contains everything we need.
		sessions, err := d.Repo.ListActiveSessions(user.ID)
		if err == nil {
			for _, s := range sessions {
				if s.ID == sessionID {
					resp.Session.ExpiresAt = s.ExpiresAt
					resp.Session.LastUsedAt = s.LastUsedAt
					break
				}
			}
		}
	}

	c.JSON(http.StatusOK, resp)
}

// ─── helpers ───────────────────────────────────────────────────────────────

func loginError(c *gin.Context, status int, code, msg string) {
	c.JSON(status, gin.H{"error": msg, "code": code})
}

func ipFromRequest(c *gin.Context) string {
	// Prefer the gin-resolved ClientIP (honors X-Forwarded-For / X-Real-IP
	// when behind nginx). Falls back to the raw remote addr.
	ip := c.ClientIP()
	if ip == "" {
		ip = c.Request.RemoteAddr
	}
	// Strip a trailing port if RemoteAddr came back like "1.2.3.4:54321".
	if i := strings.LastIndex(ip, ":"); i > 0 && strings.Count(ip, ":") == 1 {
		ip = ip[:i]
	}
	return ip
}

// ============================================================
//   login rate limiter — per-username sliding window
// ============================================================

type loginRateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	// failures keyed by lowercased username → recent failure timestamps.
	// Bounded growth: pruned every time a username is checked.
	failures map[string][]time.Time
}

func newLoginRateLimiter(limit int, window time.Duration) *loginRateLimiter {
	return &loginRateLimiter{
		limit:    limit,
		window:   window,
		failures: make(map[string][]time.Time),
	}
}

func (l *loginRateLimiter) blocked(username string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.prune(username)
	return len(l.failures[username]) >= l.limit
}

func (l *loginRateLimiter) recordFailure(username string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.prune(username)
	l.failures[username] = append(l.failures[username], time.Now())
}

func (l *loginRateLimiter) recordSuccess(username string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.failures, username)
}

// prune drops failure timestamps older than the sliding window. Called
// under lock; callers do not need to re-lock.
func (l *loginRateLimiter) prune(username string) {
	cutoff := time.Now().Add(-l.window)
	in := l.failures[username]
	out := in[:0]
	for _, t := range in {
		if t.After(cutoff) {
			out = append(out, t)
		}
	}
	if len(out) == 0 {
		delete(l.failures, username)
	} else {
		l.failures[username] = out
	}
}

// max is in builtin from Go 1.21; defined here to keep the file
// self-contained for older toolchains. Safe to remove on 1.21+.
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
