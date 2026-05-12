# Architecture

## Overview

```
                        ┌─────────────────────────────┐
                        │   Browser (React + Vite)    │
                        │   tanstack-query · framer    │
                        └──────────────┬──────────────┘
                                       │  REST / JSON
                                       ▼
                        ┌─────────────────────────────┐
                        │     Go API (Gin)            │
                        │ ┌────────────────────────┐  │
                        │ │ handlers/              │  │
                        │ ├────────────────────────┤  │
                        │ │ services/              │  │
                        │ │   • ai/        Gemini  │  │
                        │ │   • events/    KB load │  │
                        │ │   • tagging/   rules+AI│  │
                        │ │   • recommendation/    │  │
                        │ │   • catalog/   xlsx ETL│  │
                        │ │   • plan/      kanban  │  │
                        │ ├────────────────────────┤  │
                        │ │ db/  Surreal driver    │  │
                        │ └────────────────────────┘  │
                        └──────┬──────────────────┬────┘
                               │ WebSocket RPC    │ HTTPS
                               ▼                  ▼
                  ┌────────────────────┐  ┌────────────────┐
                  │   SurrealDB 2.x    │  │   Gemini API   │
                  │  rshb / svoe_rod…  │  │  2.0-flash     │
                  │  tables: farmer,   │  │  + embeddings  │
                  │  product, event,   │  │                │
                  │  suggestion, plan…  │  └────────────────┘
                  └────────────────────┘
```

## Module map

| Path | Responsibility |
|---|---|
| `cmd/server`       | HTTP entrypoint, dependency wiring |
| `cmd/import`       | XLSX → SurrealDB ETL |
| `cmd/seed`         | events.yml → event table |
| `cmd/tag-products` | rule + Gemini tagging across the catalog |
| `internal/config`  | env loader (12-factor) |
| `internal/db`      | Surreal client + thin repo facade |
| `internal/models`  | domain DTOs (single source of truth) |
| `internal/handlers`| route registration, request → service mapping |
| `internal/services/ai`              | Gemini REST client + prompt registry + content fan-out |
| `internal/services/events`          | KB loader (YAML → models.Event) |
| `internal/services/tagging`         | rules + LLM tag pipeline |
| `internal/services/recommendation`  | matcher + ROI engine |
| `internal/services/plan`            | plan-board CRUD |
| `internal/services/catalog`         | xlsx ETL |
| `internal/middleware`               | request logger, recovery |

## Data model (SurrealDB)

`farmer` → `product` → `product_tag` (edge to tag strings)
`event`  (curated KB)
`suggestion` (farmer × event × matched SKUs + ROI projection + promo)
`generated_content` (per channel × variant for a suggestion)
`plan_card` (kanban card pointing at a suggestion)
`embedding_cache` (key → vector — for cold-start tagging similarity)

Full DDL in `infrastructure/surrealdb/schema.surql`.

## Recommendation pipeline (one HTTP call)

```
GET /api/farmers/:id/calendar?from=&to=
        │
        ▼
1. load farmer
2. load farmer's products (with tags)
3. load events overlapping [from, to]
4. for each event:
      a. MATCH       — tag overlap → category → lexical fallback;
                       hard bans for fasting / vegan weeks.
      b. CHANNELS    — intersect event.channels with farmer.channels.
      c. PROMO       — rule-based (discount + code + bundle).
      d. ROI         — deterministic formula with named assumptions.
5. rank by Δorders, cap at top-5 SKUs per event.
6. return { events, suggestions }.
```

## Content generation (fan-out)

```
POST /api/suggestions/:id/generate { channels }
        │
        ▼
   ╔═══════════════════════════════════════╗
   ║   For each requested channel:         ║
   ║   ─ build prompt + JSON schema        ║
   ║   ─ call Gemini in parallel goroutine ║
   ║   ─ fallback to deterministic copy    ║
   ║     on error (demo stays live).       ║
   ╚═══════════════════════════════════════╝
        │
        ▼
   UPSERT generated_content (suggestion, channel, variant)
```

## Why these choices

- **Go + Gin** — tiny static binary, easy concurrency for the Gemini fan-out, predictable cold-start in Docker.
- **SurrealDB** — single store handles documents (event KB) and graph-ish edges (`farmer→product→tag`) without two engines. Strict schemas keep migrations honest; record IDs are stable.
- **Gemini structured JSON** — Gemini's `responseSchema` enforces the shape on the server side; no manual parser hardening.
- **Vite + React + TS** — fastest cold-start dev loop; tree-shakable.
- **Tailwind + shadcn primitives** — full visual control without a 200kb component library.
- **Framer Motion + raw SVG seasonality ring** — distinctive visual identity. Charts come from a library; the ring is ours.
- **Docker Compose** — judge demo runs with `docker compose up`. Zero local Go/Node required.

## Determinism / cost guarantees

- The ROI engine is pure Go. No LLM in the money path.
- Tagging tries deterministic rules first; LLM is skipped if rules produced ≥3 tags.
- Content generation is cached in `generated_content` keyed by `(suggestion, channel, variant)`. Re-opening a suggestion never re-pays the LLM.

## Extending

- **Other LLM providers**: swap `internal/services/ai/gemini.go`. The signature `(system, user, schema, out)` is provider-agnostic.
- **More events**: append to `data/seed/events.yml`. Re-run `./bin/seed`.
- **Other matchers**: drop a new strategy under `internal/services/recommendation` and chain it in `match.go`.
- **Telegram bot stub** (future): subscribe to `plan_card.column=live` events and post via a webhook.
