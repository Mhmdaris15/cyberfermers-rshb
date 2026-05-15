# Claude Design Brief — Своё Родное Calendar pitch deck

> **Audience:** Claude (design generation tool). This document is a complete, self-contained brief you can paste in one shot. No follow-up needed.
> **Goal:** generate a 13-slide hackathon pitch deck for the РСХБ.Цифра hackathon.
> **Output format:** dark-theme, editorial-aesthetic slides (16:9, 1920×1080), one file per slide or a single carousel.
> **Companion docs:** `docs/PITCH_DECK_GUIDE.md` (long-form blueprint), `docs/DEMO_SCRIPT.md` (live demo script).

---

## Section 0 — Generate this exact deck

A 13-slide pitch deck for the **Своё Родное Calendar** project — an AI marketing platform for Russian farmers. Russian-language UI primary, English secondary. The deck must look like a continuation of the product, not a marketing template.

**Hard constraints**
- 16:9 aspect ratio (1920×1080).
- Dark theme. Warm near-black background (`#0c0e0a`).
- Two fonts only: **Fraunces** (variable serif, italic axis) for display, **IBM Plex Sans** for body. **IBM Plex Mono** allowed for stats and code.
- Editorial-dusk aesthetic. Restrained. Typographic.
- One accent color per slide. Never more than one.
- No stock photos. No AI clip art. No purple gradients. No sparkle emojis. No bullet soup.
- Russian text primary. Provide English subtext only on slides 1 and 4.

**Output**
- 13 slide images (or 13 frames in one carousel).
- Plus a 14th cover/back slide with a QR code placeholder + contact line.

---

## Section 1 — Brand contract

### 1.1 Color tokens (use as CSS-like)

```
--bg              #0c0e0a   page background (warm near-black, faint grain)
--bg-elevated     #13150f   cards, panels
--bg-subtle       #1a1d15   subtle fills
--ink             #ece7d8   primary text
--ink-dim         #9b988a   secondary text
--ink-mute        #6c6a5e   tertiary, smallcaps
--line            #262519   hairline borders
--leaf            #7fb069   primary accent — growth, success
--amber           #d4a04c   warm accent — harvest, warning
--plum            #9c6b9c   secondary accent — trend
--sky             #7aa6c9   cool accent — audience
--rust            #c47a4a   earth accent — season
```

**Dominant pair:** leaf + amber. Plum/sky/rust = one per slide as spice.

### 1.2 Typography rules

- **Display headlines:** Fraunces. Use the **italic variable axis** on ONE word per slide for editorial register ("у нас *выходит*", "your *campaign*, ready"). Weight 500–600. Optical size set for display.
- **Body / subtext:** IBM Plex Sans, weight 400 (body), 500 (labels).
- **Smallcaps / eyebrow:** IBM Plex Sans 500, tracking +0.1em, all caps, 11–13px.
- **Stats:** IBM Plex Mono, tabular numerals (`tnum`). Always mono for numbers.
- **Never** mix more than 3 weights per slide.

### 1.3 Layout rules

- Generous negative space. Never crowd the edge — minimum 80px outer padding.
- Hairline dividers (`--line`, 1px) instead of solid borders.
- Asymmetric grids preferred over centered slabs. Editorial, not corporate.
- Faint film grain over the background (low opacity, ~3%).
- Max 3 visual elements per slide (excluding hairlines/background).

### 1.4 Motion (if exporting animated frames)

- Slide entry: 300ms ease-out cubic `cubic-bezier(0.2, 0.65, 0.2, 1)`.
- Text reveal: 60ms stagger per line.
- Stat counters: count-up once on entry, 300ms.
- NEVER: fly-ins, bounces, dissolves, parallax, "Keynote default" feel.

### 1.5 Forbidden aesthetics

- Purple-on-white SaaS gradients.
- Stock photography (farmers, fields, hands holding produce).
- Cartoon AI mascots, robot icons, magic wand / sparkle emoji.
- Logo wall slides.
- Generic startup template fonts (Inter, Roboto, Arial, Poppins, Manrope).

---

## Section 2 — Slide-by-slide content

For each slide: literal text content (RU primary), one-sentence design instruction, accent color, screenshot reference (if any).

---

