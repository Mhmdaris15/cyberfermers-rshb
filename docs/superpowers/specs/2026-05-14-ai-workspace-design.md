# AI Workspace — Design Spec

> Status: approved · 2026-05-14
> Scope: Phase 9 (finale) of the platform-OS roadmap. Pure-FE phase
> that ties Phases 4-8 together into one conversational surface.

---

## 1 · Why

The existing `/ai` page is read-only insights. The existing chat is a
floating drawer with 5 tools — fine for a quick question, cramped for
real workshopping. The brief asks for a "conversational AI workspace"
where the farmer can:

- ask Gemini for campaign improvements
- regenerate / refine content
- brainstorm promotions
- explain trends
- have it suggest products / events
- carry contextual memory per farmer

The cleanest move: **expand the existing `/ai` route into a tabbed
workspace** that keeps the insights and adds a real workbench. No new
backend — every action routes through existing endpoints
(`POST /api/farmers/:id/chat` for turns; the per-module POST endpoints
to "save as content").

## 2 · Architecture

- **`/farmer/:id/ai`** becomes tabbed: **Инсайты** (existing) + **Воркспейс** (new).
- Both tabs are children of the same route — switching tabs is local
  state, not a URL change, so deep linking to a single tab is intentionally
  out of scope for v1.
- All Workspace operations are stateless HTTP calls to existing endpoints.
  Thread persistence is **session-local** (React state + optional
  localStorage hydration) — durable thread history requires a new DB
  table and lands in a later phase if the team wants it.

```
AiPage
├── Tabs
│   ├── InsightsTab        ← existing logic, unchanged
│   └── WorkspaceTab       ← new
│       ├── StarterRail    (left, ~240px) — categorised seed prompts
│       ├── Conversation   (centre, flex-1) — messages + per-msg actions
│       └── Composer       (sticky bottom) — textarea + slash palette
```

## 3 · The four moves that make Workspace different from ChatSheet

1. **Categorised starter rail.** Four named columns of seed prompts
   (Кампании / Контент / Тренды / Продукты) — each chip is a one-tap
   question the farmer can launch the session with. ChatSheet's 5
   starter chips were ungrouped and limited.
2. **Slash command palette.** A `/`-triggered floating menu in the
   composer offers:
   - `/explain <topic>` – ask Gemini to elaborate
   - `/regen` – regenerate the last AI response
   - `/clear` – reset the conversation
   - `/save-story`, `/save-blog`, `/save-recipe`, `/save-social`, `/save-push`
     – take the most recent AI response and turn it into a draft on
     the corresponding module (uses Phase 4-8 endpoints)
3. **Save-as actions on AI responses.** Every assistant message gets
   a "Save as…" popover that POSTs the response text to a content
   module's `freeform-*` endpoint, creating a draft instantly. The
   Plan-board card is created automatically too (each module already
   does that on POST).
4. **In-line reference chips.** When an AI response mentions an
   event slug, product id, or board, render it as a clickable chip
   that navigates to the right route. (MVP: simple `[[chip:label]]`
   pattern parser; richer detection is a polish task.)

## 4 · No backend changes

Reuses:

- `POST /api/farmers/:id/chat` — chat turns (Phase-0 endpoint)
- `POST /api/farmers/:id/stories` (Phase 4) — save-as-story
- `POST /api/farmers/:id/blogs` (Phase 5) — save-as-blog
- `POST /api/farmers/:id/recipes` (Phase 6) — save-as-recipe
- `POST /api/farmers/:id/social-posts` (Phase 7) — save-as-social
- `POST /api/farmers/:id/push` (Phase 8) — save-as-push
- `GET /api/farmers/:id/insights` (Phase-0 endpoint) — Insights tab

This is the most platform-OS-y thing the codebase has done: a new
surface that doesn't require a single new endpoint because every
content type already speaks the same lifecycle protocol.

## 5 · Visual direction

- **Three-column desktop layout** (rail / chat / no right rail in v1).
  Mobile: starter rail collapses into a top sheet trigger.
- Message bubbles: user = soft leaf accent with mono-prefix
  "you →"; assistant = glass card with Fraunces "AI →" prefix and
  shimmer-during-streaming.
- Action row under each assistant message: `Сохранить как` popover,
  `Повторить` (regen), `Скопировать`.
- Composer: prominent, sticky to bottom. `/` keypress opens the
  command palette. Submit on Enter (Shift+Enter for newline).

## 6 · Non-goals (v1)

- **Durable thread history.** Threads live in React state + localStorage
  for refresh survival. A `ai_thread` table is a clean follow-up.
- **Streaming responses.** Backend `/chat` is single-shot; we add a
  fake typing indicator for perceived speed.
- **Rich-text response rendering** (markdown bold/italic/lists). Plain
  text + reference-chip parser is enough for v1.
- **Multi-farmer thread switching** — sessions are scoped to the
  current `/farmer/:id` route.
- **Workspace-initiated tool use beyond chat.** All the tool routing
  happens server-side inside the existing chat handler; the FE just
  renders.

## 7 · Deliverables

- [x] Spec
- [ ] `apps/web/src/lib/ai-workspace.ts` — starter packs, slash commands,
      save-as helpers
- [ ] `apps/web/src/components/ai-workspace/StarterRail.tsx`
- [ ] `apps/web/src/components/ai-workspace/Conversation.tsx`
- [ ] `apps/web/src/components/ai-workspace/Composer.tsx`
- [ ] `apps/web/src/components/ai-workspace/SaveAsMenu.tsx`
- [ ] Refactor `apps/web/src/pages/AiPage.tsx` to tabbed layout
- [ ] Build verify (tsc; backend unchanged)
