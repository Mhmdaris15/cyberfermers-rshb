package db

import (
	"errors"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   blogs_repo — Phase 5.
//
//   Mirrors stories_repo: blogs are generated_content rows with
//   channel='blog'. Free-form blogs (not pegged to a calendar event)
//   lazily bootstrap a shared 'freeform-blogs' event + per-farmer
//   suggestion. No schema changes.
//
//   The duplication with stories_repo is deliberate at this stage —
//   when Recipes and Push land in later phases, a generic
//   `content_modules.go` helper will replace both. Premature
//   abstraction with only one consumer would have obscured the
//   pattern that's actually doing the work.
// ============================================================

const freeformBlogsSlug = "freeform-blogs"

// ListFarmerBlogs returns every blog-channel content row that belongs
// to the given farmer's suggestions, newest first. statusFilter is
// optional — pass "" for all.
func (r *Repo) ListFarmerBlogs(farmerID, statusFilter string) ([]models.GeneratedContent, error) {
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
	  WHERE channel = 'blog'
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

// EnsureFreeformBlogsEvent returns the bare id of the synthetic always-
// on event that hosts free-form blog posts. Idempotent — only creates
// on the first call across the DB's lifetime.
func (r *Repo) EnsureFreeformBlogsEvent() (string, error) {
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
	      audience         = ['blog'],
	      product_tags     = [],
	      categories       = [],
	      channels         = ['blog'],
	      themes           = ['blog','long_form','seo'],
	      color            = 'hsl(var(--sky))',
	      icon             = 'BookText'
	    );
	    RETURN meta::id($created[0].id);
	  }`
	res, err := r.c.Query(q, map[string]any{
		"slug":  freeformBlogsSlug,
		"title": "Блог фермы",
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

// EnsureBlogsSuggestion returns the per-farmer suggestion that owns the
// farmer's free-form blog posts. Idempotent.
func (r *Repo) EnsureBlogsSuggestion(farmerID, eventID string) (string, error) {
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
	      channels          = ['blog'],
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

// CreateUserBlog writes a brand-new blog-channel generated_content row
// + matching revision (author = the supplied user). Distinct from
// UpsertGenerated which always tags revisions as AI-authored.
func (r *Repo) CreateUserBlog(suggestionID string, body map[string]any, authorID string) (string, error) {
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
	    channel          = 'blog',
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
	    note            = "Ручное создание статьи";
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
