# Pitch Q&A (English) — Svoe Rodnoe · Calendar

> **Purpose:** practice drill for the team before the pitch. ~150
> questions with sniper-style answers, grounded in what is actually
> written in the code and `/docs`. If a judge asks — we must have an
> answer in ≤15 seconds.
>
> **How to use:** one person reads the Q aloud, another answers
> without peeking. At least two passes before the defense. Pay
> special attention to "Critical / skeptical" — those are the attacks
> that hit the most often.
>
> **Format:** Q — question. A — short conversational answer (what we
> say out loud). NOTE — reserve, in case asked to go deeper.
>
> **Russian parallel:** see `docs/PITCH_QA.md` for the same drill in
> Russian. The product is RU-primary; this file is for international
> or English-asking judges.

---

## 0. Elevator pitch (memorize)

**Q0.1.** Tell us about the project in 30 seconds.
**A.** "Svoe Rodnoe Calendar" is an AI marketing strategist for
10,000 Russian farmers. It reads the farmer's SKU catalog, matches it
against a curated calendar of 40+ events (holidays, fasting periods,
seasons, trends), and in 5 seconds assembles a six-channel campaign —
push, story, blog, recipe, chat, social. With a deterministic ROI
forecast computed in pure Go. Not a "GPT wrapper": the LLM writes
only copy, the money is computed by a closed formula.

**Q0.2.** One sentence — what's the value?
**A.** We give the farmer two hours back per week and lift repeat
orders by 15–25% — without them hiring a marketer.

**Q0.3.** Who do you sell to?
**A.** The marketplace "Svoe Rodnoe" (RSHB Digital) — as a service
for their 10,000 farmers. B2B2C unit economics: the platform pays,
the farmer wins.

**Q0.4.** Three ways you differ from a GPT wrapper.
**A.** (1) Deterministic ROI in Go — money is not computed by a
model. (2) Hybrid retrieval — tags → category → 768-d HNSW, the LLM
only writes on a filtered set. (3) Fallback — if Gemini is down, the
product still runs with deterministic copy. The demo doesn't crash.

**Q0.5.** What is already built?
**A.** A fully working product: 3,491 SKUs imported from XLSX, 65
farmers in seed data, 40+ events in the KB, 11 edge types in the
graph, full RU+EN UI, auth + admin panel, deployed on Coolify with
Traefik. One command: `docker compose up`.

---

## 1. Business problem and market

**Q1.1.** Why does this problem exist in the first place?
**A.** A farmer on a marketplace is a producer, not a marketer.
10,000 SKU-owners, 80% with no marketing plan. The beekeeper misses
Honey Saviour Day, the berry grower misses Ivan Kupala. Every
seasonal peak goes to whoever has a brand team — usually not the
farmer.

**Q1.2.** What is the current repeat-purchase rate on the
marketplace?
**A.** About 20% (our benchmark). DTC food benchmark — 45–60%. Not
because the product is bad — because no one is reminding the buyer.

**Q1.3.** What does hiring a marketer cost a farmer?
**A.** ₽80–150K per month for an agency. A farmer with 30 SKUs and
₽300K monthly revenue cannot afford it. So no one hires.

**Q1.4.** How many farmers are in the potential market?
**A.** 10,000 on the marketplace today; RSHB Digital plans further
onboarding. The wider Russian farm-business directory holds ≈70,000
operations.

**Q1.5.** Are there competitors?
**A.** No direct ones. Adjacent: SMM agencies (too expensive), Tilda
for landing pages (not seasonality-targeted), 1C marketing modules
(for large businesses). No one does event-driven auto-campaigning
specifically for the farmer micro-business.

**Q1.6.** Why now?
**A.** Three factors aligned: (1) cheap structured-JSON LLMs (Gemini
2.5 Flash — pennies per campaign), (2) RSHB Digital as a motivated
distribution channel, (3) farmers moved en masse to online sales
after 2020.

**Q1.7.** What's the projected annual impact?
**A.** Per farmer: +86 orders / +₽120,600 per month. Across 10,000
farmers — ₽500M of additional annual revenue, without any traffic
increase. Just by sending the right campaign on the right day.

**Q1.8.** What are the unit economics for RSHB Digital?
**A.** Embedding — one-time cost per SKU (≈$0.0001/catalog).
Generation — one fan-out per farmer per event, ≈$0.01. At 20 events
per year × 10,000 farmers ≈ $2K/year in Gemini billing. Two extra
transactions per farmer pay for the service.

**Q1.9.** Which farmer segments do you cover?
**A.** Beekeepers, dairy, cheese, vegetables/garden, berries, honey,
preserves, baking. Seed data has 8 product categories × 9 audience
types. Architecturally — any category for which tags exist.

**Q1.10.** Why don't farmers post on social media themselves?
**A.** They do — but reactively: "sales dropped, let me try
something". No forward calendar, no link between SKU, event, and
channel. We flip it: show the window two weeks out and say
concretely "start the campaign now".

**Q1.11.** Regulatory context? Russian Federal Law 152-FZ, ad rules,
labeling?
**A.** Content is moderated by the farmer before publication — we
only ship drafts. Personal data does not leave the RF perimeter
(SurrealDB cluster on any Russian host; Gemini can be swapped for
YandexGPT — the provider is one file, `gemini.go`).