### Slide 1 — Title / Hero

**Accent:** none (editorial pure typography).
**Visual instruction:** Fullbleed dark background with faint film grain. Center-left, large Fraunces serif lockup. Far right, decorative crop of the seasonality ring (a thin amber circular arc with calendar tick marks rotating slowly). Bottom hairline divider, team line in IBM Plex small-caps.
**Composition:** asymmetric — text 60% width left, ring 40% right.

**Text content:**
- Display (Fraunces, large): **Своё Родное** *Calendar*
- Subtitle (IBM Plex Sans, regular, --ink-dim): AI-маркетолог для 10 000 российских фермеров
- English subline (Fraunces italic, smaller, --ink-mute): *An AI marketer for 10,000 Russian farmers*
- Bottom-left smallcaps (IBM Plex, --ink-mute): ХАКАТОН РСХБ.ЦИФРА · 2026
- Bottom-right smallcaps (IBM Plex, --ink-mute): TEAM · DATE

---

### Slide 2 — The Problem

**Accent:** rust (`--rust` for the highlighted stat).
**Visual instruction:** Three stat blocks in a horizontal row, generous spacing. Stat numbers in giant Fraunces (180–220px), labels in IBM Plex smallcaps underneath. No icons. Background pure --bg with grain.
**Composition:** asymmetric — first stat slightly elevated, third slightly recessed, suggests cascade.

**Text content (eyebrow):** ПРОБЛЕМА

**Three stat blocks:**
1. **10 000** (Fraunces, --ink) / фермеров на маркетплейсе «Своё Родное» (smallcaps, --ink-dim)
2. **20%** (Fraunces, --rust) / повторных заказов — против 45–60% benchmark (smallcaps, --ink-dim)
3. **₽80–150K** (Fraunces, --ink) / в месяц стоит маркетинговое агентство — фермер не позволит (smallcaps, --ink-dim)

**Bottom line (Fraunces italic, medium, --ink):**
> *Фермер не маркетолог. Каждый сезонный пик проходит мимо.*

---

### Slide 3 — The Insight

**Accent:** amber (for the connecting line).
**Visual instruction:** Two boxes side by side connected by a thin amber line labeled "structured JSON" in mono. Boxes use --bg-elevated, hairline borders. Inside each box: a label in smallcaps + a single line of body text. Pure diagram, no decorative elements.

**Text content:**
- Eyebrow: ТЕЗИС
- Display headline (Fraunces): **AI не продаёт.** *AI планирует.* Фермер — продаёт.

**Left box:**
- Label (smallcaps): КАЛЕНДАРЬ
- Body: задача поиска — события × каталог × сезон

**Right box:**
- Label (smallcaps): КАМПАНИЯ
- Body: задача генерации — структурированный JSON, 6 каналов

**Connecting line label (mono, --amber):** `structured JSON`

**Footer (small, --ink-mute):** Разные задачи — разные инструменты.

---

### Slide 4 — Product Hero (Landing snapshot)

**Accent:** leaf.
**Visual instruction:** Two side-by-side cropped screenshots of the landing hero — RU left, EN right. Cards with rounded 16px corners, dim 20px shadow on --bg-elevated. Thin hairline divider between them with "RU · EN" smallcaps label.
**Composition:** equal split, identical viewport, single product.

**Text content:**
- Eyebrow: ПРОДУКТ
- Display (Fraunces): У нас уже *выходит*.
- Body (IBM Plex, --ink-dim): Лендинг, кабинет фермера, AI-генерация, план, сторис, блоги, рецепты, соцсети, push, админ-панель — на двух языках. Развёрнуто на Coolify.
- Bottom smallcaps row (--ink-mute, --leaf dot before each): СAYCASE · RU + EN · COOLIFY · 3 491 SKU · 65 ФЕРМЕРОВ

**Screenshot reference:** `landing/hero-ru.png` (left), `landing/hero-en.png` (right).

---

### Slide 5 — Demo handoff

**Accent:** none.
**Visual instruction:** Near-empty slide. Centered single Fraunces italic line. Tiny mono caption underneath. Background pure --bg with grain. This slide buys 5 seconds to alt-tab.

**Text content:**
- Center (Fraunces italic, large, --ink): *Демо · Live*
- Below (mono, very small, --ink-mute): 3 минуты

