package db

import (
	"errors"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   social_repo — Phase 7.
//
//   Mirrors recipes_repo: social posts are generated_content rows with
//   channel='social'. Free-form posts lazily bootstrap a shared
//   'freeform-social' event + per-farmer suggestion. No schema changes.
// ============================================================

const freeformSocialSlug = "freeform-social"

// ListFarmerSocialPosts returns every social-channel content row for
// the given farmer, newest first.
func (r *Repo) ListFarmerSocialPosts(farmerID, statusFilter string) ([]models.GeneratedContent, error) {
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
	  WHERE channel = 'social'
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

// EnsureFreeformSocialEvent — idempotent find-or-create for the
// synthetic always-on event that owns free-form social posts.
func (r *Repo) EnsureFreeformSocialEvent() (string, error) {
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
	      audience         = ['social'],
	      product_tags     = [],
	      categories       = [],
	      channels         = ['social'],
	      themes           = ['social','instagram','telegram','vk'],
	      color            = 'hsl(var(--sky))',
	      icon             = 'Share2'
	    );
	    RETURN meta::id($created[0].id);
	  }`
	res, err := r.c.Query(q, map[string]any{
		"slug":  freeformSocialSlug,
		"title": "Соцсети фермы",
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

// EnsureSocialSuggestion — idempotent find-or-create for the per-
// farmer suggestion that owns free-form social posts.
func (r *Repo) EnsureSocialSuggestion(farmerID, eventID string) (string, error) {
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
	      channels          = ['social'],
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

// CreateUserSocialPost writes a brand-new social-channel
// generated_content row + matching revision (author = the caller).
func (r *Repo) CreateUserSocialPost(suggestionID string, body map[string]any, authorID string) (string, error) {
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
	    channel          = 'social',
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
	    note            = "Ручное создание поста";
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
