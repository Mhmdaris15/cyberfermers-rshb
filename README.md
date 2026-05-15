# Свое Родное · Farmer Marketing Calendar

> Календарь для событийного маркетинга на базе ИИ для фермеров в svoe-rodnoe.ru.
> Сделано для **Хакатон РСХБ.Цифра в НИЯУ МИФИ** (Case №1).

A production-grade MVP that ingests a farmer's catalog, matches SKUs against a curated event knowledge base (holidays, Orthodox calendar, themed weeks, seasonality), and uses **Gemini** to generate ready-to-launch multi-channel campaign assets — push, story, blog, recipe, chat-to-repeat-buyer, social — with a deterministic ROI engine on top.

> **SurrealDB-native architecture.** Graph + vector + realtime + AI memory, all in one engine. See [`docs/SURREALDB_ARCHITECTURE.md`](docs/SURREALDB_ARCHITECTURE.md) for the full breakdown.

> **Two environments, two compose files.** Local dev runs natively (API + Web) with SurrealDB in Docker. Production runs everything in containers. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the Cloudify-ready runbook.

```
React + Vite + TS  ◀──REST──▶  Go (Gin)  ◀──HTTP/SQL──▶  SurrealDB (Docker)
                                  │
                                  └──HTTPS──▶  Gemini API (structured JSON)
```

![Landing page — editorial dusk aesthetic, RU/EN i18n, animated seasonality ring](apps/web/public/images/landing-page.png)

---

## Screenshots

### Core surfaces

The farmer's command center. Dashboard with KPIs and action cards, a 40+ event calendar, an AI workspace with slash commands and save-as-to-any-channel, and a rich Kanban plan board with 4-tab card drawers.

| Dashboard | Calendar |
|:-:|:-:|
| ![Farmer dashboard with KPIs, action cards, and revenue forecast](apps/web/public/images/dashboard.png) | ![Curated event calendar — 40+ events across 6 categories](apps/web/public/images/calendar-month.png) |
| **Farmer dashboard** — KPIs, action cards, revenue forecast | **Calendar** — 40+ events, filters, trends |

| AI Workspace | Plan board (Kanban) |
|:-:|:-:|
| ![AI workspace with starter packs and slash commands](apps/web/public/images/ai-workspace-starter.png) | ![Kanban plan board: proposed → planned → live → done](apps/web/public/images/kanban-board.png) |
| **AI Workspace** — starter packs, `/story` `/blog` slash commands, save-as menu | **Plan board** — drag-and-drop with spring physics |

### Interactive demo & AI assistant

Public landing has a no-login interactive demo of the full 7-stage pipeline. Authenticated users get the conversational AI assistant.

| Interactive demo (public) | AI assistant (auth) |
|:-:|:-:|
| ![Interactive demo on landing — 7-stage stream, no login required](apps/web/public/images/interactive-demo.png) | ![AI assistant — conversational entry point with structured JSON outputs](apps/web/public/images/ai-assistant.png) |

### Content channels (Phases 4–8)

Six channels, each with its own production surface — not just tabs in a fan-out. Image-prompt + caption pairs for stories, two-pane blog writer, structured recipe editor, multi-platform social composer with carousel and per-platform preview, push composer with lock-screen mockup.

| Stories | Blog editor |
|:-:|:-:|
| ![Stories editor — image-prompt + caption pair, API-ready](apps/web/public/images/stories-editor.png) | ![Two-pane blog writer with markdown + live preview](apps/web/public/images/blog-editor.png) |
| **Stories** — image-prompt + caption, ready for Stories API | **Blog** — two-pane writer, 600–900 chars under JSON schema |

| Recipe editor | Social composer |
|:-:|:-:|
| ![Structured recipe editor with ingredients, steps, time, audience](apps/web/public/images/recipe-editor.png) | ![Multi-platform social editor with carousel and per-platform preview](apps/web/public/images/social-editor.png) |
| **Recipes** — structured ingredients, steps, time, audience | **Social** — TG / VK / Insta with per-platform char-limits |

| Recipe (detail) | Push composer |
|:-:|:-:|
| ![Recipe editor — structured fields detail view](apps/web/public/images/recipe-editor-2.png) | ![Push editor with iOS/Android lock-screen preview and urgency slider](apps/web/public/images/push-editor.png) |
| **Recipe (detail)** — schema-driven, not free text | **Push** — lock-screen preview, urgency, dispatch status |

### Plan board details (Phase 3)