**Q1.12.** What if a farmer doesn't trust the AI text?
**A.** That's why we built a plan board and a rich edit + revision
history (`content_revision` table). AI writes the draft, the farmer
edits it in 30 seconds and publishes. No auto-posting without
consent.

---

## 2. Product and UX

**Q2.1.** What are the product's main surfaces?
**A.** Landing page, farmer dashboard with KPIs, calendar of 40+
events, AI workspace with slash commands, plan board (Kanban with a
4-tab card drawer), 5 content channels as standalone pages (Stories,
Blogs, Recipes, Social, Push), admin panel.

**Q2.2.** How many clicks from "opens app" to "campaign ready"?
**A.** Three. Open dashboard → click event action card → click
"Generate campaign". In 5 seconds, 6 channels are ready.

**Q2.3.** What exactly are the "6 channels"?
**A.** Push notification, Stories (image-prompt + caption), Blog
(title + lede + 600–900 char body + hashtags), Recipe (structured
ingredients + steps), Chat (message to segment=repeat_buyers),
Social (TG/VK/Insta with carousel and per-platform char-limit).

**Q2.4.** Why these 6 channels specifically?
**A.** These are the channels the "Svoe Rodnoe" marketplace actually
offers farmers. We didn't invent them — we mapped to what's already
available.

**Q2.5.** How is the plan board different from Trello?
**A.** Each card carries not a "task" but a campaign: ROI forecast,
matched SKUs, channels, content, team comments, activity log.
Dragging from proposed → planned writes an ai_memory signal — the
recommender learns from your decisions.

**Q2.6.** What does the AI workspace do?
**A.** Conversational entry point with slash commands `/story`,
`/blog`, `/recipe` and a save-as menu — any reply can be saved with
one click as a Stories draft, Blog, Recipe, Social or Push. Chat is
the entry point, not the final stop.

**Q2.7.** What is "strategist mode"?
**A.** A chat mode where the assistant doesn't just answer but
proposes the next step (▸ followup chips). It can create a plan card
itself (tool `create_plan_card_for_event`) if the farmer agrees.

**Q2.8.** What's the seasonal ring on the landing page?
**A.** Animated SVG ring with 12 sectors per month. Not decorative —
it shows event windows colored by channel. It's the product's design
signature.

**Q2.9.** What's the design philosophy?
**A.** Editorial-dusk × premium-fintech × agri-tech minimalism.
Fraunces (display) + IBM Plex Sans (body). We deliberately rejected
green-tractor aesthetics — modern farmers use Instagram and see
Vercel-grade sites, we match that bar.

**Q2.10.** What does the farmer see on first visit?
**A.** Landing page (RU by default), "Open demo" button — no login
needed → interactive 7-stage flow. After login — dashboard with 4
KPI cards and action cards for each event window in the next 30
days.

**Q2.11.** Is English supported?
**A.** Fully. Tolgee i18n, ~200 keys, switcher in nav bar and admin
panel. Switching language also flips the AI output language — the
`X-UI-Language` header pins the language in the Gemini prompt.

**Q2.12.** What if a farmer rolls back a campaign?
**A.** Every content edit is a revision in `content_revision`.
Revision history is available; one-click rollback to any prior
version. That's Phase 2 — content lifecycle.

---

## 3. Demo and script

**Q3.1.** How long is the demo?
**A.** 3 minutes canonical flow: landing → dashboard → action card →
fan-out → plan → language switch. If we have 5 minutes, we add the
AI workspace and the 4-tab plan card.

**Q3.2.** What do you show first?
**A.** The landing page. We don't speak for the first 4 seconds —
let the room see the rotating seasonal ring and feel that this is a
serious product, not a prototype.

**Q3.3.** What do you deliberately NOT show?
**A.** Admin panel (hidden at /admin), source code (boring), tests
(also boring). No console.log on the projector.

**Q3.4.** What if the internet drops mid-demo?
**A.** Three fallbacks: (1) localhost stack on a laptop, (2)
pre-recorded MP4 with live voice-over, (3) the deterministic Gemini
fallback — the fan-out still returns text even if the API is dead.

**Q3.5.** Where are the "wow moments"?
**A.** Four: (a) the rotating seasonal ring on the landing, (b) the
5-second fan-out with all 6 channels appearing simultaneously, (c)
spring-animated drag on the Kanban, (d) the RU→EN switch after which
the AI output is immediately in English.

**Q3.6.** Can we see it live?
**A.** Yes. URL on Coolify, RU/EN, accessible from any device. QR
code on the final slide.

---

## 4. Architecture and stack

**Q4.1.** Describe the stack in one paragraph.
**A.** React + Vite + TypeScript on the frontend (Tolgee i18n,
Framer Motion). Go + Gin API with JWT-less sessions. SurrealDB 2.x
as a unified store: documents + graph (farmer→product→tag) + 768-d
HNSW vector index. Gemini 2.5 Flash for generation, embedding-001
for retrieval. Docker + Coolify + Traefik TLS.

**Q4.2.** Why Go and not Python?
**A.** (1) Tiny binary — cold start <100ms; (2) native goroutines —
fan-out 6 channels in parallel without asyncio; (3) deterministic
typing — critical for the money path. Python is everywhere else in
the project except the backend.

**Q4.3.** Why Gin and not Echo / Fiber / net/http?
**A.** Minimal API over net/http, embedded middleware stack, huge
community. Echo/Fiber give +3% perf for -70% familiar patterns. Not
worth the trade.

