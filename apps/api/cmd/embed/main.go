package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/config"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/ai"
)

// =====================================================================
//   cmd/embed — cost-optimised embedding pipeline.
//
//   Strategy:
//     1. SKIP rows whose canonical text view hash is already in
//        embedding_cache. This is the biggest cost cut: identical
//        re-runs become zero API calls.
//     2. BATCH the remaining texts via Gemini batchEmbedContents
//        (100 per HTTP call). 3,491 products → 35 calls instead of 3,491.
//     3. DEFAULT target = event,audience,trend only (~50 rows). Products
//        are opt-in via --target=product or --target=all.
//
//   Result on a typical re-run with no schema changes: 0 API calls.
//   First-time full embed: ~40 calls (down from ~3,500).
// =====================================================================

const (
	batchSize       = 100  // Gemini batchEmbedContents cap
	hashVersion     = "v1" // bump to invalidate the cache on prompt/format change
)

func main() {
	target := flag.String("target", "event,audience,trend",
		"comma list of: product,event,audience,trend (or 'all'). "+
			"product is OFF by default to protect billing.")
	force := flag.Bool("force", false, "re-embed rows that already have a vector")
	flag.Parse()

	cfg := config.Load()
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	dbc, err := db.New(cfg.SurrealURL, cfg.SurrealUser, cfg.SurrealPass, cfg.SurrealNS, cfg.SurrealDB)
	if err != nil {
		log.Fatal().Err(err).Msg("surreal connect")
	}
	defer dbc.Close()

	aiClient := ai.NewClient(cfg.GeminiKey, cfg.GeminiModel, cfg.GeminiEmbed)
	if aiClient.APIKey == "" {
		log.Fatal().Msg("GEMINI_API_KEY required for embedding")
	}
	repo := db.NewRepo(dbc)

	rpm := envInt("EMBED_RATE_LIMIT_PER_MIN", 60)
	tick := time.NewTicker(time.Minute / time.Duration(maxInt(rpm, 1)))
	defer tick.Stop()

	ctx := context.Background()
	targets := parseTargets(*target)
	totalAPICalls := 0
	totalRowsEmbedded := 0
	totalCacheHits := 0

	for _, tbl := range targets {
		rows, err := loadRows(repo, tbl, *force)
		if err != nil {
			log.Warn().Err(err).Str("table", tbl).Msg("load rows")
			continue
		}
		if len(rows) == 0 {
			log.Info().Str("table", tbl).Msg("nothing to embed (all have vectors)")
			continue
		}

		// --- cache pass ----------------------------------------------------
		// For each row, compute hash(canonical_text). If cache has it, write
		// the cached vector directly to the row and drop it from the work set.
		work := rows[:0]
		hits := 0
		for _, r := range rows {
			h := hashText(r.text)
			if v, ok := repo.EmbeddingCacheGet(h); ok {
				if err := repo.SetEmbedding(tbl, r.id, v); err == nil {
					hits++
				}
			} else {
				r.hash = h
				work = append(work, r)
			}
		}
		log.Info().
			Str("table", tbl).
			Int("total", len(rows)).
			Int("cache_hits", hits).
			Int("to_embed", len(work)).
			Msg("cache pass")
		totalCacheHits += hits

		// --- batched embed pass --------------------------------------------
		var written atomic.Int64
		for i := 0; i < len(work); i += batchSize {
			end := i + batchSize
			if end > len(work) {
				end = len(work)
			}
			chunk := work[i:end]
			texts := make([]string, len(chunk))
			for j, r := range chunk {
				texts[j] = r.text
			}
			<-tick.C // throttle batches, not individual rows
			vectors, err := aiClient.EmbedBatch(ctx, texts)
			if err != nil {
				log.Warn().Err(err).Str("table", tbl).Int("batch_start", i).Msg("batch embed failed")
				continue
			}
			totalAPICalls++
			if len(vectors) != len(chunk) {
				log.Warn().Int("got", len(vectors)).Int("want", len(chunk)).Msg("vector count mismatch")
			}
			for j, vec := range vectors {
				if j >= len(chunk) {
					break
				}
				if len(vec) == 0 {
					continue
				}
				_ = repo.SetEmbedding(tbl, chunk[j].id, vec)
				_ = repo.EmbeddingCachePut(chunk[j].hash, vec)
				written.Add(1)
			}
		}
		n := int(written.Load())
		totalRowsEmbedded += n
		log.Info().
			Str("table", tbl).
			Int("embedded", n).
			Int("batches", (len(work)+batchSize-1)/batchSize).
			Msg("complete")
	}

	log.Info().
		Int("api_calls", totalAPICalls).
		Int("rows_embedded", totalRowsEmbedded).
		Int("cache_hits", totalCacheHits).
		Msg("=== embed summary ===")
}

// =====================================================================
//   Per-table loaders
// =====================================================================

type rowToEmbed struct {
	id, text, hash string
}

