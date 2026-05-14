# Social Media Center — Design Spec

> Status: approved · 2026-05-14
> Scope: Phase 7 of the platform-OS roadmap. Multi-platform social posts
> with slide-carousel support. Single content type, multiple delivery
> surfaces.

---

## 1 · Why

The existing `channel='social'` content is a single text blob — fine
for a Telegram-only world, but the brief calls for Instagram + Telegram
+ VK with carousel posts, caption length awareness, and a publishing
calendar. We model that without forking the content table.

## 2 · Architecture — same template, more fields

- Stored as `generated_content` with `channel = 'social'`.
- Body shape (one row = one post, possibly multi-platform):

```json
{
  "title": "string",                  // internal label, not posted
  "platforms": ["instagram", "telegram", "vk"],
  "caption": "string",                // unified caption
  "hashtags": ["string"],
  "cta": "string?",                   // optional call to action line
  "slides": [
    { "image_url": "string", "alt": "string?" }
  ],
  "scheduled_for": "ISO datetime?",   // stored, not yet acted on by a scheduler runtime
  "audience_tags": ["string"]
}
```

- Per-platform caption overrides are intentionally **out of MVP scope**
  (`platform_overrides: {...}` would be the next-iteration extension —
  the body shape stays JSON-flexible so we can add it without schema
  changes). MVP shows live char counts per selected platform against
  the unified caption, so the operator sees instantly if the IG limit
  trips while the TG one is fine.
- Auto-create a `plan_card` on the **Phase-3 `social` board** (not
  storytelling — social has its own pipeline by design).
- `scheduled_for` is stored as ISO timestamp; a real runtime scheduler
  (cron worker that posts to platforms) is the Phase-8 push-channel
  concern. For MVP the FE surfaces the scheduled time on cards as
  "запланировано на DD.MM HH:MM" and on the kanban as a due date.

## 3 · Platform metadata (FE-only constants)

| Platform | Caption limit | Notes |
|---|---|---|
| Instagram | 2 200 | First 125 chars visible before "...more". Hashtags work best at end. |
| Telegram  | 4 096 | Markdown supported. No hashtag culture, but works. |
| VK        | 4 096 | Long captions OK, hashtags clickable. |

Limits are enforced as **warnings**, not hard blocks — the operator
might want to draft over-limit copy and trim later.

## 4 · API surface

| Method | Path | Body | Response |
|---|---|---|---|
| `GET`  | `/api/farmers/:id/social-posts` | `?status=...` | `200 {posts: [...]}` |
| `POST` | `/api/farmers/:id/social-posts` | post body + `create_plan_card?` | `201 {post, plan_card_id?}` |
| `GET`  | `/api/social-posts/:id` | — | `200 GeneratedContent` |

Edit / publish / archive / history: existing Phase-2 `/api/content/:id*`.

## 5 · Frontend

- **Route:** `/farmer/:id/social`.
- **List page:** card grid. First slide image as cover, platform icon
  chips, caption excerpt, scheduled date (if set), status pill.
- **Editor drawer:** structured form with three regions:
  - **Header:** title (internal) + platforms multi-select chips
  - **Caption:** textarea with **live per-platform char counters** and
    over-limit warnings
  - **Slides:** add-row list with image URL + alt text + up/down/delete
  - **Meta:** CTA, hashtags, audience tags, scheduled_for datetime
- **Preview pane:** Instagram-style square card with a slide-carousel
  control (left/right arrows), caption below, hashtag tail. Mirrors
  what the operator will publish.
- Lifecycle bar inherits Phase-2 verbs.

## 6 · Non-goals (Phase 7 MVP)

- **Per-platform caption overrides.** One caption per post; live char
  counters show which platforms it fits.
- **Runtime scheduler.** `scheduled_for` is stored; no goroutine posts
  it. The kanban "due date" surfaces it visually.
- **Engagement prediction** (per-platform expected lift). Defer.
- **Reusable templates** ("Save as template"). Defer.
- **Real image upload.** URL field; an asset table with object storage
  is a separate phase.
- **Cross-post analytics ingest** (after publishing, fetch likes from
  IG/VK Graph APIs). Out of scope.

## 7 · Deliverables

- [x] This spec
- [ ] `apps/api/internal/db/social_repo.go`
- [ ] `apps/api/internal/handlers/social.go`
- [ ] Route wiring
- [ ] FE: `lib/social.ts`, `pages/SocialPage.tsx`,
      `components/social/SocialCard.tsx`,
      `components/social/SocialPostEditorDrawer.tsx`
- [ ] App.tsx + AppShell nav entry (Share2 icon, between Рецепты and Каталог)
- [ ] Build verify (go + tsc)