**Q4.4.** Why React + Vite?
**A.** Vite — fastest cold-start dev loop, HMR doesn't break on
i18n reloads. React — the stack every future maintainer knows. No
Next — we don't need SSR, we deliver static via nginx.

**Q4.5.** Why Tailwind?
**A.** Full visual control without a 200kB component library. We use
shadcn primitives over Radix — headless and customizable. No
Material UI, no AntD.

**Q4.6.** Why Framer Motion?
**A.** Cinematic transitions (springs, gestures) make the product
look like Linear or Vercel. The alternative — hand-rolled
requestAnimationFrame — isn't justified.

**Q4.7.** Backend code structure?
**A.** Hexagonal: `cmd/server` — entrypoint + wiring;
`internal/handlers` — HTTP→service mapping;
`internal/services/*` — business logic (ai, events, tagging,
recommendation, plan, catalog); `internal/db` — thin Surreal repo
facade; `internal/models` — domain DTOs.

**Q4.8.** Where does the recommender live?
**A.** `internal/services/recommendation`. Three files: `match.go`
(tag overlap → category → KNN), `roi.go` (deterministic formula with
named constants), `promo.go` (rule-based discount/code/bundle).

**Q4.9.** Where does the content fan-out live?
**A.** `internal/services/ai/content.go`. Spawns 6 parallel
goroutines, one per channel. Each calls `Gemini.GenerateJSON` with a
strict JSON schema from `prompts.go`. Wall-clock = slowest channel,
not the sum.

**Q4.10.** What is HNSW in our case?
**A.** Hierarchical Navigable Small World — SurrealDB's index for
cosine-similarity over 768-d vectors. Used for event lookup by
semantic phrase ("NG" → Новый год) and for cold-start tagging via
`embedding_cache`.

**Q4.11.** Embedding dimension?
**A.** 768, from Gemini text-embedding-001. Default trade-off
between quality and storage. SurrealDB HNSW supports any dimension;
768 is our profile.

**Q4.12.** How much code?
**A.** ≈10K lines of Go + ≈18K of TypeScript. Not "two days in
Cursor" — deliberate architecture. Every service has typed DTOs;
every repo method has one obvious location in `repo.go` or *_repo.go.

**Q4.13.** Tests?
**A.** Go tests for handlers (auth validation, error mapping),
targeted repo tests. Frontend — tsc + manual prod testing.
Hackathon scope: priority was features, not 100% coverage.

**Q4.14.** What does JWT-less auth mean?
**A.** Sessions are stored in SurrealDB as `app_session` records
with expires_at, linked to `app_user`. The client sends an opaque
token in `Authorization: Bearer <token>`. The advantage — server-side
revocation (no 24h JWTs floating around uncancellable).

**Q4.15.** How does the client authenticate?
**A.** POST /api/auth/login → returns opaque token + user object.
Token is stored in localStorage, attached by axios to every request.
Server-side `RequireAuth` / `RequireAdmin` guards check session + role.

**Q4.16.** How does RU/EN i18n work?
**A.** Tolgee with two static bundles (ru.json + en.json, ≈200
keys). FormatSimple interpolation. Language stored in localStorage +
cookie + html[lang]. Axios interceptor adds `X-UI-Language` +
`Accept-Language` to every request → the Go API pins the language in
the Gemini prompt.

**Q4.17.** Where is rate-limiting?
**A.** Auth: middleware with an in-memory counter (token bucket),
configured via env `AUTH_LOGIN_RATE_LIMIT` /
`AUTH_LOGIN_RATE_WINDOW_MIN`. Default: 10 attempts per 15 minutes
per IP.

**Q4.18.** Where does `farmer_id` come from?
**A.** The "Svoe Rodnoe" marketplace has an `organization_id` per
farmer. XLSX import (`cmd/import`) creates `farmer:<surreal-id>`
records linked to the real `organization_id`. The frontend operates
on organization_id; backend resolves through `ResolveFarmer`.

---

## 5. SurrealDB — defending the choice

**Q5.1.** Why SurrealDB and not Postgres + pgvector?
**A.** Postgres + pgvector + a graph layer is three sets of
operational primitives. SurrealQL gives us one query language for
documents, graph, and vectors. Fewer moving parts means fewer 3 AM
incidents.

**Q5.2.** What's the risk of SurrealDB?
**A.** Smaller community vs Postgres — harder to Google a rare
issue. We accept that cost: for the hackathon and MVP it's
justified; if scale demands it, migration to Postgres+pgvector+Neo4j
fits on a single page.

**Q5.3.** Is SurrealDB stable?
**A.** Version 2.x is production-ready per their roadmap. We use
the HTTP driver instead of WebSocket for predictability. Healthcheck
+ restart policy in docker-compose.

**Q5.4.** How do you do migrations?
**A.** One file: `infrastructure/surrealdb/schema.surql` with
DEFINE TABLE + DEFINE FIELD statements. Applied on API startup
(idempotent). No alembic/goose — SurrealQL declarations are already
idempotent.

**Q5.5.** How many tables?
**A.** About 20. Domain: farmer, product, product_tag, event,
audience, trend, seasonal_window, suggestion, plan_card,
generated_content, content_revision, plan_card_comment,
plan_card_activity. System: app_user, app_session, embedding_cache,
ai_memory.

