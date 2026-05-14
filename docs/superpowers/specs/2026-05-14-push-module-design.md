# Push Notifications Module — Design Spec

> Status: approved · 2026-05-14
> Scope: Phase 8 of the platform-OS roadmap. First module with a real
> runtime scheduler — the missing piece from Phase 7 (social).

---

## 1 · Why this one's different

Stories / Blogs / Recipes / Social are *editorial* — you draft and
publish. Push is *operational* — you draft, schedule, and then a
background process actually fires it. Three things change:

1. **Time-sensitivity.** A push to "20% off honey today only" is
   worthless if it ships an hour late.
2. **Dispatch state.** Each push has a `queued → sending → sent` (or
   `failed`) lifecycle distinct from the editorial `draft → published`
   lifecycle. Both apply: a push is `published + queued`, then
   `published + sent`.
3. **Tiny content surface.** A push is ~30 characters of headline +
   ~178 characters of body for iOS lock-screen visibility. Char counts
   are decision-relevant, not stylistic.

## 2 · Body shape

```json
{
  "title": "string",              // internal label (not shown to user)
  "headline": "string",           // push title — visible ~30 chars
  "body": "string",               // push body — visible ~178 chars (iOS lockscreen)
  "deep_link": "string?",         // url/app deeplink opened on tap
  "icon_emoji": "string?",        // single emoji prefix, e.g. "🐝"
  "preview_image_url": "string?", // optional rich-push image
  "segments": ["string"],         // audience slugs (zozh, parents, ...)
  "urgency": "normal" | "high" | "critical",
  "scheduled_for": "ISO datetime?",
  "dispatch": {
    "status": "queued" | "sending" | "sent" | "failed",
    "sent_at": "ISO?",
    "attempts": 0,
    "error": "string?"
  }
}
```

## 3 · Runtime scheduler

A background goroutine in `cmd/server/main.go` ticks every **30
seconds** and runs one atomic SurrealDB query that finds rows matching:

- `channel = 'push'`
- `status = 'published'`
- `body.scheduled_for <= time::now()`
- `body.dispatch.status = 'queued'` (or absent — treated as queued for
  rows created before this phase)

…and **atomically** marks them as `body.dispatch.status = 'sent'` with
`sent_at = time::now()`. For hackathon scope the "send" is simulated
(no real APN/FCM). The pattern is in place for a real integration —
the per-row update can be made conditional on a successful HTTP call
to the push provider, with retry attempts tracked in `attempts`.

### Why a single atomic UPDATE per tick (not a per-row select + update loop)

- Idempotent across server restarts: if the goroutine dies mid-tick,
  next boot picks up the still-queued rows.
- No race window where two scheduler instances would double-fire the
  same push (we don't have multi-replica yet, but the pattern is safe).
- Mutating `body.dispatch` does NOT go through `UpdateContentBody` so
  it does NOT create a `content_revision`. This is a system event, not
  an editorial edit — recording it in the audit log would pollute the
  revision history with noise.

## 4 · API surface

| Method | Path | Body | Response |
|---|---|---|---|
| `GET`  | `/api/farmers/:id/push` | `?status=draft\|published\|archived` | `200 {pushes: [...]}` |
| `POST` | `/api/farmers/:id/push` | structured push body + `create_plan_card?` | `201 {push, plan_card_id?}` |
| `GET`  | `/api/push/:id` | — | `200 GeneratedContent` |

Edit / publish / archive / history: existing Phase-2 `/api/content/:id*`.

Plan-card lives on the Phase-3 **`push`** board (it already exists in
the BOARDS catalog).

## 5 · Frontend

- **Route:** `/farmer/:id/push`.
- **List page:** card grid. Each card shows:
  - Headline + body excerpt
  - Urgency chip (normal/high/**critical** in rust)
  - Dispatch status pill (queued/sent/failed)
  - Scheduled-for time
  - Segment chips
- **Editor drawer:** structured form (no prose body):
  - Title (internal) + icon emoji single-char input
  - Headline + body with **live iOS/Android visible-char meters**
  - Deep link
  - Urgency picker (3 tones)
  - Segments multi-select (from a known list of audience slugs)
  - Scheduled_for datetime
  - Preview image URL
- **Preview pane:** tabs for **iOS lock-screen** and **Android
  notification shade** styles. Real device-style chrome (status bar,
  notification card with app icon + time + dismiss handle).

## 6 · Non-goals (Phase 8 MVP)

- **Real APN/FCM/Web Push integration.** The scheduler simulates send;
  the integration point is documented in code but stubbed.
- **A/B test variants** ("send A to 50%, B to 50%, pick the winner").
- **Retry / backoff strategy.** A failure logs and stops; a real
  integration would mark `dispatch.status = 'failed'` and let the
  operator retry by re-queueing.
- **Per-segment delivery analytics** (sent / delivered / opened).
- **Cancel-while-queued UX** — for MVP, archive the row to skip it.
  A dedicated "cancel" action could land in v2 (just sets
  `dispatch.status = 'cancelled'` and the scheduler ignores it).

## 7 · Deliverables

- [x] This spec
- [ ] `apps/api/internal/db/push_repo.go`
- [ ] `apps/api/internal/handlers/push.go`
- [ ] Scheduler goroutine in `cmd/server/main.go`
- [ ] Route wiring
- [ ] FE: `lib/push.ts`, `pages/PushPage.tsx`,
      `components/push/PushCard.tsx`, `components/push/PushEditorDrawer.tsx`
- [ ] App.tsx + AppShell nav entry (`BellRing` icon)
- [ ] Build verify (go + tsc)
