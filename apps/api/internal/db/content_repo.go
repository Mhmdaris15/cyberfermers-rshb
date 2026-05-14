package db

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   content_repo — phase-2 content lifecycle + revisions
//
//   The current state of every piece of content lives in
//   generated_content. content_revision is an append-only audit log.
//   `current_revision` on the content row equals the most recent
//   revision_number — invariant maintained by every write path.
// ============================================================

// ErrContentNotFound signals a missing generated_content row.
var ErrContentNotFound = errors.New("content not found")

// ErrRevisionNotFound — revision_number doesn't exist for that content.
var ErrRevisionNotFound = errors.New("revision not found")

// GetContent fetches a single generated_content row by its bare record id.
func (r *Repo) GetContent(id string) (*models.GeneratedContent, error) {
	if id == "" {
		return nil, ErrContentNotFound
	}
	res, err := r.c.Query(
		`SELECT *,
		    meta::id(id) AS id,
		    meta::id(suggestion) AS suggestion_id
		   FROM type::thing("generated_content", $id);`,
		map[string]any{"id": id},
	)
	if err != nil {
		return nil, err
	}
	var rows []models.GeneratedContent
	if err := decodeQueryRows(res, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, ErrContentNotFound
	}
	return &rows[0], nil
}

// UpdateContentBody persists a user-authored edit. Atomically:
//
//  1. computes the next revision_number
//  2. inserts a content_revision row (author = userID, is_user_edited = true)
//  3. updates the content row (body, current_revision, is_user_edited,
//     updated_at). status is NOT changed — editing a published item keeps
//     it published, editing a draft keeps it draft. Publish is an explicit
//     verb on its own endpoint.
//
// Returns the updated content row.
func (r *Repo) UpdateContentBody(id string, body map[string]any, note, userID string) (*models.GeneratedContent, error) {
	if id == "" {
		return nil, ErrContentNotFound
	}
	if body == nil {
		return nil, fmt.Errorf("body is required")
	}

	q := `
	  LET $cid = type::thing("generated_content", $id);
	  LET $row = (SELECT id, current_revision FROM $cid);
	  IF array::len($row) = 0 {
	    RETURN "notfound";
	  };
	  LET $next = $row[0].current_revision + 1;
	  CREATE content_revision SET
	    content        = $cid,
	    revision_number = $next,
	    body           = $body,
	    model          = NONE,
	    prompt_version = NONE,
	    is_user_edited = true,
	    author         = IF $uid = NONE THEN NONE ELSE type::thing("app_user", $uid) END,
	    note           = $note;
	  UPDATE $cid SET
	    body             = $body,
	    current_revision = $next,
	    is_user_edited   = true,
	    updated_at       = time::now();
	  RETURN (SELECT *,
	    meta::id(id) AS id,
	    meta::id(suggestion) AS suggestion_id
	    FROM $cid)[0];`

	vars := map[string]any{
		"id": id, "body": body, "uid": optionalString(&userID),
		"note": optionalString(&note),
	}
	res, err := r.c.Query(q, vars)
	if err != nil {
		return nil, err
	}

	// First decode as string to catch the "notfound" sentinel.
	var s string
	if err := decodeQueryRows(res, &s); err == nil && s == "notfound" {
		return nil, ErrContentNotFound
	}

	var out models.GeneratedContent
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	if out.ID == "" {
		return nil, ErrContentNotFound
	}
	return &out, nil
}

// TransitionContent moves a content row through its lifecycle. newStatus
// must be one of {draft, published, archived}. Stamps the corresponding
// timestamp (published_at / archived_at) on transition, clears it on
// reverse transition (unarchive → draft clears archived_at).
//
// This does NOT create a content_revision — status changes are not
// content edits. They are tracked via the status field + timestamps only.
func (r *Repo) TransitionContent(id, newStatus string) (*models.GeneratedContent, error) {
	if newStatus != models.ContentStatusDraft &&
		newStatus != models.ContentStatusPublished &&
		newStatus != models.ContentStatusArchived {
		return nil, fmt.Errorf("invalid status: %s", newStatus)
	}

	patch := map[string]any{
		"status":     newStatus,
		"updated_at": "<surreal:time::now>",
	}
	// One-line lifecycle: stamp on enter, clear on leave (idempotent).
	switch newStatus {
	case models.ContentStatusPublished:
		patch["published_at"] = "<surreal:time::now>"
	case models.ContentStatusArchived:
		patch["archived_at"] = "<surreal:time::now>"
	case models.ContentStatusDraft:
		patch["archived_at"] = nil
		// We deliberately keep published_at — it remains a record of "this
		// has been live before", useful for UX ("опубликовано 3 дня назад").
	}

	// SurrealDB MERGE with literal time::now() — use a small inline shim
	// to splice the function call into the query instead of trying to
	// marshal it through the variable inliner.
	q := `
	  LET $cid = type::thing("generated_content", $id);
	  LET $exists = (SELECT id FROM $cid);
	  IF array::len($exists) = 0 {
	    RETURN "notfound";
	  };
	  UPDATE $cid SET
	    status     = $status,
	    updated_at = time::now()`
	switch newStatus {
	case models.ContentStatusPublished:
		q += `, published_at = time::now()`
	case models.ContentStatusArchived:
		q += `, archived_at = time::now()`
	case models.ContentStatusDraft:
		q += `, archived_at = NONE`
	}
	q += `;
	  RETURN (SELECT *,
	    meta::id(id) AS id,
	    meta::id(suggestion) AS suggestion_id
	    FROM $cid)[0];`

	res, err := r.c.Query(q, map[string]any{"id": id, "status": newStatus})
	if err != nil {
		return nil, err
	}
	var s string
	if err := decodeQueryRows(res, &s); err == nil && s == "notfound" {
		return nil, ErrContentNotFound
	}
	var out models.GeneratedContent
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	if out.ID == "" {
		return nil, ErrContentNotFound
	}
	return &out, nil
}

