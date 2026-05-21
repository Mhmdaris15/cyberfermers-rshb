package db

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// Repo is a thin facade over the Surreal client. It returns idiomatic Go structs
// so handlers don't deal with raw JSON.
type Repo struct {
	c *Client
}

func NewRepo(c *Client) *Repo { return &Repo{c: c} }

// Raw is a passthrough to the underlying Surreal client for callers that need
// to issue ad-hoc SQL (e.g. the embedding pipeline). Reserved for short-lived
// CLIs; production code should add a typed method to this file instead.
func (r *Repo) Raw(sql string, vars map[string]any) (any, error) {
	return r.c.Query(sql, vars)
}

// DecodeRows is the exported sister to decodeQueryRows for the same callers.
func DecodeRows(raw any, out any) error {
	return decodeQueryRows(raw, out)
}

// ----- generic helpers --------------------------------------------------

// decodeQueryRows unmarshals the LAST statement's result into out.
// SurrealDB returns one entry per top-level statement; for our multi-statement
// upserts (LET ...; IF { ... RETURN ... } ELSE { ... RETURN ... }), the value
// we care about is always the trailing RETURN. For single-statement SELECTs
// the last entry is also the only entry, so this is safe across the board.
func decodeQueryRows(raw any, out any) error {
	b, err := json.Marshal(raw)
	if err != nil {
		return err
	}
	var resp []struct {
		Status string          `json:"status"`
		Result json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return err
	}
	if len(resp) == 0 {
		return nil
	}
	// Walk from the tail to skip trailing NULL/empty entries produced by
	// statements like UPDATE that emit nothing.
	for i := len(resp) - 1; i >= 0; i-- {
		r := resp[i].Result
		if len(r) == 0 || string(r) == "null" {
			continue
		}
		return json.Unmarshal(r, out)
	}
	return nil
}

// ResolveFarmer turns a URL identifier into a fully-qualified Surreal record
// id ("farmer:abc"). Accepts three input shapes:
//   - "farmer:abc"        → returned as-is (already a record id)
//   - "10060"             → looked up via WHERE organization_id = 10060
//   - "abc"               → returned as "farmer:abc" (raw record id stem)
//
// We do this resolution server-side so the FE can use the stable, human-
// readable organization_id in URLs (e.g. /farmer/10060/dashboard) instead of
// the auto-generated Surreal record id.
func (r *Repo) ResolveFarmer(idOrOrg string) (string, error) {
	if idOrOrg == "" {
		return "", fmt.Errorf("empty farmer id")
	}
	if strings.Contains(idOrOrg, ":") {
		return idOrOrg, nil
	}
	if n, err := strconv.Atoi(idOrOrg); err == nil {
		res, err := r.c.Query(
			`SELECT meta::id(id) AS id FROM farmer WHERE organization_id = $oid LIMIT 1;`,
			map[string]any{"oid": n})
		if err != nil {
			return "", err
		}
		var rows []struct {
			ID string `json:"id"`
		}
		_ = decodeQueryRows(res, &rows)
		if len(rows) == 0 {
			return "", fmt.Errorf("farmer not found: org_id=%d", n)
		}
		return "farmer:" + rows[0].ID, nil
	}
	return "farmer:" + idOrOrg, nil
}

// ----- farmer -----------------------------------------------------------