---

### Slide 6 — How it works (3 steps)

**Accent:** leaf + amber + plum (one per step).
**Visual instruction:** Three numbered cards in a row. Each card: large numeral (Fraunces, --accent-of-step), eyebrow label (smallcaps), one-line body (IBM Plex). Cards on --bg-elevated, hairline border, rounded 12px. Equal width.

**Text content:**
- Eyebrow: КАК ЭТО РАБОТАЕТ

**Card 1 (--leaf):**
- Numeral: **01**
- Label: MATCH
- Body: Совпадение SKU фермера × событий × региона. Tag overlap → category → KNN на 768-d HNSW.

**Card 2 (--amber):**
- Numeral: **02**
- Label: GENERATE
- Body: 6 каналов параллельно — Push · Story · Blog · Recipe · Chat · Social. Structured JSON, Gemini 2.5 Flash.

**Card 3 (--plum):**
- Numeral: **03**
- Label: PLAN
- Body: Канбан с прогнозом ROI на карточке. Drag → planned → live. Учится на результатах.

---

### Slide 7 — Real product features (gallery)

**Accent:** none (let screenshots carry it).
**Visual instruction:** 3-row × 4-column grid of small screenshot tiles (320×200px each, rounded 8px, hairline border). Each tile: cropped screenshot + caption underneath in IBM Plex smallcaps + one-line description in --ink-dim. Mute non-focused tiles to 70% opacity.

**Text content:**
- Eyebrow: НЕ ОДИН ЭКРАН

**12 tiles (in this order):**
1. ДАШБОРД — KPI + action cards
2. КАЛЕНДАРЬ — 40+ событий
3. AI-WORKSPACE — slash-команды
4. ПЛАН — Kanban + 4 таба
5. СТОРИС — image-prompt + caption
6. БЛОГИ — two-pane writer
7. РЕЦЕПТЫ — структурированные поля
8. СОЦСЕТИ — multi-platform preview
9. PUSH — lock-screen + диспатч
10. ROI — детерминированный движок
11. АДМИНКА — пользователи + сессии
12. ЛЕНДИНГ — editorial-dusk

**Screenshot references:** `app/dashboard.png`, `app/calendar-month.png`, `app/ai-workspace-starter.png`, `app/plan-card-drawer.png`, `app/stories-editor.png`, `app/blog-editor.png`, `app/recipe-editor.png`, `app/social-editor.png`, `app/push-editor.png`, `app/roi-popover.png`, `app/admin-users.png`, `landing/hero-ru.png`.

---

### Slide 8 — Not a GPT wrapper

**Accent:** leaf, amber, plum (one per claim).
**Visual instruction:** Three columns. Each column: a small accent dot at top, a smallcaps label, a Fraunces italic headline, a single body line. No icons.

**Text content:**
- Eyebrow: ПОЧЕМУ ЭТО НЕ ОБЁРТКА GPT

**Column 1 (--leaf):**
- Label: ДЕТЕРМИНИРОВАННЫЙ ROI
- Headline (Fraunces italic): *Деньги — на Go.*
- Body (IBM Plex, --ink-dim): Δorders = match × audience × channel × seasonality. Никакая модель не управляет цифрами.

**Column 2 (--amber):**
- Label: ГИБРИДНЫЙ ПОИСК
- Headline (Fraunces italic): *Сначала фильтр.*
- Body: Tag overlap → category → KNN 768-d. Модель пишет — но на отфильтрованной выборке.

**Column 3 (--plum):**
- Label: FALLBACK
- Headline (Fraunces italic): *Демо не падает.*
- Body: Gemini лежит — детерминированная копия рендерится. Pipeline стабилен.

---

### Slide 9 — Architecture (the one diagram)

**Accent:** sky (for node accents) + amber (for data-flow lines).
**Visual instruction:** Reproduce the `LandingArchitecture` graph: 6 nodes in a soft asymmetric layout, connected by dashed amber lines with a "flow" effect (dashes offset). Each node = a small card with a label + sub-label. Two annotation tags floating ("embed", "tag", "planning") on the lines.