// ListContentRevisions returns all revisions for a content row, newest
// first, with author username FETCH-joined for display.
func (r *Repo) ListContentRevisions(contentID string) ([]models.ContentRevision, error) {
	res, err := r.c.Query(`
	  SELECT
	    meta::id(id)         AS id,
	    meta::id(content)    AS content_id,
	    revision_number, body, model, prompt_version,
	    is_user_edited, note, created_at,
	    IF author = NONE THEN NONE ELSE meta::id(author) END AS author_id,
	    author.username      AS author_username
	  FROM content_revision
	  WHERE content = type::thing("generated_content", $id)
	  ORDER BY revision_number DESC
	  FETCH author;`,
		map[string]any{"id": contentID},
	)
	if err != nil {
		return nil, err
	}
	var rows []models.ContentRevision
	if err := decodeQueryRows(res, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// RestoreContentRevision copies revision N's body into a NEW revision
// (revision_number = current_revision + 1) and updates the content row.
// History stays linear and immutable — we never mutate the historical
// row, which means "what was v3?" is always answerable.
func (r *Repo) RestoreContentRevision(contentID string, revisionNumber int, note, userID string) (*models.GeneratedContent, error) {
	if revisionNumber <= 0 {
		return nil, ErrRevisionNotFound
	}
	defaultNote := fmt.Sprintf("восстановлено из v%d", revisionNumber)
	if note == "" {
		note = defaultNote
	}

	q := `
	  LET $cid = type::thing("generated_content", $id);
	  LET $row = (SELECT id, current_revision FROM $cid);
	  IF array::len($row) = 0 {
	    RETURN "notfound";
	  };
	  LET $rev = (SELECT body FROM content_revision
	              WHERE content = $cid AND revision_number = $rn LIMIT 1);
	  IF array::len($rev) = 0 {
	    RETURN "revnotfound";
	  };
	  LET $next = $row[0].current_revision + 1;
	  CREATE content_revision SET
	    content        = $cid,
	    revision_number = $next,
	    body           = $rev[0].body,
	    model          = NONE,
	    prompt_version = NONE,
	    is_user_edited = true,
	    author         = IF $uid = NONE THEN NONE ELSE type::thing("app_user", $uid) END,
	    note           = $note;
	  UPDATE $cid SET
	    body             = $rev[0].body,
	    current_revision = $next,
	    is_user_edited   = true,
	    updated_at       = time::now();
	  RETURN (SELECT *,
	    meta::id(id) AS id,
	    meta::id(suggestion) AS suggestion_id
	    FROM $cid)[0];`

	res, err := r.c.Query(q, map[string]any{
		"id": contentID, "rn": revisionNumber,
		"uid": optionalString(&userID), "note": note,
	})
	if err != nil {
		return nil, err
	}
	var s string
	if err := decodeQueryRows(res, &s); err == nil {
		if s == "notfound" {
			return nil, ErrContentNotFound
		}
		if s == "revnotfound" {
			return nil, ErrRevisionNotFound
		}
	}
	var out models.GeneratedContent
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	if out.ID == "" {
		return nil, ErrContentNotFound
	}
	return &out, nil
}

// recordRevisionFromCurrent inserts a content_revision capturing the
// state currently in generated_content. Used internally after an AI
// regeneration so the new body becomes revision N. Returns the new
// revision_number it assigned.
//
// `model` and `pv` are recorded on the revision (so history shows
// "this was AI-generated with v3 prompt"); `author = NONE` distinguishes
// AI from human edits.
func (r *Repo) recordAIRevision(contentID string, body map[string]any, model, pv string) (int, error) {
	q := `
	  LET $cid = type::thing("generated_content", $id);
	  LET $row = (SELECT current_revision FROM $cid);
	  IF array::len($row) = 0 {
	    RETURN -1;
	  };
	  LET $next = $row[0].current_revision;
	  CREATE content_revision SET
	    content        = $cid,
	    revision_number = $next,
	    body           = $body,
	    model          = $model,
	    prompt_version = $pv,
	    is_user_edited = false,
	    author         = NONE,
	    note           = "AI generation";
	  RETURN $next;`
	res, err := r.c.Query(q, map[string]any{
		"id": contentID, "body": body, "model": model, "pv": pv,
	})
	if err != nil {
		return 0, err
	}
	var n int
	_ = decodeQueryRows(res, &n)
	return n, nil
}

// bodyHasChanged returns true iff the JSON-byte representation of two
// bodies differs. Cheap and conservative — keyless equality on identical
// JSON shapes; over-counts revisions if the AI emits semantically-
// equivalent but byte-different JSON. Acceptable for an audit log.
func bodyHasChanged(a, b map[string]any) bool {
	if len(a) == 0 && len(b) == 0 {
		return false
	}
	ab, _ := json.Marshal(a)
	bb, _ := json.Marshal(b)
	return string(ab) != string(bb)
}