**Q5.6.** How many edge types in the graph?
**A.** 11. farmer→owns→product, product→tagged→product_tag,
event→targets→audience, event→category→category, plus
suggestion→matched→product, plan_card→links→suggestion, etc.

**Q5.7.** How does SurrealDB scale?
**A.** Read replicas + RocksDB storage engine on a single
implementation. For our profile (read-heavy + occasional writes on
plan/content), horizontal scaling is trivial. HNSW vector index
shards in SurrealDB 2.x.

**Q5.8.** What if SurrealDB crashes?
**A.** Restart policy in Docker. Volume `surreal_data` preserves
RocksDB. Embedding cache — loss is acceptable (regenerates in ~8
minutes). Plan/content — critical, daily volume snapshot planned.

**Q5.9.** Where does persistence live?
**A.** Docker volume `svoe_surreal_data_prod`, mounted at `/data`.
The volume is explicitly named in compose so redeploys don't orphan
data.

---

## 6. AI / Gemini / prompts

**Q6.1.** Why Gemini 2.5 Flash and not GPT-4 or Claude?
**A.** Three reasons: (1) cheapest structured JSON ($0.075/M input
tokens vs $5 for GPT-4), (2) native `responseSchema` support — the
contract is server-side, not in a client parser, (3) speed — 5-second
fan-out across 6 channels is real.

**Q6.2.** Why not YandexGPT?
**A.** Next step. The LLM gateway is one file, `gemini.go`, with a
signature of `(system, user, schema, out)`. Provider swaps in 10
minutes. For RSHB the YandexGPT angle is obviously attractive.

**Q6.3.** What is structured JSON?
**A.** Gemini's `responseSchema` accepts an OpenAPI-like schema; the
Gemini server enforces the output shape. No regex, no parsers, no
retries. Example for push:
`{title:string≤36, body:string≤120, deeplink:string?}`.

**Q6.4.** How do you fight hallucinations?
**A.** Three layers. (1) Generation only writes copy — never touches
money. (2) Prompts explicitly forbid inventing SKUs/numbers — the
model works with the provided context. (3) JSON schema constrains
the shape — fields can't be invented.

**Q6.5.** How are prompts versioned?
**A.** Every generation writes its `prompt_version` to
`generated_content` (e.g. `push-v3`, `recipe-v2`). On rollback or
A/B you can compare the original prompt. Prompts live in
`services/ai/prompts.go` — Git + structural versioning.

**Q6.6.** What's the cost per campaign?
**A.** Catalog embedding — one-time, ≈3,491 SKUs × $0.0001 = $0.35
per catalog. Fan-out — 6 channels × ≈$0.002 ≈ $0.012 per campaign.
At 20 campaigns per year per farmer — $0.24/farmer/year.

**Q6.7.** What if Gemini goes down?
**A.** In `content.go::fallbackOne` we have a deterministic template
per channel — title "{event.title} — {product.name}", body is a
canned phrase. The demo doesn't crash; the farmer sees copy they can
edit.

**Q6.8.** What context window do you use?
**A.** ≈800 tokens of system prompt + ≈400 tokens of user context
(event + matched_skus + farmer context). Response ≈300 tokens per
channel. All 6 — ≈4,200 tokens total. Huge headroom.

**Q6.9.** Where does chat session memory live?
**A.** On the FE — sessionStorage per farmer. On the backend —
stateless, but `sessionStateBlock()` in
`services/chat/service.go` injects a summary of tool evidence into
every turn. History travels in Content[] on the request.

**Q6.10.** What tools does the chat assistant have?
**A.** Seven: get_upcoming_events (time window),
find_events_semantic (KNN on embeddings), get_skus_matching,
get_insights, get_plan_status, simulate_promo (what-if),
create_plan_card_for_event (workflow — actually creates the card).

**Q6.11.** How does the assistant decide which tool to call?
**A.** Gemini ChatTurn with tool declarations. The model itself
picks a function call based on the declaration's description. We
write those descriptions in problem-oriented language: "use for
synonyms and abbreviations" (find_events_semantic), "use when the
farmer agrees" (create_plan_card_for_event).

**Q6.12.** How many tool-loop steps?
**A.** Max 3 in `services/chat/service.go::maxToolTurns`. Budget —
25s per ChatTurn, 60s per Chat handler. If it loops, we return the
last text part.