func loadRows(r *db.Repo, table string, force bool) ([]rowToEmbed, error) {
	var sql string
	if force {
		switch table {
		case "product":
			sql = `SELECT meta::id(id) AS id, name, description, category FROM product;`
		case "event":
			sql = `SELECT meta::id(id) AS id, title, themes, audience, type_detail FROM event;`
		case "audience":
			sql = `SELECT meta::id(id) AS id, label, description, interests FROM audience;`
		case "trend":
			sql = `SELECT meta::id(id) AS id, title, description, product_tags, audience_tags FROM trend;`
		default:
			return nil, fmt.Errorf("unknown table: %s", table)
		}
	} else {
		switch table {
		case "product":
			sql = `SELECT meta::id(id) AS id, name, description, category FROM product WHERE embedding IS NONE;`
		case "event":
			sql = `SELECT meta::id(id) AS id, title, themes, audience, type_detail FROM event WHERE embedding IS NONE;`
		case "audience":
			sql = `SELECT meta::id(id) AS id, label, description, interests FROM audience WHERE embedding IS NONE;`
		case "trend":
			sql = `SELECT meta::id(id) AS id, title, description, product_tags, audience_tags FROM trend WHERE embedding IS NONE;`
		default:
			return nil, fmt.Errorf("unknown table: %s", table)
		}
	}
	res, err := r.Raw(sql, nil)
	if err != nil {
		return nil, err
	}
	switch table {
	case "product":
		var rows []struct {
			ID, Name, Description, Category string
		}
		// JSON-tag less fields work because Surreal returns the same names.
		if err := db.DecodeRows(res, &rows); err != nil {
			return nil, err
		}
		out := make([]rowToEmbed, 0, len(rows))
		for _, x := range rows {
			out = append(out, rowToEmbed{id: x.ID, text: productText(x.Name, x.Description, x.Category)})
		}
		return out, nil
	case "event":
		var rows []struct {
			ID         string   `json:"id"`
			Title      string   `json:"title"`
			TypeDetail string   `json:"type_detail"`
			Themes     []string `json:"themes"`
			Audience   []string `json:"audience"`
		}
		if err := db.DecodeRows(res, &rows); err != nil {
			return nil, err
		}
		out := make([]rowToEmbed, 0, len(rows))
		for _, x := range rows {
			out = append(out, rowToEmbed{id: x.ID, text: eventText(x.Title, x.TypeDetail, x.Themes, x.Audience)})
		}
		return out, nil
	case "audience":
		var rows []struct {
			ID          string   `json:"id"`
			Label       string   `json:"label"`
			Description string   `json:"description"`
			Interests   []string `json:"interests"`
		}
		if err := db.DecodeRows(res, &rows); err != nil {
			return nil, err
		}
		out := make([]rowToEmbed, 0, len(rows))
		for _, x := range rows {
			out = append(out, rowToEmbed{id: x.ID, text: audienceText(x.Label, x.Description, x.Interests)})
		}
		return out, nil
	case "trend":
		var rows []struct {
			ID           string   `json:"id"`
			Title        string   `json:"title"`
			Description  string   `json:"description"`
			ProductTags  []string `json:"product_tags"`
			AudienceTags []string `json:"audience_tags"`
		}
		if err := db.DecodeRows(res, &rows); err != nil {
			return nil, err
		}
		out := make([]rowToEmbed, 0, len(rows))
		for _, x := range rows {
			out = append(out, rowToEmbed{id: x.ID, text: trendText(x.Title, x.Description, x.ProductTags, x.AudienceTags)})
		}
		return out, nil
	}
	return nil, nil
}

// =====================================================================
//   Canonical text views — what we hash + embed
// =====================================================================

func productText(name, desc, category string) string {
	return strings.TrimSpace(fmt.Sprintf(
		"Категория: %s. Товар: %s. Описание: %s",
		category, name, truncate(desc, 240),
	))
}
func eventText(title, detail string, themes, audience []string) string {
	parts := []string{title}
	if detail != "" {
		parts = append(parts, "Тип: "+detail)
	}
	if len(themes) > 0 {
		parts = append(parts, "Темы: "+strings.Join(themes, ", "))
	}
	if len(audience) > 0 {
		parts = append(parts, "Аудитория: "+strings.Join(audience, ", "))
	}
	return strings.Join(parts, ". ")
}
func audienceText(label, desc string, interests []string) string {
	parts := []string{label}
	if desc != "" {
		parts = append(parts, desc)
	}
	if len(interests) > 0 {
		parts = append(parts, "Интересы: "+strings.Join(interests, ", "))
	}
	return strings.Join(parts, ". ")
}
func trendText(title, desc string, pTags, aTags []string) string {
	parts := []string{title, truncate(desc, 200)}
	if len(pTags) > 0 {
		parts = append(parts, "Товары: "+strings.Join(pTags, ", "))
	}
	if len(aTags) > 0 {
		parts = append(parts, "Аудитория: "+strings.Join(aTags, ", "))
	}
	return strings.Join(parts, ". ")
}

// hashText turns a canonical text view into a stable cache key. Includes a
// hashVersion prefix so we can invalidate everything by bumping the const
// when the text format changes.
func hashText(s string) string {
	sum := sha256.Sum256([]byte(s))
	return "emb:" + hashVersion + ":" + hex.EncodeToString(sum[:])
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func parseTargets(s string) []string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "all" {
		return []string{"audience", "trend", "event", "product"}
	}
	if s == "" {
		return []string{"audience", "trend", "event"}
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func envInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		var n int
		for _, ch := range v {
			if ch < '0' || ch > '9' {
				return def
			}
			n = n*10 + int(ch-'0')
		}
		if n > 0 {
			return n
		}
	}
	return def
}
func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
