package chat

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// =====================================================================
//   semantic — bridges the chat assistant to the existing 768-d HNSW
//   event index. Two responsibilities:
//
//     1. embedQuery(): convert an arbitrary user phrase like
//        "новогодние праздники", "НГ" or "что есть про мёд" into a
//        Gemini embedding, with an LRU-style query cache keyed on
//        the sha1 of the normalised text. Cache lives in the DB
//        `embedding_cache` table — reused across processes.
//
//     2. ensureEventEmbeddings(): one-shot lazy backfill. If an event
//        row has no `embedding` field yet, embed its title + tags +
//        themes + categories and write it back. Costs at most one
//        EmbedBatch call per cold start, then nothing.
//
//   Both functions are safe to call concurrently and degrade gracefully
//   (return nil error + empty results) when Gemini is unreachable.
// =====================================================================

const (
	queryCachePrefix = "chat-query:" // embedding_cache key prefix for user queries
	maxBackfill      = 60            // hard cap per backfill pass
)

func cacheKeyForQuery(q string) string {
	h := sha1.Sum([]byte(strings.ToLower(strings.TrimSpace(q))))
	return queryCachePrefix + hex.EncodeToString(h[:])
}

// embedQuery embeds a single user phrase. Caches the result keyed by
// the sha1 of the normalised phrase so the same prompt costs zero on
// the second turn.
func embedQuery(ctx context.Context, c ToolCtx, query string) ([]float64, error) {
	if c.AI == nil || c.AI.APIKey == "" {
		return nil, fmt.Errorf("no Gemini API key — semantic search disabled")
	}
	key := cacheKeyForQuery(query)
	if vec, ok := c.Repo.EmbeddingCacheGet(key); ok {
		return vec, nil
	}
	vecs, err := c.AI.EmbedBatch(ctx, []string{query})
	if err != nil {
		return nil, err
	}
	if len(vecs) == 0 || len(vecs[0]) == 0 {
		return nil, fmt.Errorf("empty embedding")
	}
	_ = c.Repo.EmbeddingCachePut(key, vecs[0])
	return vecs[0], nil
}

// eventCorpusText is the canonical string we embed per event — the
// surface that the user's free-form phrase has to match against.
func eventCorpusText(ev models.Event) string {
	parts := []string{ev.Title}
	if d := strings.TrimSpace(ev.TypeDetail); d != "" {
		parts = append(parts, d)
	}
	parts = append(parts, ev.Themes...)
	parts = append(parts, ev.Categories...)
	parts = append(parts, ev.ProductTags...)
	parts = append(parts, ev.Audience...)
	return strings.Join(parts, " · ")
}

// ensureEventEmbeddings backfills missing event embeddings. Returns the
// number of events newly embedded. Stops at maxBackfill per pass so a
// cold DB doesn't blow up the request budget — the next call picks up
// where the previous one stopped.
func ensureEventEmbeddings(ctx context.Context, c ToolCtx) (int, error) {
	if c.AI == nil || c.AI.APIKey == "" {
		return 0, nil
	}
	now := time.Now()
	evs, err := c.Repo.ListEventsBetween(now.AddDate(-1, 0, 0), now.AddDate(2, 0, 0))
	if err != nil {
		return 0, err
	}
	missing := make([]models.Event, 0, len(evs))
	for _, ev := range evs {
		if len(ev.Embedding) == 0 {
			missing = append(missing, ev)
			if len(missing) >= maxBackfill {
				break
			}
		}
	}
	if len(missing) == 0 {
		return 0, nil
	}
	texts := make([]string, len(missing))
	for i, ev := range missing {
		texts[i] = eventCorpusText(ev)
	}
	vecs, err := c.AI.EmbedBatch(ctx, texts)
	if err != nil {
		return 0, err
	}
	for i, ev := range missing {
		if i >= len(vecs) || len(vecs[i]) == 0 {
			continue
		}
		_ = c.Repo.SetEmbedding("event", ev.ID, vecs[i])
	}
	return len(missing), nil
}

// findEventsSemantic embeds the query, runs KNN over events, returns
// the top-k events with similarity scores. Window is widened on both
// sides of "now" so seasonal phrases ("новогодние праздники" in May)
// still match across the year boundary.
func findEventsSemantic(ctx context.Context, c ToolCtx, query string, k int) ([]semanticHit, error) {
	if k <= 0 {
		k = 5
	}
	// Best-effort backfill — only one event-batch per cold start.
	_, _ = ensureEventEmbeddings(ctx, c)

	vec, err := embedQuery(ctx, c, query)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	// Window: one year back, one year forward, then sort by similarity.
	evs, err := c.Repo.KnnEvents(vec, now.AddDate(-1, 0, 0), now.AddDate(1, 0, 0), k*2)
	if err != nil || len(evs) == 0 {
		return nil, err
	}
	out := make([]semanticHit, 0, k)
	for i, ev := range evs {
		if i >= k {
			break
		}
		out = append(out, semanticHit{Event: ev})
	}
	return out, nil
}

type semanticHit struct {
	Event models.Event
}
