# SurrealDB-native architecture · «КиберФермеры»

> One database does everything. No Pinecone. No Neo4j. No Redis Pub/Sub.
> SurrealDB is the **graph + vector + realtime + flexible-document** engine
> at the core of КиберФермеры's marketing intelligence platform.

This document explains *why* and *how* the system is architected around
SurrealDB's strongest features, not as a swap-in alternative to Postgres.

---

## 1 · The model in one picture

```
          ┌──────────┐  owns   ┌────────┐
          │  farmer  ├────────►│ product│
          └────┬─────┘         └────┬───┘
        launched│                    │ fits  (score, reasons)
                ▼                    ▼
          ┌───────────┐  triggers ┌───────┐  covers  ┌──────────────────┐
          │suggestion │◄──────────┤ event │◄─────────┤ seasonal_window  │
          └────┬──────┘           └───┬───┘          └──────────────────┘
       generated│                     │ influences
                ▼                     │
          ┌───────────────┐   ┌───────┴────────┐
          │generated_content│   │     trend      │
          └─────────────────┘   └───┬────────────┘
                                   │ derived_from
                                   ▼
                            ┌──────────┐  references
                            │ai_memory │◄──────────────────▶ suggestion
                            └──────────┘
                              ▲
                              │
                            farmer behavior
                            (accept / launch / regenerate)
```

Every arrow above is an actual `RELATE`-backed edge table in
`infrastructure/surrealdb/schema.surql`. Edges carry their own metadata
(`fits.score`, `influences.strength`, `launched.launched_at`), are
indexable, queryable, and traversable in both directions.

---

## 2 · Why a single SurrealDB instance replaces 4 specialised stores

| Capability | Conventional stack | КиберФермеры stack |
|---|---|---|
| Typed graph relationships | Neo4j / TigerGraph | `DEFINE TABLE … TYPE RELATION FROM … TO …` |
| Vector similarity search | Pinecone / Weaviate | `vector::similarity::cosine(...)` + `<\|k,COSINE\|>` over `HNSW` |
| Realtime event streams | Redis Pub/Sub + WS gateway | `LIVE SELECT … FROM` (bridged here via SSE) |
| Flexible JSON for AI outputs | Postgres JSONB | `DEFINE FIELD … FLEXIBLE TYPE option<object>` |
| Cardinality-1 ownership | Foreign keys | `record<farmer>` links — coexist with edges |
| Time-windowed aggregation | + ClickHouse | `GROUP BY … FETCH …` over typed records |

The point isn't that SurrealDB beats every one of those individually —
it's that **a hackathon stack with four stores is unmaintainable**, and
the single-engine approach gives us one schema, one query language, one
deployment artefact.

---

## 3 · Graph, in code

### 3a · How an edge is emitted

```go
// During catalog import — alongside the record-link field.
i.Repo.EnsureOwns(farmerRec, productID)

// After the recommender scores a (product, event) pair:
i.Repo.UpsertFits(productID, eventID, score, reasons)
```

```surql
DEFINE TABLE fits TYPE RELATION FROM product TO event SCHEMAFULL;
DEFINE FIELD score        ON fits TYPE float DEFAULT 0.0;
DEFINE FIELD reasons      ON fits TYPE array<string> DEFAULT [];
DEFINE FIELD computed_at  ON fits TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_fits_score ON fits COLUMNS score;
```

### 3b · How a graph query reads

```surql
-- Top 5 events the farmer's products fit best (uses fits.score index)
SELECT
  out.title AS event,
  in.name   AS product,
  score, reasons
FROM fits
WHERE in IN (SELECT VALUE id FROM product WHERE farmer = farmer:abc)
ORDER BY score DESC LIMIT 5
FETCH in, out;

-- Trends influencing currently upcoming events (still in horizon)
SELECT
  out.slug AS event,
  math::sum(strength * in.strength) AS w
FROM influences
WHERE time::now() <= in.started_at + duration::from::days(in.horizon_days)
GROUP BY event
FETCH in, out;
```

The recommender uses both of these styles in `services/recommendation`
and `db/graph.go`.

---

## 4 · Vector layer

Each semantic-bearing node has an `embedding` column and a vector index:

```surql
DEFINE FIELD embedding   ON product  TYPE option<array<float>>;
DEFINE INDEX idx_product_vec ON product FIELDS embedding HNSW DIMENSION 768 DIST COSINE;
-- same for event, audience, trend, farmer
```

The offline `cmd/embed` populates these by calling
**Gemini `text-embedding-004`** (768-d) on a curated text view of each
record (`category + name + description` for products, `title + themes +
audience_labels` for events, …).

KNN search at request time:

```surql
SELECT *,
       vector::similarity::cosine(embedding, $v) AS sim
FROM event
WHERE embedding IS NOT NONE
  AND start_date <= $to AND end_date >= $from
  AND embedding <|10,COSINE|> $v
ORDER BY sim DESC LIMIT 10;
```

The `<|k,COSINE|>` operator engages the HNSW index for sub-millisecond
KNN lookup. If the index is unavailable (cold DB), the same query falls
through to a brute-force scan — implemented in `repo.knnEventsFallback`.

In the recommender, vector similarity composes with tag overlap:

```go
// services/recommendation/boost.go
matches = ApplyBoosts(matches, ev, trendInfluence, memoryBias)
// → score += cosine(product.embedding, event.embedding) * 0.5  (if both exist)
```

---

## 5 · Realtime layer

