# Stories Module — Design Spec

> Status: approved · 2026-05-14
> Scope: Phase 4 of the platform-OS roadmap. First dedicated content type
> built on Phase 2 (content lifecycle) + Phase 3 (multi-board kanban).

---

## 1 · Why

The product brief calls for a dedicated **Stories / Storytelling**
surface — AI-generated farmer stories, editable drafts, media gallery,
publishing workflow. The current state ships story-channel output as
one tab inside the Action Sheet; there is no place to *browse* a
farmer's storytelling library, no editor that respects the shape of a
story (title + hero image + narrative body), no way to write a story
that isn't tied to a calendar event.

This phase fixes all three without forking the data model.

## 2 · Architectural choice — reuse `generated_content`, not a new table

Stories are stored as `generated_content` rows with `channel = "story"`.
The Phase-2 lifecycle (`status` / `current_revision` / `is_user_edited`
/ `published_at` / etc.) and the revision history table inherit for
free. The body shape becomes:

```json
{
  "title": "string",
  "hero_image_url": "string?",
  "body": "string (markdown-ish)",
  "image_prompt": "string?",
  "audience_tags": "string[]?",
  "hashtags": "string[]?"
}
```

Existing AI-generated story rows already have `caption` and
`image_prompt`. The new editor reads both shapes and writes the
extended one — backwards-compatible.

## 3 · Free-form stories without a calendar event

Every `generated_content` row requires a `suggestion`, which requires
an `event`. For storytelling that isn't pegged to a date, we
**lazily bootstrap** a per-farmer storytelling shell:

- A single shared event with slug `freeform-storytelling` (created on
  first request — schema unchanged).
- A per-farmer `suggestion` linked to that event, also lazily created.
- New stories use this suggestion as their `parent`.

Zero schema changes. The Stories page filters on `farmer + channel='story'`
regardless of whether the story comes from a real event or the
freeform shell, so the UI surfaces both seamlessly.

## 4 · Interconnection with Phase 3 multi-board kanban

When a story is created, the caller can request automatic creation of
a `plan_card` on the `storytelling` board (default `true` for the
new-from-UI flow, `false` for AI-batch flows that already create their
own cards). This is what "interconnected workflows" means in
practice — every operational pipeline gets cards in the same place,
the user doesn't have to learn nine different kanbans.

## 5 · API surface

| Method | Path | Body / Query | Response |
|---|---|---|---|
| `GET`  | `/api/farmers/:id/stories` | `?status=draft\|published\|archived` (optional) | `200 {stories: [...]}` newest first |
| `POST` | `/api/farmers/:id/stories` | `{title, body, hero_image_url?, image_prompt?, audience_tags?, hashtags?, create_plan_card?: true}` | `201 {story, plan_card_id?}` |
| `GET`  | `/api/stories/:id` | — | `200 Story` (alias of `GET /api/content/:id` projected as a Story) |

Existing endpoints reused:

- `PATCH /api/content/:id` — edit body (Phase 2)
- `POST /api/content/:id/publish` / `archive` / `unarchive` — lifecycle (Phase 2)
- `GET /api/content/:id/revisions` — history (Phase 2)

Authorization: all under `authed` (any logged-in user).

## 6 · Frontend

- **Route**: `/farmer/:id/stories` — sibling of `dashboard` / `calendar` / `plan`.
- **Page**: filterable preview-card grid (status filter pill bar:
  Все / Черновики / Опубликованы / Архив). Counts shown per filter.
  Each card shows hero image (fallback to gradient placeholder), title
  in Fraunces, 2-line body excerpt, status pill, relative date.
- **"New story" button** in header → opens an empty `StoryEditorDrawer`.
- **Click any card** → opens `StoryEditorDrawer` populated with that story.
- **StoryEditorDrawer** (right-side, like the card detail drawer):
  - Sticky header with title input + status pill + close
  - Two-column body: left = markdown textarea + hero-image-url +
    chips fields; right = live preview rendered as a magazine spread
    (Fraunces title, dropcap first letter, body with breathing room)
  - Footer with content lifecycle bar (Phase 2 — publish/archive/history)

## 7 · Non-goals (Phase 4)

- **Real image upload** — `hero_image_url` is a string for now. An
  `asset` table with S3-backed upload is a separate phase.
- **Markdown rendering with full formatting** (lists, blockquotes,
  embeds) — basic line breaks + dropcap is enough for the editorial feel.
- **Multi-page stories / chapters** — stories are single-page.
- **Collaborative editing / live cursors** — single-editor; conflicts
  resolved by last-write-wins via the Phase-2 revision history.
- **AI image generation from `image_prompt`** — the prompt is stored
  for a future phase; today it's a hint for human image search.

## 8 · Deliverables

- [x] Spec
- [ ] Repo: `ListFarmerStories`, `CreateFreeformStory` (lazy event +
      suggestion bootstrap, optional plan_card)
- [ ] Handlers: `GET / POST /api/farmers/:id/stories`, `GET /api/stories/:id`
- [ ] Route wiring
- [ ] FE: `lib/stories.ts` typed client
- [ ] FE: `pages/StoriesPage.tsx`
- [ ] FE: `components/stories/StoryCard.tsx`, `StoryEditorDrawer.tsx`
- [ ] App.tsx route, AppShell nav entry
- [ ] Verify: go build + go test, tsc --noEmit