**Q6.13.** What's actually unique about our AI?
**A.** Not the LLM itself (everyone has Gemini). Unique: (a) hybrid
retrieval before the LLM, (b) deterministic fallback, (c) workflow
orchestration (assistant creates the card, doesn't describe it),
(d) prompt-language pinning via X-UI-Language.

---

## 7. Semantic retrieval / embeddings

**Q7.1.** How do you search for an event by a phrase like "winter
holidays"?
**A.** (1) Embed the query via Gemini text-embedding-001
(`embedQuery`), cache in `embedding_cache` keyed by sha1. (2)
Cosine-similarity KNN over `event.embedding` (lazily backfilled by
`ensureEventEmbeddings`). (3) Top-k by similarity.

**Q7.2.** What does the embedding cache store?
**A.** `key` (sha1 of text or a manual key), `vector []float64`,
`created_at`. Used for (a) chat user queries, (b) cold-start tagging
similarity, (c) event backfill.

**Q7.3.** What's "cold start"?
**A.** When rule-based tagging returns fewer than 3 tags, we ask
Gemini with few-shot context. To avoid paying twice for the same
text, every SKU embedding is cached.

**Q7.4.** How does KnnEvents work?
**A.** SurrealQL:
`SELECT * FROM event WHERE embedding <|10,COSINE|> $v ORDER BY sim DESC LIMIT $k`.
If HNSW isn't available (dev DB), we fall back to brute-force
cosine. The service.go call is transparent.

**Q7.5.** Can the search return irrelevant events?
**A.** Top-K always returns something. So the chat prompt has an
instruction: if similarity is below a threshold, the model itself
says "no exact match — could you clarify?".

**Q7.6.** How is embedding different from tag-match?
**A.** Tag-match is exact: SKU has `honey` tag → event needs
`honey` → match. Embedding is semantic: "honey theme" in chat → the
vector search finds Saviour, beekeeper, honey week — even when the
query doesn't contain the word "honey".

**Q7.7.** Why 768d, not 1536d?
**A.** Gemini embedding-001 is natively 768d. OpenAI's is 1536d, but
for our scenario the quality difference is ~2%. 768d indexes twice
as fast.

---

## 8. ROI engine

**Q8.1.** What is the deterministic ROI?
**A.** A pure Go function in `services/recommendation/roi.go`. No
LLM. The formula is a few named multipliers with explicit constants.
Same input → same output. Auditable.

**Q8.2.** What's the formula?
**A.** `Δorders = match_score × audience_overlap × channel_mult ×
seasonality × promo_mult`. Every multiplier is a separate function
with reasoning. `Δrevenue = Δorders × avg_basket(farmer)`.

**Q8.3.** Where do the coefficients come from?
**A.** Today — engineering estimates with explicit names
(`baseAudienceWeight = 0.6`, `pushChannelBoost = 1.3`). On real
marketplace data they're calibrated via Bayesian update against
plan_card.result_orders.

**Q8.4.** What do you mean by "learns"?
**A.** Dragging a card into the `live` column writes an ai_memory
record with a signal. On the next match the recommender reads those
memory signals and shifts scores. Memory is per-farmer; the merge
happens in `match.go`.

**Q8.5.** Why doesn't the LLM compute the forecast?
**A.** Two reasons. (1) Money cannot be trusted to a model — a
hallucinated number is catastrophic. (2) You cannot defend "because
the model said so" to a judge or a farmer — but you can show the
formula in a popover.

**Q8.6.** Can you trace a number back to its inputs?
**A.** Yes, see `roi-popover.png` in screenshots. Hover on any
number — a breakdown pops up: match=0.93, audience=0.78,
seasonality=1.2 → result.

**Q8.7.** What's the forecast error?
**A.** Without real marketplace data — unknown. We plan to measure
during the 5-farmer pilot: send→open→buy funnel. Coefficient
calibration is on the roadmap.

**Q8.8.** Why is ROI auditable?
**A.** Pure Go, no external calls, no randomness. You can run
`go test` with a fixture and get the same answer. That's the
definition of "money under audit".

---

## 9. Data and ETL

**Q9.1.** Where does SKU data come from?
**A.** `data/raw/farmers_sku.xlsx` — a real export from the
marketplace. `cmd/import` parses XLSX, normalises, writes to
SurrealDB. Result: 3,491 SKUs across 65 farmers.

**Q9.2.** Where do events come from?
**A.** `data/seed/events.yml` — a curated KB. 40+ events: state
holidays, Orthodox calendar (Easter, Saviours), professional days
(Beekeeper's Day), seasonal windows, themed weeks, marketplace
trends.

**Q9.3.** Who writes the KB?
**A.** Currently — the team manually. Sources: Russian Orthodox
Church calendar, State Duma official holidays, marketplace
analytics. The plan is to let farmers edit the KB via the UI.

**Q9.4.** What audiences?
**A.** 9 in `audiences.yml`: families, parents, gourmets,
eco_buyers, repeat_buyers, gift_givers, zozh (healthy living), kids,
regional_specialty. Each described via product_tags + behavioural
signals.

**Q9.5.** What are trends?
**A.** Dynamic signals from `trends.yml` — e.g. "fermentation +24%",
"glutenfree +12%". Backend blends them into the recommender as an
audience multiplier. Plan — auto-refresh from a marketplace API.

**Q9.6.** How are tags applied to SKUs?
**A.** `cmd/tag-products`: (1) rules first (`tagging/rules.go`) —
substrings, category. (2) If rules produced ≥3 tags — stop. (3)
Otherwise Gemini fallback with few-shot. (4) Bulk upsert. Cheap: 95%
covered by rules.

**Q9.7.** How many tags per SKU?
**A.** 3–8 on average. From ≈80 canonical tags (easter, premium,
vegan, gift, gourmet, honey, seasonal, …).

**Q9.8.** What about categories?
**A.** Hierarchy of 8 top categories: dairy, vegetables, berries,
honey, cheese, baking, preserves, meat. From XLSX. The recommender
uses category as a fallback after tag-overlap.

**Q9.9.** How is a new farmer imported?
**A.** Via the admin panel: a `farmer:<id>` record is created with
organization_id. Then `cmd/import` picks up the SKUs by
organization_id. At full scale — a webhook from the marketplace.

**Q9.10.** GDPR?
**A.** All farmer data is what they voluntarily publish on the
marketplace. No customer PII in our DB. Export/delete — through the
admin panel.

---

## 10. Production readiness

**Q10.1.** Where is it deployed?
**A.** Coolify-managed VPS, domain via Cloudflare, Traefik for TLS
termination. All three services (surrealdb, api, web) in one Docker
network via docker-compose.prod.yml.

**Q10.2.** How is redeploy done?
**A.** Git push to main → Coolify webhook → docker compose build →
rolling restart with healthcheck. No downtime for web (rolling),
≈3-second blip for API.

**Q10.3.** Logging?
**A.** zerolog in Go (structured JSON), `docker logs` for web/db.
The Coolify UI reads logs from all three services. In production —
JSON-file driver with rotation (max 10MB × 3 files).

**Q10.4.** Monitoring?
**A.** Healthchecks in docker-compose (HTTP /health on api,
container status on web). Coolify dashboard for CPU/memory.
Application-level metrics are next-sprint work.

**Q10.5.** What if the DB breaks?
**A.** Restart policy `unless-stopped`. Volume persistence. Daily
snapshots from Coolify volume snapshots (enabled). Recovery ≈5
minutes.

**Q10.6.** Security?
**A.** (1) Sessions in DB, revocation works. (2) Rate-limit on
login. (3) CORS allowlist via env. (4) All public endpoints behind
RequireAuth except landing and login. (5) Admin routes behind
RequireAdmin. (6) HTTPS-only via Traefik.

**Q10.7.** XSS?
**A.** React doesn't allow dangerouslySetInnerHTML anywhere in the
codebase (verified). Content from Gemini is JSON, not HTML. CSP
headers in nginx.

**Q10.8.** Prompt injection?
**A.** Farmer inputs come through structured forms, not free text.
The only free-text path is the AI workspace, and outputs there are
sandboxed in the workspace until the user explicitly saves them.

**Q10.9.** Denial-of-wallet (Gemini billing)?
**A.** RequireAuth on /api/auth/login, /generate, /chat.
Rate-limiting on login. Per-farmer fan-out — cached in
`generated_content` by (suggestion, channel, variant) — reopening a
suggestion doesn't re-pay.

**Q10.10.** What's in .env.production?
**A.** GEMINI_API_KEY, SURREAL_USER/PASS, SESSION_SECRET (for
opaque tokens), CORS allowlist, optional PUBLIC_API_URL +
PUBLIC_APP_NAME for FE build-time injection.

**Q10.11.** How does Coolify store secrets?
**A.** Coolify encrypts env vars in its encrypted DB; access is
restricted to the operator. `.env.production` is gitignored.

**Q10.12.** CI/CD?
**A.** Git push to main → Coolify webhook → build → deploy.
Pre-deploy hooks: go test, npm run build, tsc --noEmit. On a green
build — swap.

---

## 11. Scaling

**Q11.1.** What happens at 10,000 farmers?
**A.** Embeddings are one-time per SKU (3,491 × ~10 catalogs =
34,910 vectors; embed in ≈80 minutes). Catalog grows linearly.
Generation is on-demand per campaign ≈1 per week per farmer, totaling
≈10,000 fan-outs per week. Bottleneck — Gemini rate limits, not our
infra.

**Q11.2.** Gemini cost at 10K farmers?
**A.** ≈10,000 campaigns × $0.012 ≈ $120/week in Gemini billing.
$6,240/year. Pocket money for RSHB.

**Q11.3.** Will SurrealDB cope?
**A.** Reads — yes, with read replicas. Writes — one campaign create
= 1 suggestion + 6 generated_content + 1 plan_card = 8 rows × 10K ×
weekly = 80K writes/week. Trivial for RocksDB.

**Q11.4.** Horizontal scaling of the API?
**A.** The Go API is stateless. Sessions in DB. Runs behind a load
balancer without sticky sessions. Today one instance; adding more is
linear.

**Q11.5.** What about inactive farmers?
**A.** Fan-out only pays when clicked — nothing for inactive
farmers. Embeddings — once in life. Accumulating cost is only
storage, pennies.

**Q11.6.** What if you hit a Gemini rate limit?
**A.** Current Flash limit is 1500 RPM. At 10K farmers × 1 fan-out
per week = 60K requests/week = 9 RPM — no load. 100× headroom.

**Q11.7.** Growing beyond 10K?
**A.** Sharded Gemini API keys (by region). Per-shard rate limits
add up. Alternative — provisioned throughput, ≈$50K/year for
unlimited.

**Q11.8.** What about a farmer in Magadan — latency?
**A.** SurrealDB cluster within the RF perimeter, Gemini edge via
Google Cloud RU (when not under sanctions). Today's demo VPS in
Moscow — ping 150ms from Vladivostok. Fully acceptable.

---

## 12. Roadmap

**Q12.1.** What in the next 30 days?
**A.** Pilot with 5 farmers across different categories. Instrument
the send→open→buy funnel. A/B copy via embeddings. Calibrate ROI
coefficients on real Δorders.

**Q12.2.** What in 90 days?
**A.** (1) Auto-dispatch: push, story, social posts via the
marketplace API. (2) Telegram bot for farmer notifications. (3)
Webhook intake of marketplace analytics for calibration. (4)
YandexGPT provider as an option.

**Q12.3.** What in 365 days?
**A.** All 10,000 farmers of the marketplace. Per-farmer ai_memory
accumulates — the cold-start problem disappears. White-label for
other agro-marketplaces. +₽500M of additional revenue.

**Q12.4.** What will you NOT do?
**A.** (1) Won't leave the agro vertical. (2) Won't become our own
marketplace — we complement "Svoe Rodnoe". (3) Won't be cheaper than
auto-posting services — we're about the event window, not the spam.

**Q12.5.** What's the weakest point?
**A.** The accuracy of the ROI forecast without real data. Today —
a model with engineered constants. The pilot will calibrate; until
then we say honestly "forecast ±25%".

---

## 13. Team and process

**Q13.1.** Who did what?
**A.** [Fill in names] — Backend Go + SurrealDB schema; FE React +
i18n + landing; AI prompts + chat orchestration; DevOps Coolify
deploy; product UX + design.

**Q13.2.** How many hours?
**A.** ≈[X] person-hours during the hackathon. Of that: ≈40% on
integration (schema ↔ API ↔ FE), ≈30% on features, ≈30% on polish
and demo.

**Q13.3.** What tools did you use?
**A.** Claude Code + Cursor for pair-coding. GitHub + Coolify for
deployment. Figma for design tokens. SurrealDB playground for
query development.

**Q13.4.** What was hardest?
**A.** Hybrid retrieval (tag → category → KNN) — balancing exact
match and semantic. And prompt engineering for structured-JSON
fan-out, so 6 channels return non-contradictory copy.

**Q13.5.** What didn't you finish?
**A.** Telegram bot (architecture ready — stubs in content.go). A/B
copy via embedding clustering. Real integration with the
marketplace's push API.

---

## 14. Critical / skeptical ("it's a GPT wrapper")

**Q14.1.** This is just a GPT wrapper.
**A.** No, and I can prove it in 30 seconds with three points.
(1) Money path — money is computed by a Go formula, not by the
model. (2) Hybrid retrieval — the model writes on a filtered subset,
not on a raw index. (3) Fallback — the product works without the
LLM. A GPT wrapper has none of these properties.

**Q14.2.** Why SurrealDB when Postgres exists?
**A.** One engine instead of three (documents + graph + vector).
Fewer operational primitives means fewer incidents. The cost is a
smaller community. We accept that cost; migration to
Postgres+pgvector+Neo4j fits in 2–3 weeks if scale demands it.

**Q14.3.** What if Gemini is banned or sanctioned?
**A.** The LLM gateway is one file, `gemini.go`, with signature
`(system, user, schema, out)`. YandexGPT, GigaChat, Claude via proxy
— provider swaps in 10 minutes. For RSHB the obvious fallback is
YandexGPT.

**Q14.4.** The ROI forecast — did you make it up?
**A.** The formula is closed and visible in `roi.go`. The
coefficients are engineering estimates today. On the pilot they
calibrate against real Δorders. This is not AI; it's honest math.

**Q14.5.** Where does the ₽500M number come from?
**A.** 10,000 farmers × average +5 orders/week × average basket
₽500 × 52 weeks ≈ ₽130M. If we assume +10 orders/week — ₽260M.
₽500M is the optimistic 3-year ceiling — we label it accordingly.

**Q14.6.** What if the farmer is lazy?
**A.** A campaign assembles in 5 seconds + one click to publish.
The friction point is publication, not creation. A push notification
reminds at the right window. UX is the next product step.

**Q14.7.** What if your brand voice doesn't fit?
**A.** Every generation is a draft; the farmer edits it in 30
seconds. Revision history is available; A/B copy is planned. The
prompt is parametrised on farmer_voice (recorded in
`prompt_version`).

**Q14.8.** Who will maintain this after the hackathon?
**A.** The team is ready to continue — three of us in open-source
mode, two in commercial interest. RSHB Digital — if they're
interested, we're in dialogue. Otherwise — open source on GitHub.

**Q14.9.** How much data do you actually have?
**A.** 3,491 SKUs from a real XLSX — not a mock. 65 farmers in seed
(we can show the list). 40+ events in a hand-curated KB. 158
ai_memory signals accumulated during development.

**Q14.10.** Where does the 10K farmers number come from?
**A.** Public data from "Svoe Rodnoe" and RSHB Digital. If we're off
by 2× — economics are still positive: $6K/year Gemini against
₽250M of additional revenue.

**Q14.11.** What if the marketplace builds this themselves?
**A.** They probably will — in 1–2 years. We offer a ready product
as white-label, or as a team acquisition. Time-to-market is our
advantage.

**Q14.12.** Where's the documentation?
**A.** `/docs/`: ARCHITECTURE.md, DEPLOYMENT.md,
SURREALDB_ARCHITECTURE.md, DEMO_SCRIPT.md, COVERAGE.md,
USER_MANUAL.md. README.md at the root. Everything is markdown in
the repo.

**Q14.13.** Have you tested with a real farmer?
**A.** Not yet; the pilot is step one of the roadmap. Internally —
we run the demo farmer "Ekoferma OGO-ROD" (id 10060) 3–4 times per
day across the entire hackathon.

**Q14.14.** Who verified the AI doesn't write nonsense?
**A.** Three-layer review: (1) JSON schema enforces shape, (2)
prompts explicitly forbid invention, (3) deterministic fallback on
schema error. Plus revision history — the farmer is the final
gatekeeper.

**Q14.15.** Production-ready? Show the live URL.
**A.** [Coolify URL]. Opens from mobile, RU/EN switch works, demo
without login, authenticated cabinet behind login.

---

## 15. Tricky technical

**Q15.1.** Why 768d, not 1536d?
**A.** Gemini embedding-001 is natively 768d. For our event-
similarity scenario the +5% quality from 1536d doesn't justify ×2
storage and ×1.5 latency.

**Q15.2.** Why cosine and not L2?
**A.** Cosine is invariant to vector norm, which matters when text
lengths vary (short title vs long description). For RAG — standard.

**Q15.3.** What about TF-IDF for matching?
**A.** Considered — for our scale (3,491 SKUs) it's overkill.
Tag-match + embedding covers 95% of cases. TF-IDF — at the next
scale tier.

**Q15.4.** What's the matching algorithm?
**A.** `recommendation/match.go::MatchProducts(event, products)`:
(1) For each product, score = tag_overlap × 3 + category_match × 1 +
embedding_sim × 0.5. (2) Sort descending. (3) Top-N with reason
chips.

**Q15.5.** How do you handle the SKU × event grid?
**A.** Every product → every event can be scored. Caching: one
`suggestion` per (farmer, event); recomputation happens only when
the catalog or event changes.

**Q15.6.** What HNSW parameters?
**A.** SurrealDB defaults: m=16, ef_construction=200. For 10K–50K
vectors more than enough. Tuning — the last step of scaling.

**Q15.7.** Concurrency in the Go fan-out?
**A.** `services/ai/content.go::GenerateAll` launches a goroutine
per channel in an `errgroup.Group`. Wall-clock = max(channel
latency). Cancellation propagates through context.Context.

**Q15.8.** Retries against Gemini?
**A.** Base exponential backoff in `gemini.go`. On transient errors
(429, 500) — 3 retries. On validation errors (400) — no retries,
falls into the fallback path.

**Q15.9.** How do you store passwords?
**A.** bcrypt with cost=10 in `app_user.password_hash`. Comparison
via constant-time compare. No unsalted SHA256.

**Q15.10.** Brute-force protection?
**A.** Rate-limit middleware (`AUTH_LOGIN_RATE_LIMIT`,
`AUTH_LOGIN_RATE_WINDOW_MIN`). Default: 10 attempts per 15 minutes
per IP. Failed logins are logged.

**Q15.11.** What about CSRF?
**A.** Bearer token in Authorization header → not exposed to CSRF
(requires an explicit JS request with the correct header). If we
used cookies, we'd need a CSRF token. That's why localStorage is a
deliberate choice.

**Q15.12.** Isn't localStorage XSS-vulnerable?
**A.** Known trade-off. Mitigations: (1) CSP headers forbid inline
scripts, (2) React doesn't allow dangerouslySetInnerHTML in our
code, (3) npm audit is clean.

---

## 16. Demo-killer questions (the closing round)

**Q16.1.** What was your proudest moment of the build?
**A.** When the redesigned AI assistant (strategist mode) first
proposed a specific action — "add a card to the plan" — and
actually added it. It stopped being a chatbot and became a
colleague.

**Q16.2.** If you had one extra day?
**A.** Calibrate the ROI on synthetic data + add the Telegram bot
for push notifications. Those two reinforce the "AI works in the
background" message.

**Q16.3.** What would you steal from competitors?
**A.** Nothing from existing competitors — there are none in our
niche. From mobile apps — the Wildberries seller dashboard's
realtime concept with trend signals.

**Q16.4.** If you don't win the hackathon — what next?
**A.** We open-source the code and share architecture lessons with
RSHB. The idea stays valuable regardless of the outcome — we have a
working prototype for future pitches.

**Q16.5.** Who else needs this?
**A.** Any agro-marketplace (X5 Group's Perekrestok Delivery, Sber
Market, Ozon Fresh). Any DTC food with an SKU catalog. Multi-tenant
B2B SaaS — natural fit.

---

## 17. Bonus: "I don't know, but…"

When you don't know the answer — DO NOT make it up. Use one of:

- **"I don't remember the exact number, but the order of magnitude
  is X"** (trust > a fabricated precise number)
- **"I didn't build that — [NAME] did, ask them and they'll
  explain"**
- **"Let me check, I can answer in a moment"**
- **"In our scenario it didn't come up, but if it does — plan Y"**

The worst thing you can do is invent a specific number that another
judge fact-checks in 20 seconds on Google.

---

## 18. Answer timings

| Question type        | Target length    | Example  |
|----------------------|------------------|----------|
| Elevator pitch       | 25–30 sec        | Q0.1     |
| Business             | 15–20 sec        | Q1.4     |
| Technical            | 10–25 sec        | Q5.1     |
| Critical / defense   | 15–30 sec        | Q14.1    |
| "I don't know"       | 5–8 sec          | §17      |

Longer than 30 seconds — we lose the room. Shorter than 5 seconds —
we look unsure.

---

**Final notes:**

- If the judge speaks Russian — use the RU file
  (`docs/PITCH_QA.md`). Same structure, same numbering.
- If the judge speaks English — this file. Translate numbers on the
  fly: 3,491 / 65 / 40+ / 768-d / 6 channels / 11 edge types / 158
  signals / 200 i18n keys / 5s fan-out.
- Memorise the numbers in **Appendix A** of
  `PITCH_DECK_GUIDE.md` — those have to come off the tongue without
  thinking.

Good luck 🍀
