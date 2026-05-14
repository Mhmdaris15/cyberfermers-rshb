# Multi-Board Kanban + Rich Card Model — Design Spec

> Status: approved · 2026-05-14
> Scope: Phase 3 of the platform-OS roadmap. Extends `plan_card`
> rather than replacing it — every existing card and its memory
> wiring keeps working.

---

## 1 · Why

The current Kanban is one board per farmer with four columns
(`proposed → planned → live → completed`) and a single linking field
(`suggestion`). The platform-OS scope asks for **nine operational
pipelines** that share the same column metaphor but represent
different *kinds of work*:

| Board type | What lives there |
|---|---|
| `campaign`     | Generic marketing campaigns (the default — what we have today) |
| `seasonal`     | Seasonal promotions tied to harvest windows |
| `social`       | Instagram / Telegram / VK posts |
| `launch`       | Product launches |
| `event`        | Event preparation (Maslenitsa, Honey Spas, etc.) |
| `recipe`       | Recipe-driven content campaigns |
| `storytelling` | Long-form farmer storytelling content |
| `push`         | Push notification campaigns |
| `community`    | Community engagement (comments, replies, loyalty nudges) |

A single `board_type` field on `plan_card` partitions the board space.
Each board uses the **same** 4-column lifecycle (proposed / planned /
live / completed) — keeping the existing AI memory signals
(0.05 / 0.40 / 0.80 / 1.00) usable across all boards. Per-board
column schemas are a future refinement (Phase 4+).

## 2 · Rich card model

Today's `plan_card` has 11 fields. The product brief asks for ~13
new card capabilities. We add them as native fields rather than
generic JSON blobs so they remain searchable, filterable, and
typesafe at the API boundary.

Mapping from the brief to schema:

| Brief item | Schema field |
|---|---|
| AI-generated description | `description: option<string>` |
| status                    | existing `column` |
| due date                  | `due_date: option<datetime>` |
| assigned audience         | `audience_tags: array<string>` |
| recommended channels      | `channels: array<string>` |
| generated assets          | `attachments: flexible array` (free-form for now) |
| generated captions        | already covered via the linked `suggestion → generated_content` chain (Phase 2) |
| generated hashtags        | `hashtags: array<string>` |
| generated CTA             | `cta: option<string>` |
| attached recipes/products | `product_refs: array<record<product>>` |
| comments / history        | `plan_card_comment` + `plan_card_activity` tables |
| AI suggestions            | reuses the existing chat surface (with a card-context shortcut button on FE) |
| editable drafts           | already covered by Phase 2 content lifecycle |

Plus three operational extras:

- `title: option<string>` — short human label (overrides suggestion title in the UI)
- `priority: low/normal/high/urgent` — for visual sorting
- `assignee: option<record<app_user>>` — who's working on this card
- `created_by: option<record<app_user>>` — audit trail

## 3 · Comments & activity as separate tables

Both are append-only logs keyed on `card`. Two tables (not one) because:

- **Comments** are user-authored prose for collaboration. They show in
  a "Discussion" sub-panel of the card detail view.
- **Activity** is system-emitted events for an audit timeline (`moved
  from planned → live`, `due date changed`, `comment added`, etc.).
  Auto-written by repo methods, never directly by user input.

Both have an `author` field (`option<record<app_user>>` — `NONE` for
system-emitted activity).

## 4 · API surface

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| `GET`    | `/api/farmers/:id/plan` | `?board=<type>` optional | Returns board view (cards grouped by column). Without `?board=` returns all cards across boards. |
| `GET`    | `/api/farmers/:id/plan/boards` | — | Returns one row per `board_type` with total/active/completed counts |
| `GET`    | `/api/plan/cards/:id` | — | Full card detail with linked suggestion |
| `PATCH`  | `/api/plan/cards/:id` | `{title?, description?, due_date?, priority?, audience_tags?, channels?, hashtags?, cta?, product_refs?, assignee_id?, board_type?, note?}` | Any subset of editable fields |
| `DELETE` | `/api/plan/cards/:id` | — | Archive (we soft-delete via a column transition or a dedicated `archived` flag — see below) |
| `GET`    | `/api/plan/cards/:id/comments` | — | Newest first |
| `POST`   | `/api/plan/cards/:id/comments` | `{body}` | Author = caller |
| `GET`    | `/api/plan/cards/:id/activity` | — | Newest first, capped at 50 |

**Existing endpoints unchanged for compat:**
- `POST /api/plan/cards` — gains optional `board_type`, defaults to `campaign`.
  Other new fields can be set here too; missing ones use defaults.
- `POST /api/plan/cards/move` — emits an activity row on success.

**Archive semantics:** rather than introduce a separate `archived` flag
on `plan_card` (we have a 4-state column already and adding another
dimension complicates the recommender's memory signals), `DELETE
/api/plan/cards/:id` removes the row outright and emits an
`archived` activity. If the user later wants "soft archive that hides
from the board but keeps history", that's a Phase 4+ refinement —
not worth the scope creep here.

## 5 · Activity emission points

| Trigger | activity.kind | payload |
|---|---|---|
| Card created (any path) | `created` | `{board_type, column}` |
| Card moved between columns | `moved` | `{from, to}` |
| Card field(s) edited | `edited` | `{fields: [...]}` |
| Comment added | `commented` | `{comment_id, preview: first 80 chars}` |
| Card archived (deleted) | `archived` | `{}` |
| Linked content published | `linked_content_published` | `{content_id, channel}` (Phase 2 hook — emitted from publish handler) |

Emission is repo-internal: `AddComment` writes the comment AND the
activity in the same query. Handlers never call `AppendActivity`
directly — keeps the audit log honest (you can't "edit without
audit"). The one exception is `linked_content_published` which is
emitted from the content publish handler since it crosses a service
boundary.

## 6 · Frontend (lands next turn)

- New `PlanPage` chrome: a left-rail board switcher with 9 entries
  (icon + label + count). Selecting one loads `?board=<type>` and
  the column grid renders.
- Rich card: title, description, due-date pill with overdue color,
  priority chip, audience/channel/hashtag chips, attachment preview.
- Card detail drawer (side sheet): tabs for **Детали** (edit form),
  **Контент** (linked generated_content via Phase 2), **Комментарии**,
  **Лента активности**.
- Quick-action floating button on the card detail: "Спросить ИИ
  про эту карточку" — opens existing ChatSheet pre-filled with card
  context.

## 7 · Non-goals

- **Per-board column schemas.** All boards share `proposed/planned/
  live/completed` for now.
- **Recurring cards.** No "repeat every 2 weeks" — comes with the
  scheduler in the Push / Social phases.
- **Card templates.** "Save this card as template" is a Phase 4+ thing.
- **Drag-and-drop between boards.** Card editing can change
  `board_type` (PATCH), but the FE board switcher is a filter, not a
  cross-board DnD canvas.
- **Real-time multi-user collaboration.** The existing SSE plan
  stream still works for column moves; comments + activity rely on
  React Query refetch on focus. No CRDT.

## 8 · Deliverables (this phase)

- [x] This spec
- [ ] Schema additions (this turn)
- [ ] Models extension (this turn)
- [ ] Repo methods + activity auto-emit (this turn)
- [ ] Handlers + routes (this turn)
- [ ] Build + test verify (this turn)
- [ ] Frontend: board switcher, rich card, detail drawer (next turn)
