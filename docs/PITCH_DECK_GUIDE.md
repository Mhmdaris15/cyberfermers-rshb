# Pitch Deck Preparation Guide — Своё Родное Calendar

> **Audience for this document:** the teammate/designer building the final pitch deck, and the presenter(s) delivering it.
> **What this is:** a blueprint, storytelling spine, slide-by-slide spec, demo script, asset checklist, and visual direction guide — all grounded in features that are *actually implemented* in this repository.
> **What this is NOT:** a slide deck. No `.pptx`, no Canva file, no Figma export. Use this as the source of truth and build the deck manually.

---

## 0. How to use this guide

1. Read sections 1–3 first to absorb the story.
2. Use section 4 as the feature inventory — every claim in the deck must trace back to a row here.
3. Use section 6 to rehearse the live demo before designing the slide that introduces it.
4. Use section 7 to gather screenshots *before* opening the design tool — never go back-and-forth.
5. Use section 8 to keep visual decisions consistent. The deck must look like the same product as the landing page.

---

## 1. Executive Summary

### Elevator pitch (one line)

> **«Своё Родное Calendar» — это AI-маркетолог для 10 000 российских фермеров: он смотрит на каталог, праздничный календарь и сезонные тренды, и за 5 секунд собирает кампанию по 6 каналам с предсказанной выручкой.»**

EN variant:
> *"Svoe Rodnoe Calendar is an AI marketer for 10,000 Russian farmers — it reads your catalog, the holiday calendar, and seasonal trends, and assembles a six-channel campaign with a forecasted revenue lift in under five seconds."*

### Core innovation

Not "another GPT wrapper". The differentiator is **a hybrid system**:

- **Deterministic ROI engine** (pure Go, no LLM) computes the money — judges can trust the numbers.
- **Gemini 2.5 Flash** generates *only* the creative — push, story, blog, recipe, chat, social — under a strict JSON schema.
- **SurrealDB** unifies document + graph + 768-d vector storage in one engine, so we ship one container instead of three.
- **Real catalog ingestion** — 3,491 SKU, 65 farmers, 40+ curated events, 11 edge types, 158 AI-memory signals.

### Why it matters

Russian agri-commerce (РСХБ.Цифра, «Своё Родное» marketplace) loses repeat orders not because the product is bad — because farmers are not marketers. The deck must keep returning to one truth: **we are not selling AI; we are selling time and recurring revenue back to farmers who don't have a marketing team.**

### Positioning hierarchy (use in this order)

1. Working product → 2. Real data → 3. AI value → 4. Architecture → 5. Roadmap.
Never invert. Hackathon decks die when they lead with architecture.

---

## 2. Overall Storytelling Flow

Four narrative tracks run in parallel. Every slide should serve at least two.

### 2.1 Emotional narrative

A farmer, alone at a laptop on a Tuesday evening, doesn't know that Med Spas (Медовый Спас) is in nine days and that "fermentation" is up 24% in their region's search trends. They miss the window. We make sure they don't.

**What judges should feel:**
- Slide 1–3: *recognition* ("yes, this is a real problem we know exists").
- Slide 4–7: *surprise* ("the system actually does the thing, and the UI is real").
- Slide 8–10: *credibility* ("they thought about cost, fallback, deployment").
- Slide 11–13: *ambition* ("this scales beyond hackathon").
- Closing: *trust* ("this team would actually ship this on Monday").

### 2.2 Investor/judge narrative

Frame it as **execution risk eliminated**. Most pitches at hackathons promise. This one demonstrates. The argument is:

- We did the unglamorous work — ETL, schemas, deployment, auth, i18n.
- The LLM is a *component*, not the system. If Gemini goes down at 2pm, the demo still runs.
- Cost is bounded — embedding once, fanning out structured JSON, no chat-style token explosions.

### 2.3 Technical narrative

Three technical claims earn the right to deeper questions:

1. **Hybrid retrieval** — tag overlap → category fallback → KNN on 768-d HNSW index. (Show one slide.)
2. **Deterministic money path** — ROI is named-assumption math, not a vibe from a model. (Show one slide.)
3. **Single-store polyglot** — SurrealDB handles document + graph + vector. (Show one slide.)

Stop there. Anything deeper goes to Q&A.

### 2.4 Demo narrative

The demo is the deck. Slides exist to *frame* the demo, then *defend* it after. Treat the live screen as slide #0. The 7-minute script in `docs/DEMO_SCRIPT.md` is the canonical version; section 6 below adapts it for stage timing.

### 2.5 What should stand out

| Dimension | What stands out |
|---|---|
| Business value | "+37% projected ROI lift per campaign", "65 farmers × 40 events = 2,600 marketing moments/quarter, fully automated" |
| Technical achievement | SurrealDB unification, deterministic ROI engine, 6-channel parallel Gemini fan-out, RU/EN i18n with X-UI-Language header, JWT-less auth |
| Execution quality | Coolify-deployed, Docker-composed, i18n in two languages, admin panel for user/session management, real catalog imported from XLSX |

---

## 3. Slide-by-Slide Structure

The recommended deck is **13 slides + appendix**. Total speaking time: **8 minutes** (5–6 talking, 2–3 demo). If you have 5 minutes, drop slides 10 and 12. If you have 10 minutes, expand slides 6 and 9.

> **Convention used below:**
> *Title* — what's on the slide header.
> *Purpose* — what this slide must achieve.
> *Talking points* — what the presenter says (bullets, not script).
> *Visuals* — what the designer puts on screen.
> *Animation* — only where it earns the runtime.
> *Screenshots* — exact captures from the app (see section 7).
> *Avoid* — the trap unique to this slide.
> *Tone* — emotional register.
> *Notes* — presenter cue.
> *→ next* — how to transition.

