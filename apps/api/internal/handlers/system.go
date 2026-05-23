package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/middleware"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// =====================================================================
//   System config — ops surface for the maintenance toggle.
//
//     GET  /api/system/status         — PUBLIC. The FE polls this from
//                                        landing + the maintenance screen
//                                        itself to detect when the gate
//                                        flips back off.
//     GET  /api/admin/maintenance     — admin-only. Full row including
//                                        audit fields (who set it, when).
//     POST /api/admin/maintenance     — admin-only. Upsert the row, then
//                                        invalidate the middleware cache.
//
//   The middleware whitelists /api/system/status and /api/admin/maintenance
//   so admins can keep operating the toggle even when the gate is on.
// =====================================================================

// allowedReasonPresets — keep this in lockstep with the FE preset list.
// Empty string means "no preset chosen" (custom message only).
var allowedReasonPresets = map[string]bool{
	"":           true,
	"scheduled":  true,
	"deploy":     true,
	"migration":  true,
	"incident":   true,
}

// systemStatusResponse is the PUBLIC shape returned by GET /api/system/status.
// Deliberately narrower than MaintenanceConfig — no `updated_by_*` fields
// leak to anonymous callers.
type systemStatusResponse struct {
	Maintenance  bool       `json:"maintenance"`
	ReasonPreset string     `json:"reason_preset,omitempty"`
	ETA          *time.Time `json:"eta,omitempty"`
	MessageRU    string     `json:"message_ru,omitempty"`
	MessageEN    string     `json:"message_en,omitempty"`
}

// SystemStatus is the public health endpoint. Always returns 200 with
// the current maintenance state; the FE switches to the maintenance
// screen when `maintenance:true`.
func (d *Deps) SystemStatus(c *gin.Context) {
	if d.Repo == nil {
		c.JSON(http.StatusOK, systemStatusResponse{Maintenance: false})
		return
	}
	cfg, err := d.Repo.GetMaintenance()
	if err != nil {
		// Soft-fail: rather than 500ing the status endpoint (which would
		// itself look like maintenance), return "not in maintenance".
		c.JSON(http.StatusOK, systemStatusResponse{Maintenance: false})
		return
	}
	c.JSON(http.StatusOK, systemStatusResponse{
		Maintenance:  cfg.Enabled,
		ReasonPreset: cfg.ReasonPreset,
		ETA:          cfg.ETA,
		MessageRU:    cfg.MessageRU,
		MessageEN:    cfg.MessageEN,
	})
}

// GetMaintenance returns the full config row (admin only).
func (d *Deps) GetMaintenance(c *gin.Context) {
	cfg, err := d.Repo.GetMaintenance()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

// setMaintenanceReq is the admin-side wire shape. We use pointer fields
// so an admin can flip `enabled` alone without resetting message/eta.
type setMaintenanceReq struct {
	Enabled      *bool   `json:"enabled,omitempty"`
	ReasonPreset *string `json:"reason_preset,omitempty"`
	ETA          *string `json:"eta,omitempty"`         // RFC3339 or "" to clear
	MessageRU    *string `json:"message_ru,omitempty"`
	MessageEN    *string `json:"message_en,omitempty"`
}

// SetMaintenance upserts the maintenance config. Validates the reason
// preset against an explicit allowlist and the ETA against RFC3339.
// On success, invalidates the middleware cache so the new state is
// visible to subsequent requests immediately on this instance.
func (d *Deps) SetMaintenance(c *gin.Context) {
	var req setMaintenanceReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	current, err := d.Repo.GetMaintenance()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	next := *current // shallow-copy the starting state
	if req.Enabled != nil {
		next.Enabled = *req.Enabled
	}
	if req.ReasonPreset != nil {
		p := strings.ToLower(strings.TrimSpace(*req.ReasonPreset))
		if !allowedReasonPresets[p] {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "unknown reason_preset",
				"code":  "invalid_preset",
			})
			return
		}
		next.ReasonPreset = p
	}
	if req.MessageRU != nil {
		next.MessageRU = strings.TrimSpace(*req.MessageRU)
	}
	if req.MessageEN != nil {
		next.MessageEN = strings.TrimSpace(*req.MessageEN)
	}
	if req.ETA != nil {
		raw := strings.TrimSpace(*req.ETA)
		if raw == "" {
			next.ETA = nil
		} else {
			t, err := time.Parse(time.RFC3339, raw)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "eta must be RFC3339 timestamp or empty string",
					"code":  "invalid_eta",
				})
				return
			}
			t = t.UTC()
			next.ETA = &t
		}
	}

	updatedBy := callerID(c)
	saved, err := d.Repo.SetMaintenance(&next, updatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	middleware.SharedMaintenanceCache.Invalidate()
	c.JSON(http.StatusOK, saved)
}

// _ keeps the models import alive for IDEs that strip unused refs.
var _ = models.MaintenanceConfig{}