A plan card is not a chip — it carries the whole campaign: ROI, channels, content, comments, activity log. SurrealDB holds the plan graph and content in a single engine.

| Plan card drawer | Plan card generator | ROI popover |
|:-:|:-:|:-:|
| ![Plan card drawer with 4 tabs: overview, content, comments, activity](apps/web/public/images/plan-card-drawer.png) | ![Plan card generator — six-channel parallel Gemini fan-out](apps/web/public/images/plan-card-generator.png) | ![ROI assumption popover — deterministic Go formula, hover to inspect](apps/web/public/images/roi-popover.png) |
| **4-tab card drawer** | **6-channel fan-out** | **ROI assumptions popover** |

### Admin (auth-gated)

JWT-less session auth with `RequireAuth` / `RequireAdmin` guards. Full admin panel for user creation and session revocation.

| Admin · Users | Admin · Sessions |
|:-:|:-:|
| ![Admin users table with side-sheet create](apps/web/public/images/admin-users.png) | ![Session management — grouped by user, revoke per-session](apps/web/public/images/session-management.png) |
| **Users** — table + side-sheet create | **Sessions** — grouped, revoke per-session |

### Architecture

![Animated architecture graph — six nodes, dashed data-flow edges, lives on the landing page](apps/web/public/images/aarchitecture-design.png)

Six nodes (Frontend / API / SurrealDB / Gemini / Recommender / Tagging), dashed animated data-flow edges, three annotated pipelines (embed · tag · planning). The deck's signature visual lives directly on the landing page — see `apps/web/src/components/landing/LandingArchitecture.tsx`.

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

## Internationalization (i18n)

The web app is wired for **Tolgee** with two supported locales: Russian (default) and English. Architecture supports adding more languages with no code changes — only translation files.

### How it works

- **Static bundles, zero runtime cost.** Locale files live at `apps/web/src/locales/{lang}.json` and are bundled at build time. No network call on first paint, no flash of untranslated content.
- **In-context editing in dev only.** If `VITE_TOLGEE_API_URL` + `VITE_TOLGEE_API_KEY` are set in dev, Tolgee's developer tools activate — alt-click any string in the browser to edit translations live against your Tolgee project. In production these env vars stay unset and the build is offline.
- **Language detection on first visit:** explicit localStorage (`svoe.lang`) → `navigator.language` prefix → fallback `ru`.
- **Persistence:** selected language stored in localStorage + cookie + `<html lang>` attribute.

### Switching language

The `<LanguageSwitcher />` component is mounted in:

- App shell topbar (auth'd app)
- Landing page nav
- Login form (compact variant)

### Adding a new translation key

1. Open both `apps/web/src/locales/ru.json` and `apps/web/src/locales/en.json`.
2. Add the same key in both files, using the namespaced dot notation:
   ```json
   "dashboard.metrics.sales": "..."
   ```
3. In the React code, use `useTranslate()`:
   ```tsx
   const { t } = useTranslate();
   <h2>{t("dashboard.metrics.sales")}</h2>
   ```

Namespaces in use: `common.*`, `nav.*`, `landing.*`, `auth.*`, `errors.*`, `lang.*`. Use the same convention (`module.section.key`) for new strings.

### Adding a new language

1. Create `apps/web/src/locales/<code>.json` with the same keys as the existing files.
2. In `apps/web/src/lib/i18n.ts`, append the code to `SUPPORTED_LANGS` and import the JSON into `staticData`.
3. Update `SHORT` and `lang.<code>` entries in the locale JSONs + `LanguageSwitcher.tsx`.

### Connecting Tolgee Cloud later

1. Create a project at https://app.tolgee.io (or self-hosted).
2. Import the existing `apps/web/src/locales/{ru,en}.json` into it.
3. Generate a dev API key.
4. Set `VITE_TOLGEE_API_URL` + `VITE_TOLGEE_API_KEY` in your local `.env`. The Tolgee dev tools light up automatically. Production builds without those env vars continue to use the static bundle.

### AI-generated content language

The axios client (`apps/web/src/lib/api.ts`) injects two headers on every request:

- `X-UI-Language` — the user's selected locale (`ru` or `en`)
- `Accept-Language` — same value, for HTTP-spec compatibility

The Go backend can read `X-UI-Language` on routes that build Gemini prompts (`/api/suggestions/:id/generate`, `/api/farmers/:id/chat`, etc.) and pin the output language accordingly. UI translations stay in Tolgee; only AI-generated bodies follow this header.

---

## License

MIT. Built for the hackathon, but designed to outlive it.