---

### Slide 1 — Title / Hero

- **Purpose:** First impression. Make the room quiet.
- **Talking points:**
  - Project name + tagline.
  - One sentence: "AI marketer for 10,000 Russian farmers."
  - Hackathon badge (РСХБ.Цифра).
- **Visuals:** Take a clean shot of `/` landing hero (Fraunces italic "у нас выходит" gradient line + seasonality ring on the right). Crop dark, no nav chrome. Add team names + date in a small footer.
- **Animation:** Static for slide 1. Save animations for slide 4.
- **Screenshots:** `landing/hero-fullbleed.png`
- **Avoid:** Logos of every tool used. Don't dilute the hero.
- **Tone:** Confident, editorial, quiet.
- **Notes:** Stand still for 4 seconds before speaking. Let the visual register.
- **→ next:** "But before I show you the product, let's look at the problem we're actually solving."

---

### Slide 2 — The Problem

- **Purpose:** Lock in the room's agreement that this is a real problem.
- **Talking points:**
  - 10,000 farmers on Своё Родное marketplace.
  - 20% repeat-order rate (vs. 45–60% benchmark in DTC food).
  - Farmers are not marketers. They miss every seasonal window — Easter, Med Spas, harvest, gift season.
  - Marketing agencies cost ₽80–150K/month. No farmer with 30 SKU can afford that.
- **Visuals:** Three stat blocks in a row. Use Fraunces for the numerals, IBM Plex Sans for the labels. Background: a faint grain texture. No icons — let the numbers carry.
- **Animation:** Stat numbers count up once on slide enter (200ms ease-out). Don't loop.
- **Screenshots:** None — pure typography.
- **Avoid:** Stock photos of farmers. Cliché. The numbers are the photo.
- **Tone:** Sober, slightly serious.
- **Notes:** Slow down on "they miss every seasonal window."
- **→ next:** "So we built something that does the missing job."

---

### Slide 3 — The Insight / Thesis

- **Purpose:** Plant the system thesis in one sentence before showing it.
- **Talking points:**
  - "AI doesn't sell. AI plans. The farmer still sells."
  - Two-part insight: (a) the calendar is a *retrieval* problem, (b) the campaign is a *generation* problem.
  - We treat them as different problems with different tools.
- **Visuals:** Diagram of two boxes — `[Calendar = retrieval]` on the left, `[Campaign = generation]` on the right, connected by a thin amber line labeled "structured JSON". Use the same line/box style as the landing's LandingArchitecture so the deck visually inherits from the product.
- **Animation:** Boxes fade in left → right with a 300ms stagger. Line draws after both boxes appear.
- **Screenshots:** None — designer builds this.
- **Avoid:** A bigger architecture diagram. Save it for slide 9.
- **Tone:** Intellectual, almost confident understatement.
- **→ next:** "Here's what that looks like in practice."

---

### Slide 4 — Product Hero / Landing snapshot

- **Purpose:** Show that the product exists and looks like a real product.
- **Talking points:**
  - Live URL (or QR code to the Coolify-hosted demo).
  - "Visit the landing. Russian by default. English is one click."
  - Mention the language switcher in passing — judges notice polish.
- **Visuals:** Two side-by-side crops of `/` landing — RU on the left, EN on the right. Same hero, different language. Watermark or hairline divider between them.
- **Animation:** Cross-fade between RU/EN on a 2.5s loop. Optional — only if the room has long attention.
- **Screenshots:** `landing/hero-ru.png`, `landing/hero-en.png` (matched viewport, dark theme, scroll position = top).
- **Avoid:** Mouse cursors in the screenshot. Browser chrome.
- **Tone:** Proud, light.
- **→ next:** "Let me show you what it actually does. Live."

---

### Slide 5 — Demo handoff slide (optional)

- **Purpose:** Pause point between slides and demo. Buys 5 seconds to alt-tab.
- **Talking points:** "Three minutes. Stay with me."
- **Visuals:** Single line of text in Fraunces italic, centered: "Демо · Live".
- **Animation:** None.
- **Screenshots:** None.
- **Avoid:** Anything that competes for attention while you're switching windows.
- **Tone:** Quiet, theatrical.
- **→ next:** Switch to live browser. Run the demo script (section 6).

> **Live demo block — 3 minutes. See section 6 for the exact path.**

---

### Slide 6 — How it works (3-step)

- **Purpose:** Compress the demo into a single rememberable diagram for anyone in the back row.
- **Talking points:**
  - Step 1: Match — farmer's SKUs ⨯ events ⨯ region.
  - Step 2: Generate — 6 channels in parallel, structured JSON.
  - Step 3: Plan — Kanban board with ROI projection per card.
  - "Everything you just saw was these three steps."
- **Visuals:** Reuse the `landing.how.*` section from `Landing.tsx` — three numbered cards with the lucide icons (Calendar, Bot, LineChart). Crop directly from `/` so the deck matches the product.
- **Animation:** Cards slide up on entry with a 50ms stagger (mirrors `LandingPage` motion).
- **Screenshots:** `landing/how-it-works-row.png` (capture the whole `#how` section).
- **Avoid:** Adding a 4th step. Three is the magic number; don't dilute.
- **Tone:** Pedagogical, calm.
- **→ next:** "Now let's open up the engine."

---

### Slide 7 — Real product features (catalog)

- **Purpose:** Show that the system is broad, not a single-page demo.
- **Talking points:**
  - "We didn't build one screen. We built the whole work surface a farmer's marketing team would have."
  - Quick gallery: Dashboard, AI workspace, Calendar, Plan (Kanban), Stories, Blogs, Recipes, Social, Push, Admin.