**Node positions and labels:**
- **fe** (top-left): Frontend / React + Vite · Tolgee · Framer
- **api** (top-center): API / Go + Gin · sessions · zerolog
- **db** (top-right): SurrealDB 2.x / docs · graph · vector 768-d
- **ai** (bottom-center): Gemini 2.5 Flash / structured JSON · embed-001
- **rec** (bottom-left): Recommender / tag → category → KNN
- **tag** (bottom-right): Tagging / rules → LLM fallback

**Edges (dashed, --amber, with animated dashoffset if animated):**
- fe → api, api → db, api → ai, ai → rec, db → rec, db → tag

**Eyebrow:** АРХИТЕКТУРА — ОДНА ДИАГРАММА
**Footer (small, --ink-mute):** Coolify · Docker · Traefik · TLS · nginx

**Screenshot reference:** `landing/architecture-graph-full.png`.

---

### Slide 10 — SurrealDB (one engine vs three)

**Accent:** rust (strikethrough on left), leaf (highlight on right).
**Visual instruction:** Two halves with a vertical hairline. Left half = "the boring way" — three small boxes (PostgreSQL, Pinecone, Neo4j) with a thin --rust strikethrough drawing on entry. Right half = "our way" — one larger box labeled SurrealDB. Single mono code snippet underneath right side.

**Text content:**
- Eyebrow: ОДНО ХРАНИЛИЩЕ
- Left header (smallcaps, --ink-mute): СКУЧНЫЙ ПУТЬ
- Three boxes (struck through): PostgreSQL · Pinecone · Neo4j
- Right header (smallcaps, --leaf): НАШ ПУТЬ
- One box (Fraunces): **SurrealDB 2.x**
- Sub-text under right box (IBM Plex, --ink-dim): docs + graph + 768-d HNSW · 11 типов рёбер · 3 491 SKU · один контейнер

**Mono snippet (--ink-dim, IBM Plex Mono, small):**
```surql
SELECT * FROM product
WHERE vector::similarity::cosine(embedding, $v) > 0.8
  AND ->product_tag.tag CONTAINS 'honey'
LIMIT 12;
```

**Footer (Fraunces italic, --ink):** *Скучно — потому что работает.*

---

### Slide 11 — Production readiness

**Accent:** leaf.
**Visual instruction:** Vertical checklist of six rows. Each row: a small leaf dot, a label in smallcaps, a one-line description in --ink-dim. Hairline divider between rows. Right side: optional small Coolify dashboard screenshot crop with blurred secrets.

**Text content:**
- Eyebrow: ГОТОВНОСТЬ К ПРОДУ

**Six rows:**
1. DOCKER — `docker compose up` поднимает весь стек
2. COOLIFY · TRAEFIK — автоматический TLS, HTTPS из коробки
3. ДВУЯЗЫЧНОСТЬ — Tolgee i18n · RU + EN · ~200 ключей · AI-вывод тоже переключается
4. АУТЕНТИФИКАЦИЯ — JWT-less сессии · RequireAuth guard · /admin/users + /admin/sessions
5. РЕВИЗИИ КОНТЕНТА — content_revision таблица · полная история · откат за один клик
6. FALLBACK — детерминированная копия на каждом канале · Gemini падает — демо нет

**Footer (Fraunces italic, --ink):** *Не «в продакшене мы бы…» — «оно делает».*

---

### Slide 12 — Roadmap

**Accent:** amber (for the connecting line at the bottom).
**Visual instruction:** Three vertical columns labeled 30d / 90d / 365d. Each column: a smallcaps timeframe header, 2–3 short bullet lines in --ink. Thin amber line connecting the bottoms of all three columns, suggesting time flow.

**Text content:**
- Eyebrow: ДОРОЖНАЯ КАРТА

**Column 1 — 30 ДНЕЙ:**
- 5 пилотных фермеров
- Инструментирование send → open → buy
- A/B копи через embeddings

**Column 2 — 90 ДНЕЙ:**
- Auto-dispatch push + story
- Telegram-бот
- Калибровка ROI на реальных Δorders

**Column 3 — 365 ДНЕЙ:**
- Все 10 000 фермеров маркетплейса
- Per-farmer ai_memory · cold-start исчезает
- +500M ₽ дополнительной выручки/год

---

### Slide 13 — Team + closing

