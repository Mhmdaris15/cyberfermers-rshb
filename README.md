# Свое Родное · Farmer Marketing Calendar

> AI-powered event marketing calendar for farmers on `svoe-rodnoe.ru`.
> Built for **Хакатон РСХБ.Цифра в НИЯУ МИФИ** (Case №1).

A production-grade MVP that ingests a farmer's catalog, matches SKUs against a curated event knowledge base (holidays, Orthodox calendar, themed weeks, seasonality), and uses **Gemini** to generate ready-to-launch multi-channel campaign assets — push, story, blog, recipe, chat-to-repeat-buyer, social — with a deterministic ROI engine on top.

```
React + Vite + TS  ◀──REST──▶  Go (Gin)  ◀──HTTP/SQL──▶  SurrealDB (Docker)
                                  │
                                  └──HTTPS──▶  Gemini API (structured JSON)
```

---

## Quick start (hybrid: Docker DB + native API + native Web)

**Prerequisites**

- Docker Desktop (only for SurrealDB)
- Go 1.22+
- Node 20+

**Setup**

```powershell
# 1. Configure env
cp .env.example .env
# Open .env and paste your GEMINI_API_KEY

# 2. Start the database
make db
# (or: docker compose up -d surrealdb)
```

**Three terminals from here:**

```powershell
# Terminal A — API server (port 8080)
make api

# Terminal B — Web app (port 5173)
make web

# Terminal C — one-time data load
make import         # loads farmers_sku.xlsx into SurrealDB
make seed           # seeds the curated event KB
make tag-products   # rule + Gemini tagging across all SKUs
```

Open `http://localhost:5173/farmer/10060/dashboard` → Экоферма ОГО-РОД demo.

### Without `make` (raw commands)

```powershell
# DB
docker compose up -d surrealdb

# API (any terminal, any directory — config auto-locates the repo root)
cd apps/api
go run ./cmd/server

# Web (separate terminal)
cd apps/web
npm install --no-audit --no-fund --legacy-peer-deps
npm run dev

# Seed (separate terminal, one-time)
cd apps/api
go run ./cmd/import
go run ./cmd/seed
go run ./cmd/tag-products
```

---

## Repo layout

```
svoe-rodnoe-calendar/
├── apps/
│   ├── web/                  React + Vite + TS + Tailwind + shadcn/ui
│   └── api/                  Go + Gin, SurrealDB HTTP client, Gemini
├── data/
│   ├── seed/events.yml       Curated event KB (40+ entries)
│   └── raw/                  Drop farmers_sku.xlsx here
├── infrastructure/
│   └── surrealdb/schema.surql
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEMO_SCRIPT.md
│   └── COVERAGE.md
├── docker-compose.yml        Only SurrealDB
├── Makefile
└── .env.example
```

---

## What is implemented

- **Catalog ETL** — `apps/api/cmd/import` reads `farmers_sku.xlsx`, normalizes 3,491 SKUs into SurrealDB.
- **Event KB** — `data/seed/events.yml`, 40+ events across 6 categories (state holidays, Orthodox, professional days, seasons, themed weeks, marketplace trends).
- **Tagger** — `internal/services/tagging` derives fine-grained tags (`easter`, `vegan`, `premium`, `gift`, `gourmet`, `honey`, `seasonal`, …) via Gemini in structured JSON, with a deterministic rule-based fallback.
- **Recommender** — `internal/services/recommendation`:
  - tag overlap → category fallback → embedding fallback
  - rank by ROI estimate
  - deterministic ROI engine with explicit assumptions
- **Content generator** — `internal/services/ai/gemini.go` renders channel-specific drafts (push / story / blog / recipe / chat / social) from a registry of versioned prompts.
- **Plan board** — Kanban over `proposed → planned → live → completed`.
- **Frontend** — dark futuristic agri-tech aesthetic: animated SVG calendar wheel, glass action cards, Framer Motion micro-interactions.

---

## Tech stack (anti-mainstream by design)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | Fastest cold start; native dev server with HMR |
| UI kit | TailwindCSS + shadcn/ui + Radix | Headless primitives, full design control |
| Motion | Framer Motion | Cinematic transitions; production-ready |
| Backend | Go + Gin | Tight binary, easy concurrency for fan-out LLM calls |
| DB driver | Direct HTTP `/sql` | SDK-free, version-stable, 150 LOC |
| Database | SurrealDB 2.x | Graph + document + SQL-ish queries; perfect for SKU↔event↔farmer fan-out |
| AI | Gemini 2.0 Flash | Cheap, fast, structured JSON via `responseSchema` |
| Deploy (dev) | Docker for DB only; native API + Web | Fastest iteration loop on Windows |

---

## Scoring → file map

| Rubric criterion | Where it lives |
|---|---|
| Relevance (3) | `data/seed/events.yml` (6 event types) + `internal/services/recommendation` |
| UX (3) | `apps/web/src/pages/Dashboard.tsx`, `Calendar.tsx`, glass card system |
| Completeness (3) | `docs/COVERAGE.md` matrix + 40+ events in the KB |
| Business value (3) | `internal/services/recommendation/roi.go` (deterministic, transparent) |
| Solution quality (6) | Matcher in `recommendation/match.go` + content registry in `services/ai/prompts.go` |
| Code/architecture (4) | Hexagonal split: handlers → services → repos; DTOs in `models/` |
| Additional functionality (4) | Subscription nudge, bundle generator, A/B copy, Telegram bot stub |
| Presentation (3) | `docs/DEMO_SCRIPT.md` + landing page |

---

## Make targets cheat sheet

```
make db             start SurrealDB container
make db-shell       open Surreal SQL REPL
make db-logs        tail Surreal logs
make db-stop        stop the container
make api            run Go API (port 8080)
make web            run Vite dev server (port 5173)
make import         load farmers_sku.xlsx
make seed           seed event KB
make tag-products   tag all SKUs (rules + Gemini)
make clean          wipe Surreal volume
```

---

## License

MIT. Built for the hackathon, but designed to outlive it.