- **Visuals:** 3×3 or 2×5 grid of small screenshots, each 280×180px, with smallcaps caption underneath. Dim non-focused tiles slightly so the eye can scan.
- **Animation:** Stagger entrance left→right, 40ms apart.
- **Screenshots:** `app/dashboard.png`, `app/ai-workspace.png`, `app/calendar.png`, `app/plan-kanban.png`, `app/stories.png`, `app/blogs.png`, `app/recipes.png`, `app/social.png`, `app/push.png`, `app/admin-users.png`.
- **Avoid:** Captions longer than 4 words. Avoid pixel-noise — use 2× DPR captures.
- **Tone:** Confident inventory display.
- **→ next:** "All of this rides on one architectural decision we want to defend."

---

### Slide 8 — Why this is not just a GPT wrapper

- **Purpose:** Pre-empt the most common hackathon judge skepticism.
- **Talking points:**
  - "Three things separate us from a GPT wrapper."
  - **(1) Deterministic ROI** — money is computed in Go, not predicted by a model. Show the formula in one line: `Δorders = match × audience × channel × seasonality`.
  - **(2) Hybrid retrieval** — tags first, embeddings second, LLM only for creative. Cost is bounded.
  - **(3) Fallback path** — if Gemini fails, the deterministic copy still renders. The demo doesn't die mid-stage.
- **Visuals:** Three columns. Each column = a small icon + a 1-line claim + a 1-line proof. Use the same tone tokens as the app (leaf, amber, plum).
- **Animation:** None — let the text breathe.
- **Screenshots:** Optional: a tiny code snippet of the ROI formula (from `internal/services/recommendation/`). Don't show real code longer than 5 lines.
- **Avoid:** "We use LangChain" type sentences. Don't list libraries. List capabilities.
- **Tone:** Slightly defensive but composed.
- **→ next:** "And here's the system that makes those three things true."

---

### Slide 9 — Architecture (the one diagram)

- **Purpose:** Earn the right to be taken seriously by technical judges.
- **Talking points:**
  - Frontend: React + Vite + TS, Tolgee i18n, Framer Motion.
  - API: Go + Gin, JWT-less session auth, SSE-ready.
  - Data: SurrealDB 2.x — documents (events, suggestions), graph (farmer→product→tag), vector (HNSW 768-d).
  - AI: Gemini 2.5 Flash for generation, embedding-001 for retrieval.
  - Deployment: Docker → Coolify → Traefik → nginx.
- **Visuals:** **Reuse `LandingArchitecture.tsx` directly** — screenshot the live animated graph at a moment when the dashed flow is visible. This is the deck's signature visual.
- **Animation:** If exporting as video/MP4, capture 4–5 seconds of the live SVG flow loop. If static, pick a frame where most edges have visible dashes.
- **Screenshots:** `landing/architecture-graph-full.png` (capture at 1440×900 viewport, dark theme).
- **Avoid:** Drawing a *second* architecture diagram in the design tool. Don't redraw what the product already animates.
- **Tone:** Confident technical fluency.
- **Notes:** When pointing at the graph, name *only* the nodes you reference. Don't speed-read all 6.
- **→ next:** "One technical choice deserves its own slide."

---

### Slide 10 — SurrealDB / hybrid storage

- **Purpose:** Defend the most unusual technical choice before it gets attacked.
- **Talking points:**
  - "Postgres + Pinecone + Neo4j would be three containers, three sets of credentials, three migration files. We use one: SurrealDB."
  - 3,491 SKU rows, 11 edge types, 768-d HNSW index, all in one engine.
  - SurrealQL gives us SQL-ish ergonomics + graph traversals + vector KNN in a single query language.
- **Visuals:** Left: a diagram of "the boring way" (3 boxes labeled Postgres / Pinecone / Neo4j). Right: "our way" — one SurrealDB box. Use a faint red strikethrough on the left.
- **Animation:** Strikethrough draws on entry (300ms).
- **Screenshots:** Optional: tiny SurrealQL snippet (3–4 lines) showing a hybrid query.
- **Avoid:** Selling SurrealDB. Sell the *outcome* (one container, one query language).
- **Tone:** Pragmatic.
- **→ next:** "We made it boring on purpose — so it ships."

---

### Slide 11 — Production readiness

- **Purpose:** Convert "cool prototype" → "this could go live Monday".
- **Talking points:**
  - Dockerized.
  - Deployed on Coolify with Traefik (HTTPS, automatic certs).
  - Two-language UI (RU default + EN, full Tolgee i18n with X-UI-Language header).
  - Session auth + admin panel for user/session management.
  - Deterministic fallback content.
  - Structured logging (zerolog).
- **Visuals:** A "production checklist" — six rows, each with a tone-colored dot and a one-liner. Don't use green checkmarks — use the leaf-token dot from the design system.
- **Animation:** Rows fill in top→bottom, 60ms stagger.
- **Screenshots:** Optional: a Coolify deployment screenshot, blurred secrets.
- **Avoid:** Listing CI/CD tools you don't actually use.
- **Tone:** Matter-of-fact.
- **→ next:** "Here's where it goes next."

---

### Slide 12 — Roadmap / scale

- **Purpose:** Show ambition without overpromising.
- **Talking points:**
  - **Next 30 days:** open the demo to 5 pilot farmers, instrument send→open→buy funnel.
  - **Next quarter:** auto-dispatch (push, story, social posts) — system already has the dispatcher scaffold.
  - **Next year:** marketplace-wide rollout across all 10,000 farmers; per-farmer ai_memory accumulates over time → cold-start problem disappears.
