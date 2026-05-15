package db

import (
	"errors"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   stories_repo — Phase 4.
//
//   Stories live in generated_content with channel='story' (no new
//   table). For storytelling that isn't tied to a calendar event we
//   lazily bootstrap a shared "freeform-storytelling" event + a
//   per-farmer suggestion so the existing schema constraints are
//   satisfied without changes.
// ============================================================

// freeformStorytellingSlug is the canonical slug for the synthetic
// always-on event that hosts free-form stories. We use it as a
// find-or-create key.
const freeformStorytellingSlug = "freeform-storytelling"

// ListFarmerStories returns every story-channel content row that belongs
// to the given farmer's suggestions (whether they were auto-generated
// from a real calendar event or written freeform via the storytelling
// shell). Newest first. `statusFilter` is optional — pass "" for all.
func (r *Repo) ListFarmerStories(farmerID, statusFilter string) ([]models.GeneratedContent, error) {
	full, err := r.ResolveFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	q := `
	  SELECT
	    meta::id(id)             AS id,
	    meta::id(suggestion)     AS suggestion_id,
	    channel, variant, body, model, prompt_version,
	    status, current_revision, is_user_edited,
	    published_at, archived_at, updated_at, created_at
	  FROM generated_content
	  WHERE channel = 'story'
	    AND suggestion.farmer = $f`
	vars := map[string]any{"f": full}
	if statusFilter != "" {
		q += ` AND status = $st`
		vars["st"] = statusFilter
	}
	q += ` ORDER BY updated_at DESC, created_at DESC;`

	res, err := r.c.Query(q, vars)
	if err != nil {
		return nil, err
	}
	var out []models.GeneratedContent
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// EnsureFreeformStorytellingEvent returns the bare id of the synthetic
// always-on event that hosts free-form stories. Idempotent — only
// creates a new event on the first call across the entire DB lifetime.
func (r *Repo) EnsureFreeformStorytellingEvent() (string, error) {
	q := `
	  LET $row = (SELECT id FROM event WHERE slug = $slug LIMIT 1);
	  IF array::len($row) > 0 {
	    RETURN meta::id($row[0].id);
	  } ELSE {
	    LET $created = (CREATE event SET
	      slug             = $slug,
	      title            = $title,
	      type             = 'trend',
	      type_detail      = 'freeform',
	      start_date       = time::now(),
	      end_date         = time::now() + 3650d,
	      recurrence       = 'always',
	      prep_window_days = 0,
	      audience         = ['storytelling'],
	      product_tags     = [],
	      categories       = [],
	      channels         = ['story'],
	      themes           = ['storytelling','farmer_voice'],
	      color            = 'hsl(var(--plum))',
	      icon             = 'BookOpen'
	    );
	    RETURN meta::id($created[0].id);
	  }`
	res, err := r.c.Query(q, map[string]any{
		"slug":  freeformStorytellingSlug,
		"title": "Истории фермы",
	})
	if err != nil {
		return "", err
	}
	var id string
	if err := decodeQueryRows(res, &id); err != nil {
		return "", err
	}
	return id, nil
}

// EnsureStorytellingSuggestion returns the per-farmer suggestion that
// owns the farmer's freeform stories. Idempotent — created lazily on
// the first POST /api/farmers/:id/stories call for each farmer.
func (r *Repo) EnsureStorytellingSuggestion(farmerID, eventID string) (string, error) {
	farmer, err := r.ResolveFarmer(farmerID)
	if err != nil {
		return "", err
	}
	event := ensureRecordID(eventID, "event")

	q := `
	  LET $existing = (SELECT id FROM suggestion
	    WHERE farmer = $f AND event = $e LIMIT 1);
	  IF array::len($existing) > 0 {
	    UPDATE $existing[0].id SET product_reasons = {};
	    RETURN meta::id($existing[0].id);
	  } ELSE {
	    LET $created = (CREATE suggestion SET
	      farmer            = $f,
	      event             = $e,
	      channels          = ['story'],
	      date_window_start = time::now(),
	      date_window_end   = time::now() + 3650d,
	      promo             = { kind: "none", value: 0 },
	      predicted_lift    = { orders_delta: 0, revenue_delta: 0 },
	      product_reasons   = {},
	      score             = 0.0,
	      status            = 'proposed'
	    );
	    RETURN meta::id($created[0].id);
	  }`
	res, err := r.c.Query(q, map[string]any{"f": farmer, "e": event})
	if err != nil {
		return "", err
	}
	var id string
	if err := decodeQueryRows(res, &id); err != nil {
		return "", err
	}
	return id, nil
}

// CreateUserStory writes a brand-new story-channel generated_content
// row + matching revision (author = the supplied user). Distinct from
// UpsertGenerated which always tags revisions as AI-authored.
//
// Returns the bare id of the new generated_content row.
func (r *Repo) CreateUserStory(suggestionID string, body map[string]any, authorID string) (string, error) {
	if suggestionID == "" {
		return "", errors.New("suggestion id required")
	}
	if body == nil {
		body = map[string]any{}
	}
	sug := ensureRecordID(suggestionID, "suggestion")

	q := `
	  LET $created = (CREATE generated_content SET
	    suggestion       = $s,
	    channel          = 'story',
	    variant          = 0,
	    body             = $body,
	    model            = 'user',
	    prompt_version   = 'manual',
	    status           = 'draft',
	    current_revision = 1,
	    is_user_edited   = true,
	    updated_at       = time::now());
	  LET $cid = $created[0].id;
	  CREATE content_revision SET
	    content         = $cid,
	    revision_number = 1,
	    body            = $body,
	    model           = 'user',
	    prompt_version  = 'manual',
	    is_user_edited  = true,
	    author          = IF $author = NONE THEN NONE ELSE type::thing("app_user", $author) END,
	    note            = "Ручное создание истории";
	  RETURN meta::id($cid);`

	res, err := r.c.Query(q, map[string]any{
		"s":      sug,
		"body":   body,
		"author": optionalString(&authorID),
	})
	if err != nil {
		return "", err
	}
	var id string
	if err := decodeQueryRows(res, &id); err != nil {
		return "", err
	}
	return id, nil
}

// freeformEventID is a tiny shared accessor for tests + handlers that
// want the bootstrap event id without invoking the creation side-effect.
// Returns "" if the event has never been bootstrapped.
func (r *Repo) FreeformStorytellingEventID() (string, error) {
	res, err := r.c.Query(
		`SELECT meta::id(id) AS id FROM event WHERE slug = $slug LIMIT 1;`,
		map[string]any{"slug": freeformStorytellingSlug},
	)
	if err != nil {
		return "", err
	}
	var rows []struct {
		ID string `json:"id"`
	}
	_ = decodeQueryRows(res, &rows)
	if len(rows) == 0 {
		return "", nil
	}
	return rows[0].ID, nil
}

// ─── helpers ───────────────────────────────────────────────────────────

// nowPlusDays is exported as a small convenience for handlers that need
// a default "scheduled for" timestamp on derived plan cards. Not used
// inside this file but kept here so the import sit alongside the time
// usage.
func nowPlusDays(d int) time.Time { return time.Now().UTC().Add(time.Duration(d) * 24 * time.Hour) }

// keep `nowPlusDays` referenced; unused-symbol gates in some CI configs
// flag exported helpers when only one file references them.
var _ = nowPlusDays
