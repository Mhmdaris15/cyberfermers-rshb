package db

import (
	"errors"
	"strings"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   plan_repo — phase-3 rich-card lifecycle, comments, activity,
//   per-board summaries.
//
//   UpsertPlanCard (repo.go) stays the legacy create/move/note path.
//   The new methods here handle:
//     - rich-field editing (PATCH /api/plan/cards/:id)
//     - hard delete (DELETE /api/plan/cards/:id)
//     - card detail fetch (GET /api/plan/cards/:id)
//     - comments (collaboration)
//     - activity log (system-emitted audit)
//     - board-type summaries (powers the FE board switcher)
// ============================================================

// ErrPlanCardNotFound — repo signals to handlers to map → 404.
var ErrPlanCardNotFound = errors.New("plan card not found")

// editableCardFields lists every plan_card field that PATCH may touch.
// Used for two reasons:
//   - the activity emitter records the names of fields that actually
//     changed (so the audit log says exactly what was edited)
//   - prevents accidental field promotion from a future PATCH body
//
// `column` and `position` deliberately NOT here — column moves go
// through MovePlanCard (existing /plan/cards/move endpoint) so the
// memory-signal write stays attached to its caller.
var editableCardFields = map[string]bool{
	"title":         true,
	"description":   true,
	"priority":      true,
	"due_date":      true,
	"audience_tags": true,
	"channels":      true,
	"hashtags":      true,
	"cta":           true,
	"attachments":   true,
	"product_refs":  true,
	"assignee_id":   true,
	"board_type":    true,
	"note":          true,
}

// ─── single-card fetch ─────────────────────────────────────────────────

// GetPlanCard returns the full card row with all rich-card fields
// projected. Returns ErrPlanCardNotFound when the id misses.
func (r *Repo) GetPlanCard(id string) (*models.PlanCard, error) {
	if id == "" {
		return nil, ErrPlanCardNotFound
	}
	res, err := r.c.Query(`
	  SELECT
	    meta::id(id) AS id,
	    meta::id(farmer) AS farmer_id,
	    meta::id(suggestion) AS suggestion_id,
	    column AS column, position, note, scheduled_for,
	    launched_at, result_orders, result_revenue, created_at,
	    board_type, title, description, priority, due_date,
	    audience_tags, channels, hashtags, cta, attachments,
	    array::map(product_refs, |$p| meta::id($p)) AS product_refs,
	    IF assignee  = NONE THEN NONE ELSE meta::id(assignee)  END AS assignee_id,
	    IF created_by = NONE THEN NONE ELSE meta::id(created_by) END AS created_by,
	    updated_at
	  FROM type::thing("plan_card", $id);`,
		map[string]any{"id": id},
	)
	if err != nil {
		return nil, err
	}
	var rows []models.PlanCard
	if err := decodeQueryRows(res, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, ErrPlanCardNotFound
	}
	return &rows[0], nil
}

// ─── rich-field edit ───────────────────────────────────────────────────

// UpdatePlanCardFields applies a partial patch and emits an `edited`
// activity row in the same transaction. The caller passes a map of
// {field_name → new_value}; only fields in editableCardFields are honored.
//
// Special handling:
//   - `assignee_id`  → coerced to `record<app_user>` (or NONE on empty)
//   - `product_refs` → each id coerced to `record<product>`
//   - `due_date`     → pass nil to clear (NONE)
//   - `board_type`   → validated against AllBoardTypes (DB ASSERT also checks)
//
// Returns the updated row.
func (r *Repo) UpdatePlanCardFields(id string, patch map[string]any, authorID string) (*models.PlanCard, error) {
	if id == "" {
		return nil, ErrPlanCardNotFound
	}

	// Pre-process the patch: drop unknown fields, coerce records, and
	// collect the field names we actually touched (for the activity payload).
	clean := map[string]any{}
	changed := make([]string, 0, len(patch))
	for k, v := range patch {
		if !editableCardFields[k] {
			continue
		}
		switch k {
		case "assignee_id":
			// Coerce to record<app_user> or NONE.
			if s, ok := v.(string); ok && s != "" {
				clean["assignee"] = "<surreal:thing:app_user:" + s + ">"
			} else {
				clean["assignee"] = nil
			}
		case "product_refs":
			if arr, ok := v.([]string); ok {
				ids := make([]string, len(arr))
				for i, p := range arr {
					ids[i] = ensureRecordID(p, "product")
				}
				clean["product_refs"] = ids
			} else {
				clean["product_refs"] = []string{}
			}
		case "board_type":
			s, _ := v.(string)
			if !isValidBoardType(s) {
				continue // skip silently; DB ASSERT would reject anyway
			}
			clean[k] = s
		default:
			clean[k] = v
		}
		changed = append(changed, k)
	}
	if len(clean) == 0 {
		// Nothing to do — return the current row unchanged.
		return r.GetPlanCard(id)
	}

	clean["updated_at"] = "<surreal:time::now>"

	// Build the SET clause manually so we can splice time::now() and
	// type::thing() calls without escaping them as strings.
	setParts := []string{"updated_at = time::now()"}
	vars := map[string]any{"id": id}
	for k, v := range clean {
		if k == "updated_at" {
			continue
		}
		if s, ok := v.(string); ok && strings.HasPrefix(s, "<surreal:thing:") {
			// assignee form
			parts := strings.SplitN(strings.TrimPrefix(strings.TrimSuffix(s, ">"), "<surreal:thing:"), ":", 2)
			if len(parts) == 2 {
				setParts = append(setParts, k+" = type::thing(\""+parts[0]+"\", $val_"+k+")")
				vars["val_"+k] = parts[1]
			}
			continue
		}
		if k == "product_refs" {
			// Surreal needs record<product> values, not bare strings.
			setParts = append(setParts, k+" = array::map($val_"+k+", |$p| type::thing(\"product\", $p))")
			vars["val_"+k] = v
			continue
		}
		setParts = append(setParts, k+" = $val_"+k)
		vars["val_"+k] = v
	}
	setClause := strings.Join(setParts, ", ")

	q := `
	  LET $cid = type::thing("plan_card", $id);
	  LET $exists = (SELECT id FROM $cid);
	  IF array::len($exists) = 0 {
	    RETURN "notfound";
	  };
	  UPDATE $cid SET ` + setClause + `;
	  CREATE plan_card_activity SET
	    card    = $cid,
	    author  = IF $author = NONE THEN NONE ELSE type::thing("app_user", $author) END,
	    kind    = "edited",
	    payload = { fields: $fields };
	  RETURN (SELECT
	    meta::id(id) AS id,
	    meta::id(farmer) AS farmer_id,
	    meta::id(suggestion) AS suggestion_id,
	    column AS column, position, note, scheduled_for,
	    launched_at, result_orders, result_revenue, created_at,
	    board_type, title, description, priority, due_date,
	    audience_tags, channels, hashtags, cta, attachments,
	    array::map(product_refs, |$p| meta::id($p)) AS product_refs,
	    IF assignee  = NONE THEN NONE ELSE meta::id(assignee)  END AS assignee_id,
	    IF created_by = NONE THEN NONE ELSE meta::id(created_by) END AS created_by,
	    updated_at
	    FROM $cid)[0];`

	vars["author"] = optionalString(&authorID)
	vars["fields"] = changed

	res, err := r.c.Query(q, vars)
	if err != nil {
		return nil, err
	}
	var s string
	if err := decodeQueryRows(res, &s); err == nil && s == "notfound" {
		return nil, ErrPlanCardNotFound
	}
	var out models.PlanCard
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	if out.ID == "" {
		return nil, ErrPlanCardNotFound
	}
	return &out, nil
}

// DeletePlanCard removes a card and emits an `archived` activity. We
// intentionally hard-delete rather than soft-archive: a separate
// `archived` boolean would muddy the recommender's memory signals.
// History is preserved in plan_card_activity (which survives the
// card deletion by design — it's an audit log, not a child).
func (r *Repo) DeletePlanCard(id, authorID string) error {
	if id == "" {
		return nil
	}
	q := `
	  LET $cid = type::thing("plan_card", $id);
	  LET $exists = (SELECT id FROM $cid);
	  IF array::len($exists) = 0 {
	    RETURN "notfound";
	  };
	  CREATE plan_card_activity SET
	    card    = $cid,
	    author  = IF $author = NONE THEN NONE ELSE type::thing("app_user", $author) END,
	    kind    = "archived",
	    payload = {};
	  DELETE $cid;
	  RETURN "ok";`
	res, err := r.c.Query(q, map[string]any{
		"id": id, "author": optionalString(&authorID),
	})
	if err != nil {
		return err
	}
	var s string
	_ = decodeQueryRows(res, &s)
	if s == "notfound" {
		return ErrPlanCardNotFound
	}
	return nil
}

// ─── comments ──────────────────────────────────────────────────────────

// AddPlanCardComment inserts a comment AND emits a `commented` activity
// in the same query. Returns the inserted comment row with author username
// joined for display.
func (r *Repo) AddPlanCardComment(cardID, authorID, body string) (*models.PlanCardComment, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, errors.New("comment body required")
	}
	q := `
	  LET $cid = type::thing("plan_card", $id);
	  LET $exists = (SELECT id FROM $cid);
	  IF array::len($exists) = 0 {
	    RETURN "notfound";
	  };
	  LET $author = IF $aid = NONE THEN NONE ELSE type::thing("app_user", $aid) END;
	  LET $created = (CREATE plan_card_comment SET
	    card   = $cid,
	    author = $author,
	    body   = $body);
	  LET $comment_id = $created[0].id;
	  CREATE plan_card_activity SET
	    card    = $cid,
	    author  = $author,
	    kind    = "commented",
	    payload = {
	      comment_id: meta::id($comment_id),
	      preview:    string::slice($body, 0, 80)
	    };
	  RETURN (SELECT
	    meta::id(id) AS id,
	    meta::id(card) AS card_id,
	    IF author = NONE THEN NONE ELSE meta::id(author) END AS author_id,
	    author.username AS author_username,
	    body, created_at
	    FROM $comment_id FETCH author)[0];`
	res, err := r.c.Query(q, map[string]any{
		"id": cardID, "aid": optionalString(&authorID), "body": body,
	})
	if err != nil {
		return nil, err
	}
	var s string
	if err := decodeQueryRows(res, &s); err == nil && s == "notfound" {
		return nil, ErrPlanCardNotFound
	}
	var out models.PlanCardComment
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ListPlanCardComments returns comments newest-first with author username
// joined for display.
func (r *Repo) ListPlanCardComments(cardID string) ([]models.PlanCardComment, error) {
	res, err := r.c.Query(`
	  SELECT
	    meta::id(id) AS id,
	    meta::id(card) AS card_id,
	    IF author = NONE THEN NONE ELSE meta::id(author) END AS author_id,
	    author.username AS author_username,
	    body, created_at
	  FROM plan_card_comment
	  WHERE card = type::thing("plan_card", $id)
	  ORDER BY created_at DESC
	  FETCH author;`,
		map[string]any{"id": cardID},
	)
	if err != nil {
		return nil, err
	}
	var out []models.PlanCardComment
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ─── activity log ──────────────────────────────────────────────────────

// AppendPlanCardActivity is the public hook for service-layer emitters
// (e.g. plan.Service.AddCard / .Move) to record an audit event. Handler-
// emitted activity (edited / archived / commented) is written by the
// methods above in-line — callers don't touch this path for those kinds.
func (r *Repo) AppendPlanCardActivity(cardID, kind, authorID string, payload map[string]any) error {
	if cardID == "" || kind == "" {
		return nil
	}
	_, err := r.c.Query(`
	  CREATE plan_card_activity SET
	    card    = type::thing("plan_card", $id),
	    author  = IF $author = NONE THEN NONE ELSE type::thing("app_user", $author) END,
	    kind    = $kind,
	    payload = $payload;`,
		map[string]any{
			"id": cardID, "kind": kind,
			"author":  optionalString(&authorID),
			"payload": payload,
		})
	return err
}

// ListPlanCardActivity returns activity newest first, capped at limit (or
// 50 when limit <= 0).
func (r *Repo) ListPlanCardActivity(cardID string, limit int) ([]models.PlanCardActivity, error) {
	if limit <= 0 {
		limit = 50
	}
	res, err := r.c.Query(`
	  SELECT
	    meta::id(id) AS id,
	    meta::id(card) AS card_id,
	    IF author = NONE THEN NONE ELSE meta::id(author) END AS author_id,
	    author.username AS author_username,
	    kind, payload, created_at
	  FROM plan_card_activity
	  WHERE card = type::thing("plan_card", $id)
	  ORDER BY created_at DESC
	  LIMIT $lim
	  FETCH author;`,
		map[string]any{"id": cardID, "lim": limit},
	)
	if err != nil {
		return nil, err
	}
	var out []models.PlanCardActivity
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ─── board summaries ───────────────────────────────────────────────────

// ListBoardSummaries returns one row per board_type with cards counts
// (total / active / completed / overdue). Drives the FE board switcher.
// Boards with zero cards are still returned (Total = 0) so the switcher
// shows every operational pipeline even before any cards exist.
func (r *Repo) ListBoardSummaries(farmerID string) ([]models.BoardSummary, error) {
	full, err := r.ResolveFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	res, err := r.c.Query(`
	  SELECT
	    board_type,
	    count() AS total,
	    count(column != 'completed') AS active,
	    count(column = 'completed') AS completed,
	    count(due_date != NONE AND due_date < time::now() AND column != 'completed') AS overdue
	  FROM plan_card
	  WHERE farmer = $f
	  GROUP BY board_type;`,
		map[string]any{"f": full},
	)
	if err != nil {
		return nil, err
	}
	var rows []models.BoardSummary
	_ = decodeQueryRows(res, &rows)

	// Materialize every board_type even if it has zero cards, so the FE
	// switcher renders the full pipeline list consistently. Iteration
	// order follows AllBoardTypes (canonical UI ordering).
	byType := map[string]models.BoardSummary{}
	for _, r := range rows {
		byType[r.BoardType] = r
	}
	out := make([]models.BoardSummary, 0, len(models.AllBoardTypes))
	for _, b := range models.AllBoardTypes {
		if s, ok := byType[b]; ok {
			out = append(out, s)
		} else {
			out = append(out, models.BoardSummary{BoardType: b})
		}
	}
	return out, nil
}

// ─── helpers ───────────────────────────────────────────────────────────

func isValidBoardType(s string) bool {
	for _, v := range models.AllBoardTypes {
		if v == s {
			return true
		}
	}
	return false
}