- **Visuals:** Three vertical columns labeled 30d / 90d / 365d. Use a thin amber line connecting them across the bottom — same line treatment as the landing's hairline divider.
- **Animation:** None.
- **Screenshots:** None.
- **Avoid:** Funding asks unless explicitly invited. Hackathon decks don't ask for money.
- **Tone:** Grounded, slightly hungry.
- **→ next:** "One last thing."

---

### Slide 13 — Team + closing

- **Purpose:** Make the team memorable.
- **Talking points:**
  - Names + roles + one sentence each ("the person who shipped the Surreal schema in 36 hours").
  - One credit line: contact email / GitHub / live demo URL.
  - Repeat the elevator pitch one more time.
- **Visuals:** Team names in Fraunces italic, role in IBM Plex small-caps underneath. QR code in the bottom right linking to the live demo.
- **Animation:** None — clean closer.
- **Screenshots:** Optional team photo (only if it doesn't look like a stock photo).
- **Avoid:** "Thank you" as the only thing on the final slide. Always have a CTA.
- **Tone:** Warm.

---

### Appendix slides (don't include in main deck — use only if asked)

- **A1.** Detailed schema (`infrastructure/surrealdb/schema.surql`).
- **A2.** Prompt versioning + Gemini structured-JSON schemas.
- **A3.** ROI engine formula breakdown.
- **A4.** Tagging pipeline (rules + LLM fallback + ai_memory boost).
- **A5.** Auth model + admin features.
- **A6.** Tolgee i18n design + AI prompt language pinning via `X-UI-Language` header.
- **A7.** Cost projection per 1,000 farmers/month.

---

## 4. Real Product Features To Highlight

Only features that are *actually merged into `main`* and demonstrable. No vapor.

| # | Feature | What it actually does | Why it matters to judges | Screenshot to capture |
|---|---|---|---|---|
| 1 | **AI Recommendations** | Per-farmer × per-event match using tag overlap → category fallback → KNN on 768-d Gemini embeddings. Returns top-5 SKUs ranked by Δorders. | Hybrid retrieval is *the* technical depth signal. Show "tag:honey · season:summer-end · trend:+18% · mem:0.84" reason chips. | `app/recommendations-deck.png` |
| 2 | **Event & trend intelligence** | 40+ curated events (православные праздники, сезоны, тематика, тренды) seeded from `events.yml`. Filters by region + audience. | Domain depth — judges see we know the calendar. | `app/calendar-month.png`, `app/event-chips.png` |
| 3 | **Kanban workflow** | Plan board with proposed / planned / live columns. Cards link back to suggestions and carry ROI projection + channels. | Shows the work surface, not just the AI. | `app/plan-kanban.png`, `app/plan-card-drawer.png` |
| 4 | **Social post generation** | Multi-platform (Telegram, VK, Instagram-style) with carousel preview + platform-specific char limits. | The AI output is *useful*, not just text. | `app/social-editor.png` |
| 5 | **Stories generation** | Image-prompt + caption pair, story-card preview. | Visual content shows AI fan-out reach. | `app/stories-editor.png` |
| 6 | **Blog generation** | Two-pane writer view, title + lede + body 600–900 chars + hashtags. | Long-form generation under JSON schema. | `app/blog-editor.png` |
| 7 | **Recipe generation** | Structured fields: ingredients, steps, time, audience. Not free-form text. | Demonstrates schema discipline. | `app/recipe-editor.png` |
| 8 | **Push notification editor** | Lock-screen preview, urgency tone, dispatch status, scheduler scaffold. | Closes the loop — generation → dispatch. | `app/push-editor.png` |
| 9 | **AI workspace (Chat)** | Starter packs, slash commands, save-as menu (save AI output → story/blog/recipe/social/push). | Conversational entry point, but with structured outputs. | `app/ai-workspace-starter.png`, `app/ai-workspace-conversation.png` |
| 10 | **Multilingual UI** | Full Tolgee i18n, RU default + EN, language switcher in nav, persisted in localStorage + cookie + html[lang]. ~200 translation keys across landing + app surfaces. | Production-quality polish. Hackathon decks rarely ship i18n. | `landing/lang-switcher-popover.png` |
| 11 | **AI language pinning** | Axios interceptor sends `X-UI-Language` + `Accept-Language` headers; Go API pins Gemini prompt language. UI lang switches → AI output switches. | Subtle but impressive — judges notice. | (mention in talk, no screenshot needed) |
| 12 | **SurrealDB graph + vector** | farmer→product→tag edges + HNSW 768-d vector index in one engine. Hybrid queries in SurrealQL. | Hardest-to-fake technical claim. | Diagram, not screenshot. |
| 13 | **Embedding pipeline** | `cmd/tag-products` bulk pipeline, rule-first → Gemini fallback, embedding cache, delta-only upserts. | Shows ETL discipline. | Optional code snippet. |
| 14 | **Tagging pipeline** | Auto-canonical tag dedup, bulk upsert, rules-first to bound LLM calls. | Cost discipline. | (mention only) |
| 15 | **Farmer dashboard** | 4 KPI cards (SKU, events, campaigns, projected revenue), action cards for each upcoming event. | The "home base" of the product. | `app/dashboard.png` |
| 16 | **Analytics / ROI engine** | Pure Go formula with named assumptions; popover explains each multiplier on hover. | Money path is auditable. | `app/roi-popover.png` |
| 17 | **Campaign planning** | One click on a suggestion → 6-channel parallel Gemini fan-out → structured JSON → drawer with tabbed previews. | The wow moment. | `app/action-sheet-fanout.png` |
| 18 | **Admin panel** | `/admin/users` (table + side-sheet create), `/admin/sessions` (revoke). | Multi-user, production-grade. | `app/admin-users.png`, `app/admin-sessions.png` |
| 19 | **Auth (JWT-less sessions)** | Session-cookie auth, RequireAuth/RequireAdmin guards. Public landing, gated app. | Real auth, not "demo mode". | `app/login.png` |
| 20 | **Coolify/Docker deploy** | One `docker compose up` → full stack. Coolify-managed on the production host with Traefik TLS. | Reproducible. | Optional Coolify dashboard screenshot. |
| 21 | **Content lifecycle / revisions** | `content_revision` table; every edit is versioned; rich edit + history in ActionSheet. | Production-grade content management. | (mention only) |
| 22 | **Determinism / fallback** | Every Gemini call has a deterministic-copy fallback; demo never breaks. | The single line that defuses every judge skepticism. | (mention only) |

**Talking-simply rules:**

- For each feature above, the presenter has *one sentence* to introduce it. Anything more goes to Q&A.
- Always frame in farmer-time, not engineer-time: "saves the farmer two hours of writing" beats "fan-outs 6 generations in parallel."

---

## 5. Technical Architecture Presentation Guidance

### 5.1 How to present the architecture visually

**Do this:** Use the live animated `LandingArchitecture` from `/` as your architecture slide. Screenshot or screen-record the actual graph. Don't redraw.

**Why:** It already shows nodes (FE, API, DB, AI, Recommender, Tagging) with dashed-line "data flow" animation. It already matches the brand. It is *the* deck's most quietly impressive frame.

### 5.2 Components to include in the architecture story

Only these six. Skip anything else.

1. **FE** — React + Vite + TS, Tolgee i18n, Framer Motion.
2. **API** — Go + Gin, REST + SSE-ready, zerolog, session auth.
3. **DB** — SurrealDB 2.x: documents + graph edges + 768-d vector index.
4. **AI** — Gemini 2.5 Flash for generation, embedding-001 for retrieval.
5. **Recommender** — pure Go, tag → category → KNN, ai_memory boost.
6. **Tagging** — rules-first, bulk upsert, embedding cache.

### 5.3 How to explain SurrealDB strategically

Don't oversell it. Use this script:

> *"We use SurrealDB because it gives us three things in one container: documents for events, a graph for farmer→product→tag edges, and a 768-dimensional vector index for similarity search. Anywhere else, this would be three containers. We chose to be boring on purpose — fewer moving parts is fewer outages."*

If asked "why not Postgres + pgvector?": *"Postgres + pgvector + a graph layer is three sets of operational primitives. SurrealQL gives us one query language for all three modes. The cost is the SurrealDB community is smaller — we accept that trade."*

### 5.4 How to explain Gemini orchestration

Always frame it as **bounded, structured, and parallel**:

- **Bounded** — only the creative path calls Gemini. Money path doesn't.
- **Structured** — `responseSchema` enforces shape on the server. No regex parsing.
- **Parallel** — six channels fan out in goroutines; total wall-clock = slowest channel, not sum.

### 5.5 How to explain embeddings / vector search

> *"Each product has a 768-dimensional vector we computed once with Gemini's embedding-001 model. When we ask 'what SKUs match the audience for Med Spas?', we run a KNN on the HNSW index in SurrealDB. Cosine distance. Top-12 candidates. Then deterministic Go code re-ranks by tag overlap and ROI. The vector layer is a filter, not the answer."*

### 5.6 Avoid sounding too academic

Don't say:
- "We leverage retrieval-augmented generation…"
- "Our vector store…"
- "State-of-the-art LLM orchestration…"

Do say:
- "We index every product once. We don't re-embed at request time."
- "Gemini writes copy. It doesn't pick winners."
- "If the API is slow, the user still sees a campaign — it's just deterministic."

### 5.7 Impressive vs. unnecessary technical depth

| Impressive | Unnecessary |
|---|---|
| "11 edge types in the SurrealDB graph" | "We have indexes on these 14 columns" |
| "We embedded all 3,491 SKUs in 8 minutes" | "Our Tailwind config has 27 custom tokens" |
| "Structured JSON via Gemini `responseSchema`" | "We tried OpenAI but switched" |
| "Deterministic fallback path" | "Our retry logic uses exponential backoff" |
| "Coolify + Traefik handle TLS termination" | "We dockerized the frontend with multi-stage builds" |
| "Tolgee with X-UI-Language header pins prompt language" | "We use FormatSimple for interpolation" |

---

## 6. Demo Flow Script

The full canonical demo is in `docs/DEMO_SCRIPT.md`. The version below is the **stage-adapted** flow for pitch presentation.

### 6.1 Pre-demo checklist (30 minutes before)

- [ ] Production URL loads. Hit it from your phone on cellular to confirm.
- [ ] Localhost fallback running (`docker compose up` on laptop), browser tab pre-loaded.
- [ ] Language set to RU (judges are RU-speaking; switch to EN only if asked).
- [ ] Dark theme active.
- [ ] Browser zoom = 100%. Confirm on the projector resolution.
- [ ] Close Slack, email, calendar. Hide bookmarks bar.
- [ ] Wifi tested. If venue wifi is unstable, tether to phone hotspot in advance.
- [ ] A fallback screen recording of the same flow exists on local disk — see 6.4.

### 6.2 The ideal live demo (3 minutes)

```
0:00 — Landing page (already open from slide 5).
        Don't speak. Let the seasonality ring rotate for 4 seconds.
0:10 — Scroll once. Show the LandingDemo section "thinking" stream.
        Say: "Здесь демо — без логина, для гостей. Сейчас покажу настоящее."
0:25 — Click "Открыть кабинет". Land on farmer dashboard.
0:35 — Point to the 4 KPI cards. One line each. Max 12 seconds total.
0:50 — Click an action card (Пасхальная неделя or Медовый Спас).
        ActionSheet slides in from the right.
1:00 — Point to the matched SKUs ranked by score.
        Point to the ROI panel. Hover on one number — show the popover formula.
        Say: "Каждое число — функция явных допущений. ROI-движок детерминированный."
1:20 — Click "Сгенерировать кампанию". The 6-channel fan-out spinner appears.
        DON'T explain during the spinner. Let the room watch.
1:30 — Results land. Cycle through 2 tabs: Push and Story. Don't show all 6.
        Say: "Шесть каналов — параллельно. Структурированный JSON. Промпты версионируем."
1:50 — Click "В план". Watch the card slide into the Kanban "proposed" column.
2:00 — Switch to the Plan page (Kanban view).
        Drag one card from "proposed" to "planned".
        Say: "Это рабочий стол маркетолога. Фермер ведёт план, не пишет тексты."
2:20 — Switch to /ai (AI workspace).
        Open a starter pack. Type one slash command. Show the structured output.
        Click "Сохранить как → Сторис". Confirmation toast.
        Say: "Любой AI-вывод можно сохранить в любой канал."
2:40 — Switch language to EN via the language switcher (top right).
        Same screen, English. Don't speak during the switch — let it register.
        Say: "Полная локализация. AI-вывод тоже переключается — флаг X-UI-Language."
2:55 — Back to slide 6.
```

### 6.3 The safest demo path (if live is risky)

If the venue wifi is unreliable, swap the live URL for `localhost` running the full stack on your laptop. SurrealDB has 3,491 real SKUs imported, Gemini calls work over the laptop's tether to your phone.

If Gemini fails mid-fanout, the deterministic fallback fires automatically. **Do not panic and do not call attention to it.** The output will be slightly more generic; keep moving.

### 6.4 Fallback options if everything fails

- **MP4 fallback (last resort):** Pre-record the demo at 1080p, 60fps, **no audio**. Length: exactly 2:55. Voice-over live over the muted video. Keep the file on the local disk, not cloud-synced.
- **Screenshots-only fallback:** Have slides 14–18 (in appendix) ready as a static demo carousel. Click through them at the same pace.
- **Localhost on a teammate's laptop:** If your laptop dies, a teammate has the same `docker compose up` ready on theirs.

### 6.5 Pauses for impact

- Pause for **2 seconds** after the action sheet slides in.
- Pause for **3 seconds** during the 6-channel fan-out spinner. The room will lean in.
- Pause for **2 seconds** after the language switch from RU → EN.

### 6.6 Where to explain AI decisions

- **At the ROI popover:** Explain that the *number* is deterministic — Go formula, not Gemini.
- **At the fan-out spinner:** Explain that Gemini writes *only* the copy, six channels in parallel goroutines.
- **At the recommendation reason chips:** ("tag:honey · season:summer-end · trend:+18% · mem:0.84") Explain: "these are the actual signals the matcher used. Auditable."

### 6.7 Keeping it cinematic

- One narrative thread. Don't show every page — show three pages well.
- No mouse jitter. Plan the path. Practice 5 times before the day.
- Don't read the screen. Speak ahead of the click.
- Click → speak → pause. Not click-speak-click-speak.

---

## 7. Screenshot & Asset Checklist

Capture *before* opening the design tool. Aim for 2× DPR / Retina captures, dark theme, RU language unless noted, browser chrome cropped out.

### 7.1 Landing assets

- [ ] `landing/hero-ru.png` — full hero with rotated seasonality ring, RU.
- [ ] `landing/hero-en.png` — same hero, EN, language switched.
- [ ] `landing/hero-fullbleed.png` — hero without nav chrome, for slide 1.
- [ ] `landing/demo-section.png` — the LandingDemo block mid-streaming-state.
- [ ] `landing/how-it-works-row.png` — full `#how` section (3 cards visible).
- [ ] `landing/architecture-graph-full.png` — animated graph at peak-flow frame.
- [ ] `landing/architecture-graph-video.mp4` — optional, 5s loop of the SVG flow.
- [ ] `landing/faq-open-state.png` — one FAQ panel expanded.
- [ ] `landing/proof-cta.png` — final CTA card.
- [ ] `landing/lang-switcher-popover.png` — open language switcher popover.

### 7.2 App assets (logged-in surfaces)

- [ ] `app/login.png` — login page with the compact language switcher visible.
- [ ] `app/dashboard.png` — farmer dashboard, 4 KPI cards + action cards.
- [ ] `app/action-sheet-fanout.png` — action sheet during 6-channel fan-out spinner.
- [ ] `app/action-sheet-results.png` — action sheet after fan-out, Push tab open.
- [ ] `app/recommendations-deck.png` — recommendations list with reason chips.
- [ ] `app/roi-popover.png` — ROI assumption popover on hover.
- [ ] `app/calendar-month.png` — calendar view with event chips.
- [ ] `app/event-chips.png` — close-up of event chips in calendar.
- [ ] `app/plan-kanban.png` — full Kanban with 3 columns.
- [ ] `app/plan-card-drawer.png` — card detail drawer (4 tabs visible).
- [ ] `app/stories-editor.png` — stories editor with preview.
- [ ] `app/blog-editor.png` — two-pane blog writer.
- [ ] `app/recipe-editor.png` — recipe editor with structured fields.
- [ ] `app/social-editor.png` — social editor with platform preview.
- [ ] `app/push-editor.png` — push editor with lock-screen preview.
- [ ] `app/ai-workspace-starter.png` — AI workspace starter rail.
- [ ] `app/ai-workspace-conversation.png` — AI workspace mid-conversation.
- [ ] `app/admin-users.png` — admin users table.
- [ ] `app/admin-sessions.png` — admin sessions with revoke action.

### 7.3 Diagrams / system visuals

- [ ] System diagram (or screenshot of LandingArchitecture).
- [ ] Hybrid retrieval diagram (tag → category → KNN).
- [ ] ROI formula visualization (one line: `Δorders = match × audience × channel × seasonality`).
- [ ] "3 boxes vs 1 box" SurrealDB diagram for slide 10.

### 7.4 Hero visuals

- [ ] Slide 1 hero crop.
- [ ] Slide 5 demo-handoff lockup.
- [ ] Slide 13 team lockup.

### 7.5 Charts / analytics

- [ ] Any chart from the dashboard worth highlighting (revenue projection bar chart, channel mix donut, etc.).

### 7.6 Farmer workflow examples

- [ ] One end-to-end story arc captured as 4–5 screenshots: dashboard → action card → fan-out → kanban → push preview. Useful for the appendix.

---

## 8. Visual Style Direction

The deck must look like an extension of the product. Otherwise the demo will feel like a different company.

### 8.1 Aesthetic direction

**Editorial-dusk × premium-fintech × agri-tech minimalism.** Dark, restrained, typographic. Negative space is a feature, not a gap. The product is the hero — chrome serves the product.

### 8.2 Typography

- **Display:** Fraunces (variable axis). Use the italic for emphasis lines ("у нас выходит", "your campaign, ready"). Never use Fraunces for body.
- **Body:** IBM Plex Sans. Regular for paragraphs, smallcaps for labels and eyebrow text (`smallcaps` class in the app).
- **Mono:** IBM Plex Mono or JetBrains Mono. Only for code snippets, telemetry, and stats with tabular numerals (`tnum`).

Pair the same way the product does — large Fraunces headline → IBM Plex body → mono for the stat.

### 8.3 Color palette

Take the design tokens from `apps/web/src/styles/` (or whatever the app's token file is). Approximate values:

| Token | Use | Approx hex |
|---|---|---|
| `--bg` | Page background | `#0c0e0a` (warm near-black) |
| `--bg-elevated` | Cards / panels | `#13150f` |
| `--bg-subtle` | Subtle fills | `#1a1d15` |
| `--ink` | Primary text | `#ece7d8` |
| `--ink-dim` | Secondary text | `#9b988a` |
| `--ink-mute` | Tertiary / smallcaps | `#6c6a5e` |
| `--line` | Hairlines / borders | `#262519` |
| `--leaf` | Primary accent (success, growth) | `#7fb069` |
| `--amber` | Warm accent (warning, harvest) | `#d4a04c` |
| `--plum` | Secondary accent (trend, fermentation) | `#9c6b9c` |
| `--sky` | Cool accent (audience, FE) | `#7aa6c9` |
| `--rust` | Earth accent (grain, season) | `#c47a4a` |

Use **leaf + amber as the dominant pair**. Plum/sky/rust are spice — one per slide, max.

### 8.4 Motion ideas (deck-level)

- Slide entry: 300ms ease-out cubic (`[0.2, 0.65, 0.2, 1]`).
- Text reveal: stagger 60ms per line.
- Numbers: count-up once on entry (300ms).
- The architecture slide: short 4–5s loop of the live SVG flow.
- **Avoid:** Fly-ins, bounces, dissolves. Anything that feels like Keynote-defaults.

### 8.5 Style references

- *The New York Times*'s long-form features (editorial dusk, Fraunces-like serifs in italic).
- Linear's product pages (restrained, dark, monospaced telemetry).
- Vercel's marketing site (typographic hierarchy, generous negative space).
- Stripe's docs (mono for stats, clear hierarchy).

### 8.6 What to avoid

- Purple-on-white gradients (AI-startup cliché #1).
- Stock photography of farmers or fields.
- Cartoon AI icons or "magic sparkle" emojis.
- Bullet point soup. Max 3 bullets per slide.
- Logo wall slides ("our stack"). Show outcomes, not logos.
- Anything reminiscent of a corporate keynote template.

### 8.7 Premium / futuristic feel checklist

- [ ] Dark background with a faint grain texture (use the same grain class as the landing).
- [ ] Hairline dividers (`border-line/60`), not solid borders.
- [ ] Generous padding — never crowd the edge.
- [ ] One accent color per slide, not three.
- [ ] Fraunces italic on at least one slide for that "editorial" register.
- [ ] Monospace numerals (`tnum`) on every stat.
- [ ] No more than one icon per slide.

---

## 9. Judge Strategy

### 9.1 What judges likely care about (in order)

1. **Does it work?** — they have seen 100 prototypes that don't run on stage.
2. **Is the data real?** — mock-data demos lose to real-data demos every time.
3. **Is the team competent?** — can they answer technical questions cleanly?
4. **Is there business sense?** — does the team know who pays and why?
5. **Is the tech defensible?** — could a senior engineer have built this in two months?
6. **Polish.** — i18n, auth, admin panel, deployment. The signal that this team finishes things.

### 9.2 How to position strategically

- **First 30 seconds:** Establish that the product is live and the data is real. ("3,491 SKUs imported from XLSX, 65 farmers, deployed on Coolify.")
- **First 2 minutes:** Show the demo. Working > talking.
- **Middle:** Defend the unusual choices (SurrealDB, deterministic ROI, fallback path) *before* anyone attacks them.
- **End:** Ground roadmap in pilot-with-5-farmers, not "world domination".

### 9.3 Emphasize execution quality

Specifically name these on stage at least once:

- "Two languages, full Tolgee i18n."
- "Real catalog import — XLSX ETL pipeline."
- "Deployed on Coolify with Traefik TLS."
- "Admin panel for user and session management."
- "Deterministic fallback — Gemini downtime doesn't kill the demo."

### 9.4 How to differentiate from generic AI wrappers

Lead with the three claims from slide 8:

1. **Deterministic money path** — Go, not LLM.
2. **Hybrid retrieval** — tags + KNN + memory, not just embeddings.
3. **Fallback** — system runs without the AI.

Generic wrappers fail all three.

### 9.5 Emphasizing "working production-grade system"

Phrases to use:

- "This isn't a demo — it's running in production, you can hit the URL from your phone."
- "Every feature you'll see has a route in our Go API and a row in our SurrealDB."
- "We could onboard a pilot farmer tomorrow morning."

Phrases to avoid:

- "It's just a prototype."
- "We didn't have time to…"
- "In production we'd…" — say "it does" instead.

---

## 10. Final Presentation Tips

### 10.1 Pacing

- **Slides 1–4:** Slow. 30–40 seconds each.
- **Slide 5:** Beat of silence (3 seconds).
- **Demo:** 3 minutes flat. Practice with a stopwatch.
- **Slides 6–11:** Accelerate. 25–35 seconds each.
- **Slides 12–13:** Slow again. Land softly.

### 10.2 Timing (8-minute version)

| Block | Duration |
|---|---|
| Slides 1–4 (problem, thesis) | 2:00 |
| Slide 5 + demo | 3:00 |
| Slide 6–11 (how, features, arch, prod) | 2:30 |
| Slide 12–13 (roadmap, close) | 0:30 |

### 10.3 Speaking flow

- One sentence per breath. Cut everything else.
- Active voice. "We built X" not "X was built by us."
- Concrete numbers beat adjectives. "3,491 SKU" beats "thousands of products."

### 10.4 Handoff between teammates

If two presenters:

- **Presenter A:** slides 1–5 + demo.
- **Presenter B:** slides 6–11 (technical defense).
- **Either:** slides 12–13.

Rules for handoff:

- Stand on opposite sides of the screen so the audience doesn't whip-pan.
- A finishes a sentence, B starts the next. Don't pause for handoff.
- Rehearse the handoff phrase. ("And here's where the system gets technical — over to you.")

### 10.5 Handling technical questions

**The honest defaults:**

- *"What model are you using?"* → "Gemini 2.5 Flash for generation, embedding-001 for retrieval. We chose Flash because the structured-JSON output is fast enough that we can fan out six channels in parallel."
- *"How do you handle hallucination?"* → "Generation only writes copy. The money path — ROI, ranking, audience match — is deterministic Go code. So hallucination affects tone, not numbers."
- *"What's your cost per farmer?"* → "Embedding is one-time per SKU. Fan-out is one API call per channel per generation, structured JSON, no chat-style token explosions. We estimate single-digit dollars per farmer per month at current Gemini pricing."
- *"What about prompt injection?"* → "Inputs from farmers come through structured forms, not free-text. The only free-text path is the AI workspace, and outputs there are sandboxed to the workspace until the user explicitly saves them."
- *"Why SurrealDB and not Postgres + pgvector?"* → see section 5.3.

### 10.6 Handling AI skepticism

If a judge says "this is just a GPT wrapper":

> *"Three things separate us. One, the money path is deterministic — Go, not the model. Two, we retrieve before we generate; the embedding layer is a filter, the model writes copy on the filtered set. Three, we have a deterministic fallback — if Gemini is down, the demo still runs and the farmer still gets a campaign. None of that is a wrapper."*

### 10.7 Handling scalability questions

If asked "what happens at 10,000 farmers?":

> *"Embeddings are one-time, so the catalog scales linearly with SKUs, not farmers. Generation is per-campaign, on-demand — about one fan-out per farmer per event window, so roughly one generation per farmer per week at steady state. Our bottleneck is Gemini rate limits, not our infrastructure. The Go API is stateless and SurrealDB horizontal-scales for reads."*

### 10.8 Final-day rehearsal checklist

- [ ] Two full dress rehearsals with the stopwatch.
- [ ] One rehearsal in front of someone who has never seen the product.
- [ ] One rehearsal with the venue projector resolution (often 1920×1080 or 1280×720).
- [ ] One Q&A simulation — teammate fires 5 questions from section 10.5–10.7.

---

## Appendix A — Real numbers to memorize

| Claim | Source | Why it matters |
|---|---|---|
| 3,491 SKUs | `cmd/import` XLSX ETL output | Proves real catalog import |
| 65 farmers | seed data | Real farmer count |
| 40+ events | `events.yml` | Curated knowledge base |
| 11 edge types | SurrealDB schema | Graph depth |
| 768-d HNSW | Gemini embedding-001 | Vector layer specifics |
| 6 channels | push, story, blog, recipe, chat, social | Fan-out breadth |
| 158 ai_memory signals | `ai_memory` table | Memory layer |
| ~200 i18n keys | `apps/web/src/locales/{ru,en}.json` | Localization depth |
| ~5s end-to-end fan-out | observed | The wow timing |

Memorize five of these for the demo. Don't recite all nine.

---

## Appendix B — Phrases that win the room

- *"We made it boring on purpose — so it ships."*
- *"AI doesn't sell. AI plans. The farmer still sells."*
- *"The money path is deterministic. The creative path is generative. We don't mix them."*
- *"One container, one query language, three storage modes."*
- *"If Gemini goes down at 2pm, the demo still runs at 2:01."*
- *"Russian by default. English is one click. So is the AI's output."*

---

## Appendix C — Phrases that lose the room

- "We leverage cutting-edge LLM technology…"
- "Powered by AI."
- "Disrupting agri-commerce."
- "In the future we plan to…"
- "It's just a hackathon project."

---

**End of guide.** Build the deck from this. When in doubt, cut.