func (r *Repo) UpsertFarmer(f *models.Farmer) (string, error) {
	q := `
	  LET $row = (SELECT id FROM farmer WHERE organization_id = $oid LIMIT 1);
	  IF array::len($row) > 0 {
	    UPDATE $row[0].id MERGE {
	      shop_name: $name, description: $desc, region: $region, url: $url
	    };
	    RETURN meta::id($row[0].id);
	  } ELSE {
	    LET $created = (CREATE farmer SET
	      organization_id = $oid, shop_name = $name, description = $desc,
	      region = $region, url = $url, channels = $channels,
	      audience_focus = $audience, risk_appetite = $risk
	    );
	    RETURN meta::id($created[0].id);
	  }`
	res, err := r.c.Query(q, map[string]any{
		"oid": f.OrganizationID, "name": f.ShopName, "desc": f.Description,
		"region": f.Region, "url": f.URL,
		"channels": defaultStrings(f.Channels, []string{"storefront", "story", "push", "blog"}),
		"audience": defaultStrings(f.AudienceFocus, []string{"healthy", "parents", "gourmets"}),
		"risk":     defaultString(f.RiskAppetite, "balanced"),
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

func (r *Repo) ListFarmers(limit int) ([]models.Farmer, error) {
	if limit <= 0 {
		limit = 100
	}
	res, err := r.c.Query("SELECT *, meta::id(id) AS id FROM farmer ORDER BY shop_name LIMIT $limit;", map[string]any{"limit": limit})
	if err != nil {
		return nil, err
	}
	var out []models.Farmer
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListFarmersWithCounts is the picker-page variant: same rows as ListFarmers,
// plus a `product_count` integer and distinct `categories` slice per farmer.
// Two queries + one Go merge — faster than 65 separate counts and predictable
// in DB load.
func (r *Repo) ListFarmersWithCounts(limit int) ([]models.Farmer, error) {
	farmers, err := r.ListFarmers(limit)
	if err != nil {
		return nil, err
	}
	if len(farmers) == 0 {
		return farmers, nil
	}

	// Surreal's GROUP BY requires projected columns to match the grouped
	// expression verbatim — `meta::id(farmer)` doesn't satisfy `GROUP BY farmer`,
	// so we project the raw record-id and strip the "farmer:" prefix below.
	res, err := r.c.Query(
		`SELECT farmer, category, count() AS n
		 FROM product GROUP BY farmer, category;`, nil)
	if err != nil {
		// Counts are decorative — return farmers anyway.
		return farmers, nil
	}
	var rows []struct {
		Farmer   string `json:"farmer"`
		Category string `json:"category"`
		N        int    `json:"n"`
	}
	_ = decodeQueryRows(res, &rows)

	type agg struct {
		count int
		cats  map[string]struct{}
	}
	by := make(map[string]*agg, len(farmers))
	for _, row := range rows {
		// "farmer:abc" → "abc" to match Farmer.ID which is the meta::id form.
		fid := strings.TrimPrefix(row.Farmer, "farmer:")
		a := by[fid]
		if a == nil {
			a = &agg{cats: map[string]struct{}{}}
			by[fid] = a
		}
		a.count += row.N
		if row.Category != "" {
			a.cats[row.Category] = struct{}{}
		}
	}
	for i := range farmers {
		a := by[farmers[i].ID]
		if a == nil {
			continue
		}
		farmers[i].ProductCount = a.count
		cats := make([]string, 0, len(a.cats))
		for c := range a.cats {
			cats = append(cats, c)
		}
		sort.Strings(cats)
		farmers[i].Categories = cats
	}

	r.attachScores(farmers)
	return farmers, nil
}

// attachScores fills AIReadinessScore + SeasonalOpportunityScore on every
// farmer. Two cheap aggregate queries + one in-memory join — much faster than
// computing per-farmer in a loop.
func (r *Repo) attachScores(farmers []models.Farmer) {
	// --- Readiness: tags-per-product → % of farmer SKUs with ≥3 tags ---
	res, err := r.c.Query("SELECT product, count() AS n FROM product_tag GROUP BY product;", nil)
	if err != nil {
		return
	}
	var tagRows []struct {
		Product string `json:"product"`
		N       int    `json:"n"`
	}
	_ = decodeQueryRows(res, &tagRows)
	tagsPerProduct := make(map[string]int, len(tagRows))
	for _, row := range tagRows {
		pid := strings.TrimPrefix(row.Product, "product:")
		tagsPerProduct[pid] = row.N
	}

	res, err = r.c.Query("SELECT meta::id(id) AS pid, meta::id(farmer) AS fid FROM product;", nil)
	if err != nil {
		return
	}
	var pf []struct {
		Pid string `json:"pid"`
		Fid string `json:"fid"`
	}
	_ = decodeQueryRows(res, &pf)
	type agg struct{ total, tagged int }
	byFarmer := make(map[string]*agg, len(farmers))
	for _, x := range pf {
		a := byFarmer[x.Fid]
		if a == nil {
			a = &agg{}
			byFarmer[x.Fid] = a
		}
		a.total++
		// Readiness reads "has the AI got *anything* to work with for this
		// SKU?". Even one accurate tag dramatically improves matcher quality;
		// holding out for ≥3 punishes the catalog state too harshly.
		if tagsPerProduct[x.Pid] >= 1 {
			a.tagged++
		}
	}

	// --- Opportunity: count of upcoming events overlapping farmer categories ---
	now := time.Now()
	events, _ := r.ListEventsBetween(now, now.AddDate(0, 0, 60))

	for i := range farmers {
		// readiness
		if a := byFarmer[farmers[i].ID]; a != nil && a.total > 0 {
			farmers[i].AIReadinessScore = int(100.0 * float64(a.tagged) / float64(a.total))
		}
		// opportunity: events whose categories overlap farmer's categories
		catSet := map[string]bool{}
		for _, c := range farmers[i].Categories {
			catSet[c] = true
		}
		matched := 0
		for _, ev := range events {
			for _, c := range ev.Categories {
				if catSet[c] {
					matched++
					break
				}
			}
		}
		score := matched * 5 // 20 events = 100
		if score > 100 {
			score = 100
		}
		farmers[i].SeasonalOpportunityScore = score
	}
}

func (r *Repo) GetFarmer(id string) (*models.Farmer, error) {
	full, err := r.ResolveFarmer(id)
	if err != nil {
		return nil, err
	}
	res, err := r.c.Query("SELECT *, meta::id(id) AS id FROM $f;", map[string]any{"f": full})
	if err != nil {
		return nil, err
	}
	var rows []models.Farmer
	if err := decodeQueryRows(res, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("farmer not found: %s", id)
	}
	return &rows[0], nil
}

// ----- product ----------------------------------------------------------

func (r *Repo) UpsertProduct(p *models.Product) (string, error) {
	farmer := ensureRecordID(p.FarmerID, "farmer")
	q := `
	  LET $row = (SELECT id FROM product WHERE product_id = $pid LIMIT 1);
	  IF array::len($row) > 0 {
	    UPDATE $row[0].id MERGE {
	      name: $name, description: $desc, category: $cat, url: $url, farmer: $farmer
	    };
	    RETURN meta::id($row[0].id);
	  } ELSE {
	    LET $created = (CREATE product SET
	      product_id = $pid, farmer = $farmer, name = $name,
	      description = $desc, category = $cat, url = $url
	    );
	    RETURN meta::id($created[0].id);
	  }`
	res, err := r.c.Query(q, map[string]any{
		"pid":  p.ProductID,
		"name": p.Name, "desc": p.Description,
		"cat": p.Category, "url": p.URL, "farmer": farmer,
	})
	if err != nil {
		return "", err
	}
	var id string
	_ = decodeQueryRows(res, &id)
	return id, nil
}

func (r *Repo) ListProductsByFarmer(farmerID string) ([]models.Product, error) {
	full, err := r.ResolveFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	res, err := r.c.Query(
		`SELECT *, meta::id(id) AS id, meta::id(farmer) AS farmer_id FROM product WHERE farmer = $f ORDER BY name;`,
		map[string]any{"f": full})
	if err != nil {
		return nil, err
	}
	var out []models.Product
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	// tags
	for i := range out {
		tags, _ := r.ListTagsForProduct(out[i].ID)
		out[i].Tags = tags
	}
	return out, nil
}

// ----- product_tag ------------------------------------------------------

func (r *Repo) UpsertTag(productID, tag, source string, confidence float64) error {
	full := ensureRecordID(productID, "product")
	_, err := r.c.Query(`
	  LET $row = (SELECT id FROM product_tag WHERE product = $p AND tag = $t LIMIT 1);
	  IF array::len($row) > 0 {
	    UPDATE $row[0].id MERGE { source: $src, confidence: $c };
	  } ELSE {
	    CREATE product_tag SET product = $p, tag = $t, source = $src, confidence = $c;
	  };`,
		map[string]any{"p": full, "t": tag, "src": source, "c": confidence})
	return err
}

// GetProduct returns a single product by bare id (no `product:` prefix
// required — `ensureRecordID` handles both forms). Returns (nil, nil)
// when no row matches so callers can distinguish "not found" from a
// transport error without inspecting error strings.
func (r *Repo) GetProduct(productID string) (*models.Product, error) {
	full := ensureRecordID(productID, "product")
	res, err := r.c.Query(
		`SELECT *, meta::id(id) AS id, meta::id(farmer) AS farmer_id FROM $p LIMIT 1;`,
		map[string]any{"p": full},
	)
	if err != nil {
		return nil, err
	}
	var rows []models.Product
	if err := decodeQueryRows(res, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	tags, _ := r.ListTagsForProduct(rows[0].ID)
	rows[0].Tags = tags
	return &rows[0], nil
}

// DeleteTag removes a single (product, tag) row regardless of source.
// Idempotent — deleting a non-existent tag returns nil. Used by the
// FE chip-editor when the user clicks ×.
func (r *Repo) DeleteTag(productID, tag string) error {
	full := ensureRecordID(productID, "product")
	_, err := r.c.Query(
		`DELETE FROM product_tag WHERE product = $p AND tag = $t;`,
		map[string]any{"p": full, "t": strings.ToLower(strings.TrimSpace(tag))},
	)
	return err
}

// ListAllTags returns every distinct tag in the corpus, used by the FE
// autocomplete when a user starts typing a new tag. Cheap query — there
// are ≈80 canonical tags in the seed catalog.
func (r *Repo) ListAllTags() ([]string, error) {
	res, err := r.c.Query(`SELECT VALUE tag FROM product_tag GROUP BY tag ORDER BY tag;`, nil)
	if err != nil {
		return nil, err
	}
	var out []string
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repo) ListTagsForProduct(productID string) ([]string, error) {
	full := ensureRecordID(productID, "product")
	res, err := r.c.Query(`SELECT tag FROM product_tag WHERE product = $p;`,
		map[string]any{"p": full})
	if err != nil {
		return nil, err
	}
	var rows []struct {
		Tag string `json:"tag"`
	}
	if err := decodeQueryRows(res, &rows); err != nil {
		return nil, err
	}
	out := make([]string, len(rows))
	for i, x := range rows {
		out[i] = x.Tag
	}
	return out, nil
}

// ----- event ------------------------------------------------------------

func (r *Repo) UpsertEvent(e *models.Event) (string, error) {
	q := `
	  LET $row = (SELECT id FROM event WHERE slug = $slug LIMIT 1);
	  IF array::len($row) > 0 {
	    UPDATE $row[0].id MERGE $data;
	    RETURN meta::id($row[0].id);
	  } ELSE {
	    LET $created = (CREATE event CONTENT $data);
	    RETURN meta::id($created[0].id);
	  }`
	res, err := r.c.Query(q, map[string]any{
		"slug": e.Slug,
		"data": map[string]any{
			"slug":             e.Slug,
			"title":            e.Title,
			"type":             string(e.Type),
			"type_detail":      e.TypeDetail,
			"start_date":       e.StartDate,
			"end_date":         e.EndDate,
			"recurrence":       e.Recurrence,
			"prep_window_days": e.PrepWindowDays,
			"audience":         e.Audience,
			"product_tags":     e.ProductTags,
			"categories":       e.Categories,
			"channels":         e.Channels,
			"themes":           e.Themes,
			"color":            e.Color,
			"icon":             e.Icon,
		},
	})
	if err != nil {
		return "", err
	}
	var id string
	_ = decodeQueryRows(res, &id)
	return id, nil
}

func (r *Repo) ListEventsBetween(from, to time.Time) ([]models.Event, error) {
	res, err := r.c.Query(`
	  SELECT *, meta::id(id) AS id FROM event
	  WHERE (start_date <= $to AND end_date >= $from)
	     OR (start_date >= $from AND start_date <= $to)
	  ORDER BY start_date;`,
		map[string]any{"from": from, "to": to})
	if err != nil {
		return nil, err
	}
	var out []models.Event
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ----- suggestion -------------------------------------------------------

func (r *Repo) CreateSuggestion(s *models.Suggestion) (string, error) {
	farmer, err := r.ResolveFarmer(s.FarmerID)
	if err != nil {
		return "", err
	}
	event := ensureRecordID(s.EventID, "event")
	// Accept either an explicit []ProductIDs list (used internally by the
	// recommendation engine) or fall back to extracting ids from the embedded
	// Products array (used by the FE when persisting a transient suggestion).
	src := s.ProductIDs
	if len(src) == 0 {
		src = make([]string, 0, len(s.Products))
		for _, p := range s.Products {
			if p.ID != "" {
				src = append(src, p.ID)
			}
		}
	}
	products := make([]string, 0, len(src))
	for _, p := range src {
		products = append(products, ensureRecordID(p, "product"))
	}
	// Coerce []string maps to []any so marshalSurreal handles them generically.
	reasons := map[string]any{}
	for k, v := range s.ProductReasons {
		// Surreal key must not contain ':' literally; record-id-shaped keys get
		// stored as strings since this is a FLEXIBLE field, not a record link.
		reasons[k] = v
	}
	res, err := r.c.Query(`
	  LET $created = (CREATE suggestion SET
	    farmer = $farmer, event = $event, products = $products,
	    channels = $channels, date_window_start = $start, date_window_end = $end,
	    promo = $promo, predicted_lift = $lift, score = $score, status = $status,
	    product_reasons = $reasons
	  );
	  RETURN meta::id($created[0].id);
	`,
		map[string]any{
			"farmer": farmer, "event": event, "products": products,
			"channels": s.Channels, "start": s.DateWindowStart, "end": s.DateWindowEnd,
			"promo": s.Promo, "lift": s.PredictedLift, "score": s.Score, "status": s.Status,
			"reasons": reasons,
		})
	if err != nil {
		return "", err
	}
	var id string
	_ = decodeQueryRows(res, &id)
	return id, nil
}

// ListSuggestionsForFarmer returns persisted suggestions in [from,to].
// Uses an explicit field list + FETCH event so the nested `event` arrives as
// a populated object instead of a raw record-id string.
func (r *Repo) ListSuggestionsForFarmer(farmerID string, from, to time.Time) ([]models.Suggestion, error) {
	full, err := r.ResolveFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	res, err := r.c.Query(`
	  SELECT
	    meta::id(id) AS id,
	    meta::id(farmer) AS farmer_id,
	    meta::id(event) AS event_id,
	    channels, date_window_start, date_window_end,
	    promo, predicted_lift, product_reasons, score, status,
	    event, products,
	    created_at, updated_at
	  FROM suggestion
	  WHERE farmer = $f
	    AND date_window_start <= $to
	    AND date_window_end >= $from
	  ORDER BY date_window_start
	  FETCH event, products;`,
		map[string]any{"f": full, "from": from, "to": to})
	if err != nil {
		return nil, err
	}
	var out []models.Suggestion
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repo) GetSuggestion(id string) (*models.Suggestion, error) {
	full := ensureRecordID(id, "suggestion")
	res, err := r.c.Query(`
	  SELECT
	    meta::id(id) AS id,
	    meta::id(farmer) AS farmer_id,
	    meta::id(event) AS event_id,
	    channels, date_window_start, date_window_end,
	    promo, predicted_lift, product_reasons, score, status,
	    event, products,
	    created_at, updated_at
	  FROM $s FETCH event, products;`,
		map[string]any{"s": full})
	if err != nil {
		return nil, err
	}
	var rows []models.Suggestion
	if err := decodeQueryRows(res, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("suggestion not found: %s", id)
	}
	return &rows[0], nil
}

// ----- generated_content ------------------------------------------------

// UpsertGenerated writes an AI-authored content row and snapshots a
// content_revision atomically.
//
//   - First write for the (suggestion, channel, variant) tuple: creates
//     generated_content with current_revision=1, status=draft, and a
//     matching content_revision row (author=NONE, note="AI generation").
//   - Subsequent writes (re-generation): increments current_revision,
//     updates body/model/prompt_version, and inserts a new
//     content_revision (author=NONE, note="AI regeneration").
//
// The /generate handler's cache-hit short-circuit means we are only
// called when the body actually differs from what's stored, so we can
// always increment the revision counter — no need to compare bodies
// inside the query.
//
// Mutates gc.ID with the bare record id of the upserted row.
func (r *Repo) UpsertGenerated(gc *models.GeneratedContent) error {
	sug := ensureRecordID(gc.SuggestionID, "suggestion")
	q := `
	  LET $row = (SELECT id, current_revision FROM generated_content
	    WHERE suggestion = $s AND channel = $ch AND variant = $v LIMIT 1);
	  IF array::len($row) > 0 {
	    LET $cid  = $row[0].id;
	    LET $next = $row[0].current_revision + 1;
	    UPDATE $cid SET
	      body             = $body,
	      model            = $model,
	      prompt_version   = $pv,
	      current_revision = $next,
	      updated_at       = time::now();
	    CREATE content_revision SET
	      content         = $cid,
	      revision_number = $next,
	      body            = $body,
	      model           = $model,
	      prompt_version  = $pv,
	      is_user_edited  = false,
	      author          = NONE,
	      note            = "AI regeneration";
	    RETURN meta::id($cid);
	  } ELSE {
	    LET $created = (CREATE generated_content SET
	      suggestion       = $s,
	      channel          = $ch,
	      variant          = $v,
	      body             = $body,
	      model            = $model,
	      prompt_version   = $pv,
	      current_revision = 1,
	      status           = 'draft',
	      is_user_edited   = false,
	      updated_at       = time::now());
	    LET $cid = $created[0].id;
	    CREATE content_revision SET
	      content         = $cid,
	      revision_number = 1,
	      body            = $body,
	      model           = $model,
	      prompt_version  = $pv,
	      is_user_edited  = false,
	      author          = NONE,
	      note            = "AI generation";
	    RETURN meta::id($cid);
	  };`
	res, err := r.c.Query(q, map[string]any{
		"s":     sug,
		"ch":    string(gc.Channel),
		"v":     gc.Variant,
		"body":  gc.Body,
		"model": gc.Model,
		"pv":    gc.PromptVersion,
	})
	if err != nil {
		return err
	}
	var id string
	if err := decodeQueryRows(res, &id); err == nil && id != "" {
		gc.ID = id
	}
	return nil
}

func (r *Repo) ListGeneratedForSuggestion(suggestionID string) ([]models.GeneratedContent, error) {
	full := ensureRecordID(suggestionID, "suggestion")
	res, err := r.c.Query(
		`SELECT *, meta::id(id) AS id, meta::id(suggestion) AS suggestion_id FROM generated_content WHERE suggestion = $s ORDER BY channel, variant;`,
		map[string]any{"s": full})
	if err != nil {
		return nil, err
	}
	var out []models.GeneratedContent
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ----- plan_card --------------------------------------------------------

// UpsertPlanCard creates or updates the plan_card matching the suggestion.
// On UPDATE it merges only the legacy fields (column/position/note/scheduled_for) —
// rich-card fields (board_type/title/description/priority/etc.) are written
// via UpdatePlanCardFields (see plan_repo.go). This keeps the move/AddCard
// hot path identical to its pre-Phase-3 behavior; rich edits go through a
// separate, audit-emitting path.
func (r *Repo) UpsertPlanCard(card *models.PlanCard) (string, error) {
	farmer, err := r.ResolveFarmer(card.FarmerID)
	if err != nil {
		return "", err
	}
	sug := ensureRecordID(card.SuggestionID, "suggestion")
	res, err := r.c.Query(`
	  LET $row = (SELECT id FROM plan_card WHERE suggestion = $s LIMIT 1);
	  IF array::len($row) > 0 {
	    UPDATE $row[0].id MERGE {
	      column: $col, position: $pos, note: $note, scheduled_for: $sched,
	      updated_at: time::now()
	    };
	    RETURN meta::id($row[0].id);
	  } ELSE {
	    LET $created = (CREATE plan_card SET
	      farmer = $f, suggestion = $s, column = $col, position = $pos,
	      note = $note, scheduled_for = $sched,
	      board_type = $board, title = $title, description = $desc,
	      priority = $prio, due_date = $due,
	      audience_tags = $audtags, channels = $chans, hashtags = $tags,
	      cta = $cta,
	      created_by = IF $cb = NONE THEN NONE ELSE type::thing("app_user", $cb) END
	    );
	    RETURN meta::id($created[0].id);
	  }`,
		map[string]any{
			"f": farmer, "s": sug,
			"col":   defaultString(card.Column, "proposed"),
			"pos":   card.Position,
			"note":  card.Note,
			"sched": card.ScheduledFor,
			"board": defaultString(card.BoardType, models.BoardCampaign),
			"title": optionalString(&card.Title),
			"desc":  optionalString(&card.Description),
			"prio":  defaultString(card.Priority, models.PriorityNormal),
			"due":   card.DueDate,
			"audtags": defaultStrings(card.AudienceTags, nil),
			"chans":   defaultStrings(card.Channels, nil),
			"tags":    defaultStrings(card.Hashtags, nil),
			"cta":     optionalString(&card.CTA),
			"cb":      optionalString(card.CreatedBy),
		})
	if err != nil {
		return "", err
	}
	var id string
	_ = decodeQueryRows(res, &id)
	return id, nil
}

// ListPlanByFarmer returns plan cards WITHOUT hydrating the nested suggestion.
// Use plan.Service.Board() if you need cards with their Suggestion+Event populated.
//
// `boardType` filters to a single board when non-empty; pass "" to get all
// cards across all boards (current default for the dashboard view).
//
// Why explicit fields? `SELECT *` would emit raw record-id strings for the
// `farmer` and `suggestion` columns. Those collide with our struct's
// `Suggestion *Suggestion` field (tagged "suggestion") and cause a decode error.
func (r *Repo) ListPlanByFarmer(farmerID, boardType string) ([]models.PlanCard, error) {
	full, err := r.ResolveFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	q := `
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
	  FROM plan_card WHERE farmer = $f`
	vars := map[string]any{"f": full}
	if boardType != "" {
		q += ` AND board_type = $b`
		vars["b"] = boardType
	}
	q += ` ORDER BY column, position;`
	res, err := r.c.Query(q, vars)
	if err != nil {
		return nil, err
	}
	var out []models.PlanCard
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetSuggestionsByIDs bulk-loads suggestions with their event + products
// hydrated via FETCH so callers can render plan/dashboard cards without N+1
// lookups. The returned map is keyed by the local id (without "suggestion:"
// prefix) so callers can look up by what they get from meta::id().
func (r *Repo) GetSuggestionsByIDs(ids []string) (map[string]*models.Suggestion, error) {
	if len(ids) == 0 {
		return map[string]*models.Suggestion{}, nil
	}
	full := make([]string, len(ids))
	for i, id := range ids {
		full[i] = ensureRecordID(id, "suggestion")
	}
	res, err := r.c.Query(`
	  SELECT
	    meta::id(id) AS id,
	    meta::id(farmer) AS farmer_id,
	    meta::id(event) AS event_id,
	    channels, date_window_start, date_window_end,
	    promo, predicted_lift, product_reasons, score, status,
	    event, products,
	    created_at, updated_at
	  FROM suggestion WHERE id INSIDE $ids FETCH event, products;`,
		map[string]any{"ids": full})
	if err != nil {
		return nil, err
	}
	var rows []models.Suggestion
	if err := decodeQueryRows(res, &rows); err != nil {
		return nil, err
	}
	out := make(map[string]*models.Suggestion, len(rows))
	for i := range rows {
		out[rows[i].ID] = &rows[i]
	}
	return out, nil
}

// ----- helpers ----------------------------------------------------------

func ensureRecordID(id, table string) string {
	if id == "" {
		return ""
	}
	if strings.Contains(id, ":") {
		return id
	}
	return table + ":" + id
}

func defaultString(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
func defaultStrings(v, def []string) []string {
	if len(v) == 0 {
		return def
	}
	return v
}