The wire format the FE consumes is **Server-Sent Events** at
`GET /api/farmers/:id/stream`. The current v1 backend polls the DB at a
fixed cadence (1.5 s) and emits only when the JSON snapshot changes.

```
event: plan
data: { "proposed": [...], "planned": [...], "live": [...], "completed": [...] }

event: suggestions
data: [ { "id": "…", "score": 8.4, … }, … ]
```

The v2 upgrade swaps the ticker for a persistent WebSocket connection
to SurrealDB's `/rpc` endpoint and registers a `LIVE SELECT … FROM
plan_card WHERE farmer = farmer:abc`. SurrealDB pushes diff events on
that subscription; the SSE handler forwards them to the FE.

The **same FE code consumes both versions**. The contract is the
event names + payload shape, not the upstream transport.

---

## 6 · AI memory — contextual intelligence loop

`ai_memory` is a normal SCHEMAFULL table with `references` edges back to
the suggestion that produced it. Whenever a farmer accepts / moves /
launches a card, the plan service writes one row:

```go
// services/plan/plan.go
s.Repo.AppendMemory(&models.AIMemory{
    FarmerID:  farmerID,
    Kind:      "campaign_" + column,        // proposed | planned | live | completed
    SubjectID: suggestion.ID,
    Signal:    memorySignal[column],         // 0.05 → 1.00 by column
    Context:   map[string]any{"event_id": …},
})
```

The recommender reads it back via `EventBiasFromMemory`:

```surql
SELECT
  subject.event.slug AS slug,
  count() AS n
FROM ai_memory
WHERE farmer = $f
  AND created_at >= $since
  AND kind IN ["campaign_accepted","campaign_planned","campaign_launched","campaign_completed"]
  AND subject IS NOT NONE
GROUP BY slug
FETCH subject.event;
```

For each matched event, `slug` → `0.10..0.30` boost is added to its
score with diminishing returns. The longer the farmer uses the system,
the more biased recommendations become toward what *that farmer*
actually picks — a personalisation loop entirely inside SurrealDB.

---

## 7 · Hybrid schema strategy

We deliberately mix **SCHEMAFULL** and **FLEXIBLE**:

| Layer | Mode | Reason |
|---|---|---|
| Domain core (farmer / product / event / audience / trend / campaign) | SCHEMAFULL | Stable contract; FE / API depend on field shapes |
| LLM outputs (`generated_content.body`) | FLEXIBLE TYPE object | Schema differs per channel (push has title/body, recipe has steps/ingredients) |
| `predicted_lift`, `promo`, `product_reasons`, `signals` | FLEXIBLE | Scoring model evolves between deploys; FE renders generically |
| `ai_memory.context` | FLEXIBLE option<object> | Different memory kinds carry different evidence shapes |

This combination is **only sensible inside one engine**. In a Postgres
+ Pinecone + Neo4j world the SCHEMAFULL / SCHEMALESS split lives across
three migration histories. Here it's one file.

---

## 8 · Indexes the recommender actually uses

```surql
DEFINE INDEX idx_event_dates    ON event   COLUMNS start_date, end_date;
DEFINE INDEX idx_event_vec      ON event   FIELDS embedding HNSW DIMENSION 768 DIST COSINE;
DEFINE INDEX idx_product_vec    ON product FIELDS embedding HNSW DIMENSION 768 DIST COSINE;
DEFINE INDEX idx_fits_score     ON fits    COLUMNS score;
DEFINE INDEX idx_sug_rank       ON suggestion COLUMNS farmer, score;
DEFINE INDEX idx_memory_farmer  ON ai_memory COLUMNS farmer, created_at;
DEFINE INDEX idx_pt_tag         ON product_tag COLUMNS tag;
DEFINE INDEX idx_trend_strength ON trend COLUMNS strength;
```

Every index above is hit by at least one query in `services/`. The HNSW
indexes are the heart of the vector layer; the rest power
date-windowed traversals and ranking.

---

## 9 · Runbook

```bash
# 0. start the DB
docker compose up -d surrealdb

# 1. import farmers + products + emit `owns` edges
.\dev.ps1 import

# 2. seed events, audiences, trends, seasonal windows (+ influences, covers edges)
.\dev.ps1 seed

# 3. rule-based tagging (cheap, free, fast)
.\dev.ps1 tag

# 4. populate vector embeddings (Gemini text-embedding-004)
cd apps/api && go run ./cmd/embed --target=all

# 5. run the API — the recommender now composes:
#      tag overlap + category fallback + lexical themes
#    + trend influence (graph)
#    + ai_memory bias  (graph)
#    + cosine(product, event) (vector)
.\dev.ps1 api
```

---

## 10 · For the deck

One sentence: **"We didn't bolt on graph and vector to a relational
database — we built the entire recommendation engine on top of
SurrealDB's RELATE, HNSW vector indexes, and LIVE queries, and the
result is a marketing-intelligence platform with one engine instead
of four."**

Three bullets for follow-up:

- **Edges carry the algorithm.** `fits` stores the computed score and
  human-readable reasons; judges can `SELECT * FROM fits ORDER BY score
  DESC` and see the exact recommender output.
- **Vectors live next to records, not in a sidecar.** The same row that
  has `name` and `category` also has the 768-d Gemini embedding —
  joined-free.
- **The contextual loop is one table.** Every farmer action becomes an
  `ai_memory` row; the recommender reads it back. No analytics
  pipeline, no separate ML stack.