**Accent:** leaf.
**Visual instruction:** Asymmetric. Left 60%: team list — each person on one line, Fraunces italic for name, IBM Plex smallcaps for role. Right 40%: QR code placeholder (240×240px) with a small label "demo" below in mono. Bottom hairline divider. Closing line in Fraunces italic, centered below the divider.

**Text content:**
- Eyebrow: КОМАНДА

**Team rows (placeholder — designer fills):**
- *[Имя]* — РОЛЬ · ОДНА СТРОКА ВКЛАДА
- *[Имя]* — РОЛЬ · ОДНА СТРОКА ВКЛАДА
- *[Имя]* — РОЛЬ · ОДНА СТРОКА ВКЛАДА

**Right QR section:**
- QR placeholder (240×240px, rounded 8px, --ink on --bg)
- Below QR (mono, --ink-mute): demo.svoe-rodnoe.app

**Bottom closing (Fraunces italic, centered, large, --ink):**
> *AI не продаёт. AI планирует. Фермер — продаёт.*

**Footer line (smallcaps, --ink-mute):** SPASIBO · ХАКАТОН РСХБ.ЦИФРА · 2026

---

## Section 3 — Recently shipped features (Phases 2-12) — must be reflected

Every slide must respect these are SHIPPED features, not roadmap items. Slide 7 names them; slide 11 references three of them; slides 6 and 8 are powered by them.

| Phase | Surface | Slide(s) where it appears |
|---|---|---|
| 2 | Content lifecycle / revisions | Slide 11 (row 5) |
| 3 | Rich plan board (4-tab card drawer + BoardSwitcher) | Slide 6 (Plan card), Slide 7 (Plan tile) |
| 4 | Stories standalone page | Slide 7 (Stories tile) |
| 5 | Blogs standalone page | Slide 7 (Blogs tile) |
| 6 | Recipes standalone page | Slide 7 (Recipes tile) |
| 7 | Social standalone page (multi-platform) | Slide 7 (Social tile) |
| 8 | Push standalone page (lock-screen + scheduler) | Slide 7 (Push tile) |
| 9 | AI Workspace (starter packs + slash + save-as) | Slide 6 (Generate card subtext), Slide 7 (AI-workspace tile) |
| 10 | Landing redesign (Demo + Architecture + FAQ) | Slide 4 (whole slide), Slide 9 (architecture diagram) |
| 11-12 | Tolgee i18n (RU + EN + X-UI-Language) | Slide 4 (RU/EN split), Slide 11 (row 3) |
| Auth | Login + admin panel | Slide 11 (row 4) |

---

## Section 4 — Phrases that must appear verbatim somewhere

These are the deck's rhetorical anchors. Place them where natural.

- "AI не продаёт. AI планирует. Фермер — продаёт." (slide 3 + slide 13)
- "Деньги — на Go." (slide 8)
- "Сначала фильтр." (slide 8)
- "Демо не падает." (slide 8)
- "Скучно — потому что работает." (slide 10)
- "Не «в продакшене мы бы…» — «оно делает»." (slide 11)

---

## Section 5 — Numbers that must appear verbatim

| Number | Where it appears | Why it's defensible |
|---|---|---|
| 10 000 | slide 1, 2 | farmers on marketplace |
| 3 491 | slide 4, 10 | SKUs imported via XLSX ETL |
| 65 | slide 4 | farmers in seed data |
| 40+ | slide 7 (calendar tile) | curated events in events.yml |
| 768-d | slide 6 (Match), 10 | HNSW vector dimension |
| 6 каналов | slide 6 (Generate) | push/story/blog/recipe/chat/social |
| 11 типов рёбер | slide 10 | SurrealDB graph depth |
| ~200 ключей | slide 11 | i18n translation count |
| +500M ₽/год | slide 12 | projected marketplace lift |

---

## Section 6 — Image asset references (provide if available)

If you have access to the screenshots, use them. If not, generate placeholder dark-themed mockups matching the brand contract in section 1.

