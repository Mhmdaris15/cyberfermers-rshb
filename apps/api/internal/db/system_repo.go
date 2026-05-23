package db

import (
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// system_config holds ops-level toggles. Every row is point-fetched by a
// fixed id. The maintenance flag lives at `system_config:maintenance`.
//
// The maintenance middleware calls GetMaintenance() on the hot path of
// every non-whitelisted request, so this method MUST be cheap — a single
// indexed point-fetch with no joins.

const maintenanceConfigID = "maintenance"

// GetMaintenance returns the current maintenance config. A missing row
// is treated as "feature disabled" — we return a zero-value config with
// Enabled=false rather than an error so the middleware can always make
// a decision without short-circuiting.
func (r *Repo) GetMaintenance() (*models.MaintenanceConfig, error) {
	res, err := r.c.Query(
		`SELECT
		   enabled,
		   reason_preset,
		   eta,
		   message_ru,
		   message_en,
		   updated_at,
		   IF updated_by = NONE THEN NONE ELSE meta::id(updated_by) END AS updated_by_id,
		   IF updated_by = NONE THEN NONE ELSE updated_by.username END AS updated_by_name
		 FROM type::thing("system_config", $id);`,
		map[string]any{"id": maintenanceConfigID},
	)
	if err != nil {
		return nil, err
	}
	var rows []models.MaintenanceConfig
	_ = decodeQueryRows(res, &rows)
	if len(rows) == 0 {
		return &models.MaintenanceConfig{Enabled: false}, nil
	}
	return &rows[0], nil
}

// SetMaintenance upserts the maintenance row. We CONTENT-write the full
// shape so callers don't have to think about MERGE semantics — the wire
// API is "send the full desired state, get the new state back."
//
// updatedByUserID is the bare record id of the admin performing the
// change (empty string allowed for system-initiated writes, but the
// handler always supplies one).
func (r *Repo) SetMaintenance(cfg *models.MaintenanceConfig, updatedByUserID string) (*models.MaintenanceConfig, error) {
	var etaVal any
	if cfg.ETA != nil {
		etaVal = cfg.ETA.UTC().Format(time.RFC3339)
	}
	var byVal any
	if updatedByUserID != "" {
		byVal = updatedByUserID
	}
	q := `
	  UPDATE type::thing("system_config", $id) CONTENT {
	    enabled:       $enabled,
	    reason_preset: $preset,
	    eta:           IF $eta = NONE THEN NONE ELSE <datetime>$eta END,
	    message_ru:    $mru,
	    message_en:    $men,
	    updated_at:    time::now(),
	    updated_by:    IF $by = NONE THEN NONE ELSE type::thing("app_user", $by) END
	  };`
	_, err := r.c.Query(q, map[string]any{
		"id":      maintenanceConfigID,
		"enabled": cfg.Enabled,
		"preset":  cfg.ReasonPreset,
		"eta":     etaVal,
		"mru":     cfg.MessageRU,
		"men":     cfg.MessageEN,
		"by":      byVal,
	})
	if err != nil {
		return nil, err
	}
	return r.GetMaintenance()
}
