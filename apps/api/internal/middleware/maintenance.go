package middleware

import (
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// Maintenance gates every request behind a configurable kill-switch. When
// enabled, non-whitelisted paths receive 503 with a structured JSON body
// the FE uses to render the maintenance screen instead of routing.
//
// Whitelist (always pass through):
//   - GET  /health           — Docker/Coolify healthcheck
//   - GET  /api/system/status — public flag for FE polling
//   - POST /api/auth/login    — admin needs to log in to flip it back
//   - GET  /api/auth/me       — keeps an existing admin session viable
//   - POST /api/auth/logout   — let stuck users sign out
//   - admin sub-tree `/api/admin/maintenance` — admin disable surface
//
// The DB row is cached for ~5 seconds so we don't hammer SurrealDB on
// every request. That's short enough that flipping the toggle propagates
// to all instances within a heartbeat; long enough that a request burst
// costs ~one DB read per server.
//
// Env override `MAINTENANCE_FORCE=on` forces the gate ON regardless of
// the DB row — useful if SurrealDB itself is the thing being worked on
// and the DB-backed flag can't be read.

const maintenanceCacheTTL = 5 * time.Second

// alwaysAllowed paths bypass the gate even when maintenance is on. Keep
// this list intentionally small — every entry is an attack-surface during
// a real incident.
var alwaysAllowedExact = map[string]struct{}{
	"/health":              {},
	"/api/system/status":   {},
	"/api/auth/login":      {},
	"/api/auth/me":         {},
	"/api/auth/logout":     {},
}

// alwaysAllowedPrefix — anything under these prefixes is admin recovery.
// RequireAuth + RequireAdmin still apply inside the handler.
var alwaysAllowedPrefix = []string{
	"/api/admin/maintenance",
}

type maintenanceCache struct {
	mu        sync.Mutex
	cfg       atomic.Pointer[models.MaintenanceConfig]
	expiresAt atomic.Int64 // unix nanos
}

func (mc *maintenanceCache) get(repo *db.Repo) *models.MaintenanceConfig {
	if cached := mc.cfg.Load(); cached != nil && time.Now().UnixNano() < mc.expiresAt.Load() {
		return cached
	}
	mc.mu.Lock()
	defer mc.mu.Unlock()
	// double-check after lock; another goroutine may have refreshed it
	if cached := mc.cfg.Load(); cached != nil && time.Now().UnixNano() < mc.expiresAt.Load() {
		return cached
	}
	cfg, err := repo.GetMaintenance()
	if err != nil {
		log.Warn().Err(err).Msg("maintenance: DB read failed, treating as disabled")
		cfg = &models.MaintenanceConfig{Enabled: false}
	}
	mc.cfg.Store(cfg)
	mc.expiresAt.Store(time.Now().Add(maintenanceCacheTTL).UnixNano())
	return cfg
}

// Invalidate forces the next call to get() to refetch from DB. Called by
// the system handler after a successful SetMaintenance so the new state
// propagates immediately on the instance that handled the write.
func (mc *maintenanceCache) Invalidate() {
	mc.expiresAt.Store(0)
}

// SharedMaintenanceCache is the single cache instance used by the
// middleware and read-after-write by the handler. Exposing a package
// level cache instead of a per-construction one keeps wiring simple
// in main.go — the middleware constructor and the handler both grab it.
var SharedMaintenanceCache = &maintenanceCache{}

// Maintenance returns the gin middleware. `nil` repo (tests) → no-op.
func Maintenance(repo *db.Repo) gin.HandlerFunc {
	if repo == nil {
		return func(c *gin.Context) { c.Next() }
	}
	envForced := isEnvForceOn()

	return func(c *gin.Context) {
		// Always allow CORS preflight — without this, browsers see the 503
		// on OPTIONS and never even attempt the real request.
		if c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		path := c.Request.URL.Path
		if isAllowed(path) {
			c.Next()
			return
		}

		cfg := SharedMaintenanceCache.get(repo)
		if !cfg.Enabled && !envForced {
			c.Next()
			return
		}

		// Build the public payload. We deliberately surface only what the
		// FE needs to render the screen — no audit fields like updated_by.
		payload := gin.H{
			"maintenance":   true,
			"reason_preset": cfg.ReasonPreset,
			"message_ru":    cfg.MessageRU,
			"message_en":    cfg.MessageEN,
		}
		if cfg.ETA != nil {
			payload["eta"] = cfg.ETA.UTC().Format(time.RFC3339)
		}
		if envForced {
			payload["forced"] = true
		}
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, payload)
	}
}

func isAllowed(path string) bool {
	if _, ok := alwaysAllowedExact[path]; ok {
		return true
	}
	for _, p := range alwaysAllowedPrefix {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

func isEnvForceOn() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("MAINTENANCE_FORCE"))) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}