**Required for the deck:**
- `landing/hero-ru.png` (slide 4 left)
- `landing/hero-en.png` (slide 4 right)
- `landing/architecture-graph-full.png` (slide 9 — primary)
- `app/dashboard.png` (slide 7 tile 1)
- `app/calendar-month.png` (slide 7 tile 2)
- `app/ai-workspace-starter.png` (slide 7 tile 3)
- `app/plan-card-drawer.png` (slide 7 tile 4)
- `app/stories-editor.png` (slide 7 tile 5)
- `app/blog-editor.png` (slide 7 tile 6)
- `app/recipe-editor.png` (slide 7 tile 7)
- `app/social-editor.png` (slide 7 tile 8)
- `app/push-editor.png` (slide 7 tile 9)
- `app/roi-popover.png` (slide 7 tile 10)
- `app/admin-users.png` (slide 7 tile 11)

**Capture spec:** 2× DPR, dark theme, RU language, browser chrome cropped out, viewport 1440×900.

---

## Section 7 — Style references (for the model's calibration)

When in doubt, look at these aesthetics:

- **The New York Times** long-form features (editorial dusk, Fraunces-like serifs in italic).
- **Linear** product pages (restrained dark, mono telemetry, generous space).
- **Vercel** marketing pages (typographic hierarchy, dark grain).
- **Stripe** docs (mono for stats, calm hierarchy).

**Do NOT** look at:
- Generic SaaS landing pages.
- "AI startup" templates with purple/cyan gradients.
- Slidebean / Canva pitch templates.
- Y Combinator-style application slides.

---

## Section 8 — Acceptance checklist (run before delivery)

The deck is done when:

- [ ] All 13 slides exist + 1 cover/back.
- [ ] Background is consistently `#0c0e0a` across all slides.
- [ ] Fraunces italic appears on at least one word per slide (display).
- [ ] IBM Plex Sans is used for all body text.
- [ ] IBM Plex Mono is used for every number on slide 2 + slide 4 footer + slide 7 stats.
- [ ] Each slide has exactly ONE accent color (or zero).
- [ ] All numbers from section 5 appear verbatim where listed.
- [ ] All phrases from section 4 appear verbatim where listed.
- [ ] Slide 1: hero with seasonality ring crop on right.
- [ ] Slide 4: side-by-side RU/EN landing hero.
- [ ] Slide 7: 3×4 grid of 12 tiles with phase coverage from section 3.
- [ ] Slide 9: architecture diagram with 6 nodes labeled exactly as listed.
- [ ] Slide 13: team list + QR placeholder + closing italic line.
- [ ] No purple gradients, no stock photos, no sparkle emojis, no logo walls.
- [ ] Fonts limited to Fraunces + IBM Plex Sans + IBM Plex Mono.
- [ ] Grain texture present on every slide (subtle, ~3% opacity).
- [ ] All hairlines use `--line` (`#262519`), 1px.
- [ ] Asymmetric layouts on slides 1, 2, 11, 13. Centered only on slide 5.

---

## Section 9 — One-paragraph context (paste at top if asking Claude design for a single shot)

> Generate a 13-slide pitch deck for **Своё Родное Calendar** — a Russian AI marketing platform for 10,000 farmers on the Своё Родное marketplace. The product matches farmers' SKUs to a 40+ event calendar, then generates 6-channel campaigns (push/story/blog/recipe/chat/social) via Gemini 2.5 Flash with structured JSON. Money path is deterministic Go; AI writes only creative. Stack: React+Vite+TS frontend (Tolgee RU/EN i18n, Framer Motion), Go+Gin API (session auth, admin panel), SurrealDB 2.x (documents + graph + 768-d HNSW vector). Deployed via Coolify + Traefik. Catalog: 3,491 SKUs, 65 farmers, 11 edge types. Shipped phases: content revisions, rich plan board with 4-tab drawer + BoardSwitcher, standalone Stories/Blogs/Recipes/Social/Push pages, AI Workspace with starter packs + slash commands + save-as, redesigned editorial landing, full i18n with AI language pinning. Aesthetic: editorial-dusk × premium-fintech × agri-tech minimalism. Dark (`#0c0e0a`), Fraunces + IBM Plex Sans, leaf+amber dominant. No stock photos. No purple gradients. No sparkle. Follow the slide spec in section 2 verbatim — text and visuals.

---

**End of brief.** Paste sections 0 + 1 + 2 + 8 + 9 minimum. Add sections 3–7 if the tool accepts long context.
