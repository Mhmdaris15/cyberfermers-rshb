package db

import (
	"errors"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   push_repo — Phase 8.
//
//   Push notifications are generated_content rows with channel='push'.
//   Distinct from the prose modules in two ways:
//
//   1. Body carries a `dispatch` object with status / sent_at /
//      attempts / error that the runtime scheduler mutates.
//   2. DispatchDuePushes() runs a single atomic SurrealQL update per
//      scheduler tick that flips queued → sent for rows whose
//      scheduled_for is in the past. No content_revision row is
//      written for those updates — dispatch is a system event, not
//      an editorial edit.
// ============================================================

const freeformPushSlug = "freeform-push"

// ListFarmerPushes returns every push-channel content row for the
// given farmer, newest first.
func (r *Repo) ListFarmerPushes(farmerID, statusFilter string) ([]models.GeneratedContent, error) {
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
	  WHERE channel = 'push'
	    AND suggestion IN (SELECT VALUE id FROM suggestion WHERE farmer = $f)`
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

// EnsureFreeformPushEvent / EnsurePushSuggestion / CreateUserPush —
// same lazy-bootstrap template as Stories / Blogs / Recipes / Social.

func (r *Repo) EnsureFreeformPushEvent() (string, error) {
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
	      audience         = ['push'],
	      product_tags     = [],
	      categories       = [],
	      channels         = ['push'],
	      themes           = ['push','time_sensitive'],
	      color            = 'hsl(var(--rust))',
	      icon             = 'BellRing'
	    );
	    RETURN meta::id($created[0].id);
	  }`
	res, err := r.c.Query(q, map[string]any{
		"slug":  freeformPushSlug,
		"title": "Push-уведомления",
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

func (r *Repo) EnsurePushSuggestion(farmerID, eventID string) (string, error) {
	farmer, err := r.ResolveFarmer(farmerID)
	if err != nil {
		return "", err
	}
	event := ensureRecordID(eventID, "event")
	q := `
	  LET $existing = (SELECT id FROM suggestion
	    WHERE farmer = $f AND event = $e LIMIT 1);
	  IF array::len($existing) > 0 {
	    UPDATE $existing[0].id SET product_reasons = {}, products = [];
	    RETURN meta::id($existing[0].id);
	  } ELSE {
	    LET $created = (CREATE suggestion SET
	      farmer            = $f,
	      event             = $e,
	      products          = [],
	      channels          = ['push'],
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

// CreateUserPush — same author-tagged content + revision pattern as
// the other modules' user-create paths.
func (r *Repo) CreateUserPush(suggestionID string, body map[string]any, authorID string) (string, error) {
	if suggestionID == "" {
		return "", errors.New("suggestion id required")
	}
	if body == nil {
		body = map[string]any{}
	}
	// Initialise dispatch state for newly-created pushes so the
	// scheduler's WHERE clause finds them when scheduled_for fires.
	if _, exists := body["dispatch"]; !exists {
		body["dispatch"] = map[string]any{
			"status":   "queued",
			"attempts": 0,
		}
	}
	sug := ensureRecordID(suggestionID, "suggestion")

	q := `
	  LET $created = (CREATE generated_content SET
	    suggestion       = $s,
	    channel          = 'push',
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
	    note            = "Ручное создание push-уведомления";
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

// ============================================================
//   Dispatch — runtime scheduler hot path
// ============================================================

// DispatchedPush is what DispatchDuePushes returns — minimal metadata
// for logging and (eventually) for handing to a real APN/FCM client.
type DispatchedPush struct {
	ID        string `json:"id"`
	FarmerID  string `json:"farmer_id"`
	Headline  string `json:"headline"`
	BodyText  string `json:"body"`
	DeepLink  string `json:"deep_link"`
	Segments  []any  `json:"segments"`
}

// DispatchDuePushes is the atomic scheduler operation. In ONE SurrealDB
// statement it:
//
//   1. Finds rows where channel='push' AND status='published' AND
//      body.scheduled_for <= time::now() AND body.dispatch.status is
//      'queued' (or unset — legacy rows are treated as queued).
//   2. UPDATEs each matched row's body.dispatch with status='sent'
//      and sent_at=time::now(). Bumps attempts.
//   3. Returns the post-update rows so the caller can log/forward.
//
// Why atomic: if the scheduler dies between SELECT and UPDATE, two
// concurrent ticks could double-fire the same push. The single
// statement guarantees once-per-tick semantics regardless.
//
// NOTE: this mutates generated_content.body directly. It does NOT
// create a content_revision — see the comment block at the top of
// this file for the rationale.
func (r *Repo) DispatchDuePushes() ([]DispatchedPush, error) {
	// SurrealDB's UPDATE returns the updated rows by default, so we
	// can project the dispatched metadata in the same statement.
	q := `
	  UPDATE generated_content
	    MERGE {
	      body: {
	        dispatch: {
	          status: 'sent',
	          sent_at: time::now(),
	          attempts: ((body.dispatch.attempts ?? 0) + 1)
	        }
	      },
	      updated_at: time::now()
	    }
	    WHERE channel = 'push'
	      AND status = 'published'
	      AND body.scheduled_for != NONE
	      AND body.scheduled_for <= time::now()
	      AND (body.dispatch.status = 'queued' OR body.dispatch.status = NONE)
	    RETURN
	      meta::id(id)              AS id,
	      meta::id(suggestion.farmer) AS farmer_id,
	      body.headline             AS headline,
	      body.body                 AS body,
	      body.deep_link            AS deep_link,
	      body.segments             AS segments;`

	res, err := r.c.Query(q, nil)
	if err != nil {
		return nil, err
	}
	var out []DispatchedPush
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}
