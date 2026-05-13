package db

import (
	"fmt"
	"strings"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// =====================================================================
//   Graph + vector + memory helpers
//
//   These methods live on Repo but are split out here so the surface
//   area is obvious: this is where the SurrealDB-native features get
//   used (RELATE, FETCH, vector::similarity, KNN <|k,COSINE|>).
// =====================================================================

// --- RELATE edge writers -------------------------------------------------

// EnsureOwns emits one farmer→owns→product edge. Idempotent on
// (in,out) thanks to DELETE-then-RELATE; safe to call from import.
func (r *Repo) EnsureOwns(farmerID, productID string) error {
	farmer := ensureRecordID(farmerID, "farmer")
	product := ensureRecordID(productID, "product")
	_, err := r.c.Query(
		`DELETE owns WHERE in = $f AND out = $p;
		 RELATE $f->owns->$p;`,
		map[string]any{"f": farmer, "p": product})
	return err
}

// UpsertFits writes a product→fits→event edge with the recommender's score
// and human-readable reasons. Replaces any previous edge for the pair.
func (r *Repo) UpsertFits(productID, eventID string, score float64, reasons []string) error {
	product := ensureRecordID(productID, "product")
	event := ensureRecordID(eventID, "event")
	_, err := r.c.Query(
		`DELETE fits WHERE in = $p AND out = $e;
		 RELATE $p->fits->$e SET score = $score, reasons = $reasons;`,
		map[string]any{"p": product, "e": event, "score": score, "reasons": reasons})
	return err
}

// RelateTriggers and friends — thin wrappers used by the recommender
// when persisting a campaign.
func (r *Repo) RelateTriggers(eventID, suggestionID string) error {
	_, err := r.c.Query(
		`RELATE $e->triggers->$s;`,
		map[string]any{"e": ensureRecordID(eventID, "event"), "s": ensureRecordID(suggestionID, "suggestion")})
	return err
}
func (r *Repo) RelateGenerated(suggestionID, contentID, channel string) error {
	_, err := r.c.Query(
		`RELATE $s->generated->$c SET channel = $ch;`,
		map[string]any{
			"s":  ensureRecordID(suggestionID, "suggestion"),
			"c":  ensureRecordID(contentID, "generated_content"),
			"ch": channel,
		})
	return err
}
func (r *Repo) RelateLaunched(farmerID, suggestionID string) error {
	_, err := r.c.Query(
		`RELATE $f->launched->$s;`,
		map[string]any{
			"f": ensureRecordID(farmerID, "farmer"),
			"s": ensureRecordID(suggestionID, "suggestion"),
		})
	return err
}

// --- audience / trend / seasonal_window -------------------------------

func (r *Repo) UpsertAudience(a *models.Audience) (string, error) {
	res, err := r.c.Query(`
	  LET $row = (SELECT id FROM audience WHERE slug = $slug LIMIT 1);
	  IF array::len($row) > 0 {
	    UPDATE $row[0].id MERGE $data;
	    RETURN meta::id($row[0].id);
	  } ELSE {
	    LET $created = (CREATE audience CONTENT $data);
	    RETURN meta::id($created[0].id);
	  }`, map[string]any{
		"slug": a.Slug,
		"data": map[string]any{
			"slug": a.Slug, "label": a.Label, "description": a.Description,
			"income_band": a.IncomeBand, "interests": a.Interests,
			"avg_basket_rub": a.AvgBasket,
		},
	})
	if err != nil {
		return "", err
	}
	var id string
	_ = decodeQueryRows(res, &id)
	return id, nil
}

func (r *Repo) ListAudiences() ([]models.Audience, error) {
	res, err := r.c.Query(`SELECT *, meta::id(id) AS id FROM audience ORDER BY label;`, nil)
	if err != nil {
		return nil, err
	}
	var out []models.Audience
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repo) UpsertTrend(t *models.Trend) (string, error) {
	res, err := r.c.Query(`
	  LET $row = (SELECT id FROM trend WHERE slug = $slug LIMIT 1);
	  IF array::len($row) > 0 {
	    UPDATE $row[0].id MERGE $data;
	    RETURN meta::id($row[0].id);
	  } ELSE {
	    LET $created = (CREATE trend CONTENT $data);
	    RETURN meta::id($created[0].id);
	  }`, map[string]any{
		"slug": t.Slug,
		"data": map[string]any{
			"slug": t.Slug, "title": t.Title, "description": t.Description,
			"source": t.Source, "strength": t.Strength,
			"started_at": t.StartedAt, "horizon_days": t.HorizonDays,
			"audience_tags": t.AudienceTags, "product_tags": t.ProductTags,
		},
	})
	if err != nil {
		return "", err
	}
	var id string
	_ = decodeQueryRows(res, &id)
	return id, nil
}

func (r *Repo) ListTrends() ([]models.Trend, error) {
	res, err := r.c.Query(
		`SELECT *, meta::id(id) AS id FROM trend ORDER BY strength DESC;`, nil)
	if err != nil {
		return nil, err
	}
	var out []models.Trend
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// RelateCovers links a seasonal_window to the event it covers.
func (r *Repo) RelateCovers(windowID, eventID string) error {
	_, err := r.c.Query(
		`DELETE covers WHERE in = $w AND out = $e;
		 RELATE $w->covers->$e;`,
		map[string]any{
			"w": ensureRecordID(windowID, "seasonal_window"),
			"e": ensureRecordID(eventID, "event"),
		})
	return err
}

// RelateInfluences trend→event with a strength weight.
func (r *Repo) RelateInfluences(trendID, eventID string, strength float64) error {
	_, err := r.c.Query(
		`DELETE influences WHERE in = $t AND out = $e;
		 RELATE $t->influences->$e SET strength = $s;`,
		map[string]any{
			"t": ensureRecordID(trendID, "trend"),
			"e": ensureRecordID(eventID, "event"),
			"s": strength,
		})
	return err
}

func (r *Repo) UpsertSeasonalWindow(w *models.SeasonalWindow) (string, error) {
	res, err := r.c.Query(`
	  LET $row = (SELECT id FROM seasonal_window WHERE product_concept = $c LIMIT 1);
	  IF array::len($row) > 0 {
	    UPDATE $row[0].id MERGE $data;
	    RETURN meta::id($row[0].id);
	  } ELSE {
	    LET $created = (CREATE seasonal_window CONTENT $data);
	    RETURN meta::id($created[0].id);
	  }`, map[string]any{
		"c": w.ProductConcept,
		"data": map[string]any{
			"label": w.Label, "product_concept": w.ProductConcept,
			"months": w.Months, "scope": w.Scope, "status": w.Status,
			"note": w.Note,
		},
	})
	if err != nil {
		return "", err
	}
	var id string
	_ = decodeQueryRows(res, &id)
	return id, nil
}

// --- embedding cache --------------------------------------------------

// EmbeddingCacheGet returns a cached vector for the given canonical text
// hash, or nil if the cache is cold. Used by cmd/embed to skip Gemini calls
// for texts we've already paid for.
func (r *Repo) EmbeddingCacheGet(key string) ([]float64, bool) {
	res, err := r.c.Query(
		`SELECT vector FROM embedding_cache WHERE key = $k LIMIT 1;`,
		map[string]any{"k": key})
	if err != nil {
		return nil, false
	}
	var rows []struct {
		Vector []float64 `json:"vector"`
	}
	_ = decodeQueryRows(res, &rows)
	if len(rows) == 0 || len(rows[0].Vector) == 0 {
		return nil, false
	}
	return rows[0].Vector, true
}

// EmbeddingCachePut writes/updates a cached vector keyed by content hash.
func (r *Repo) EmbeddingCachePut(key string, vec []float64) error {
	_, err := r.c.Query(`
	  LET $row = (SELECT id FROM embedding_cache WHERE key = $k LIMIT 1);
	  IF array::len($row) > 0 {
	    UPDATE $row[0].id MERGE { vector: $v };
	  } ELSE {
	    CREATE embedding_cache SET key = $k, vector = $v;
	  };`,
		map[string]any{"k": key, "v": floatSlice(vec)})
	return err
}

// --- embeddings -------------------------------------------------------

// SetEmbedding writes the float vector to the given record's `embedding` field.
// table must be one of: product, event, audience, trend, farmer.
func (r *Repo) SetEmbedding(table, id string, vec []float64) error {
	full := ensureRecordID(id, table)
	_, err := r.c.Query(
		`UPDATE $r SET embedding = $vec;`,
		map[string]any{"r": full, "vec": floatSlice(vec)})
	return err
}

// KnnEvents performs a vector KNN search over the event table using the
// HNSW index, optionally filtered by a date window. Returns up to k events
// ranked by cosine similarity.
//
// Uses Surreal's `<|k,COSINE|>` KNN operator. Falls back gracefully to a
// brute-force sort if the index isn't available — the caller can't tell.
func (r *Repo) KnnEvents(vec []float64, from, to time.Time, k int) ([]models.Event, error) {
	if len(vec) == 0 {
		return nil, fmt.Errorf("empty embedding")
	}
	if k <= 0 {
		k = 10
	}
	res, err := r.c.Query(
		`SELECT *, meta::id(id) AS id,
		        vector::similarity::cosine(embedding, $v) AS sim
		 FROM event
		 WHERE embedding IS NOT NONE
		   AND start_date <= $to AND end_date >= $from
		   AND embedding <|10,COSINE|> $v
		 ORDER BY sim DESC
		 LIMIT $k;`,
		map[string]any{"v": floatSlice(vec), "from": from, "to": to, "k": k})
	if err != nil {
		// Fallback for builds without HNSW (e.g. small dev DBs)
		return r.knnEventsFallback(vec, from, to, k)
	}
	var out []models.Event
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repo) knnEventsFallback(vec []float64, from, to time.Time, k int) ([]models.Event, error) {
	res, err := r.c.Query(
		`SELECT *, meta::id(id) AS id,
		        vector::similarity::cosine(embedding, $v) AS sim
		 FROM event
		 WHERE embedding IS NOT NONE
		   AND start_date <= $to AND end_date >= $from
		 ORDER BY sim DESC
		 LIMIT $k;`,
		map[string]any{"v": floatSlice(vec), "from": from, "to": to, "k": k})
	if err != nil {
		return nil, err
	}
	var out []models.Event
	if err := decodeQueryRows(res, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// TrendInfluenceByEventSlug returns the sum of (trend.strength × edge.strength)
// per event slug for trends still in their active horizon. One query.
func (r *Repo) TrendInfluenceByEventSlug() (map[string]float64, error) {
	res, err := r.c.Query(`
	  SELECT
	    out.slug AS slug,
	    math::sum(strength * in.strength) AS w
	  FROM influences
	  WHERE time::now() <= in.started_at + duration::from::days(in.horizon_days)
	  GROUP BY slug
	  FETCH in, out;`, nil)
	if err != nil {
		return nil, nil // non-fatal — engine treats nil as "no boost"
	}
	var rows []struct {
		Slug string  `json:"slug"`
		W    float64 `json:"w"`
	}
	_ = decodeQueryRows(res, &rows)
	out := make(map[string]float64, len(rows))
	for _, x := range rows {
		if x.W > 1 {
			x.W = 1
		}
		out[x.Slug] = x.W
	}
	return out, nil
}

// --- ai_memory --------------------------------------------------------

// AppendMemory stores one contextual-intelligence row + optionally a
// `references` edge into the related suggestion. Non-fatal on failure.
func (r *Repo) AppendMemory(m *models.AIMemory) error {
	farmer, err := r.ResolveFarmer(m.FarmerID)
	if err != nil {
		return err
	}
	var subject string
	if m.SubjectID != "" {
		// caller supplies "suggestion:abc" or just "abc" → assume suggestion if no colon
		if strings.Contains(m.SubjectID, ":") {
			subject = m.SubjectID
		} else {
			subject = "suggestion:" + m.SubjectID
		}
	}
	// Note: SurrealDB's RELATE statement does NOT accept index-into-array
	// expressions on the source side ($created[0].id parses as an idiom,
	// not as a record literal). Lift it into a flat $mid binding first.
	res, err := r.c.Query(`
	  LET $created = (CREATE ai_memory SET
	    farmer = $f, kind = $kind, subject = $subj, signal = $signal,
	    context = $ctx
	  );
	  LET $mid = $created[0].id;
	  IF $subj IS NOT NONE {
	    RELATE $mid->references->$subj;
	  };
	  RETURN meta::id($mid);
	`, map[string]any{
		"f":      farmer,
		"kind":   m.Kind,
		"subj":   subject,
		"signal": m.Signal,
		"ctx":    m.Context,
	})
	if err != nil {
		return err
	}
	var id string
	_ = decodeQueryRows(res, &id)
	m.ID = id
	return nil
}

// MemoryByKindCounts returns counts of recent memory rows per kind for a
// farmer. Used by the recommender to bias scoring.
func (r *Repo) MemoryByKindCounts(farmerID string, sinceDays int) (map[string]int, error) {
	full, err := r.ResolveFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	since := time.Now().AddDate(0, 0, -sinceDays)
	res, err := r.c.Query(
		`SELECT kind, count() AS n FROM ai_memory
		 WHERE farmer = $f AND created_at >= $since
		 GROUP BY kind;`,
		map[string]any{"f": full, "since": since})
	if err != nil {
		return nil, err
	}
	var rows []struct {
		Kind string `json:"kind"`
		N    int    `json:"n"`
	}
	_ = decodeQueryRows(res, &rows)
	out := make(map[string]int, len(rows))
	for _, x := range rows {
		out[x.Kind] = x.N
	}
	return out, nil
}

// EventBiasFromMemory returns a map[event_slug] -> bonus (0..0.3) based on
// past accepted/launched campaigns for that event. The recommender adds
// this to the matcher score before ranking.
func (r *Repo) EventBiasFromMemory(farmerID string, sinceDays int) (map[string]float64, error) {
	full, err := r.ResolveFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	since := time.Now().AddDate(0, 0, -sinceDays)
	res, err := r.c.Query(`
	  SELECT
	    subject.event.slug AS slug,
	    count() AS n
	  FROM ai_memory
	  WHERE farmer = $f
	    AND created_at >= $since
	    AND kind IN ["campaign_accepted","campaign_planned","campaign_launched","campaign_completed"]
	    AND subject IS NOT NONE
	  GROUP BY slug
	  FETCH subject.event;`,
		map[string]any{"f": full, "since": since})
	if err != nil {
		return nil, nil // memory bias is non-fatal
	}
	var rows []struct {
		Slug string `json:"slug"`
		N    int    `json:"n"`
	}
	_ = decodeQueryRows(res, &rows)
	out := map[string]float64{}
	for _, x := range rows {
		if x.Slug == "" {
			continue
		}
		// diminishing returns: 1 = 0.10, 3 = 0.20, 10+ = 0.30
		boost := 0.10 + 0.07*float64(x.N-1)
		if boost > 0.30 {
			boost = 0.30
		}
		if boost < 0.10 {
			boost = 0.10
		}
		out[x.Slug] = boost
	}
	return out, nil
}

// --- helpers ----------------------------------------------------------

// floatSlice converts to []any so marshalSurreal handles the array literal
// generically (Surreal accepts JSON arrays of numbers as array<float>).
func floatSlice(v []float64) []any {
	out := make([]any, len(v))
	for i, x := range v {
		out[i] = x
	}
	return out
}
