# Blogs Module — Design Spec

> Status: approved · 2026-05-14
> Scope: Phase 5 of the platform-OS roadmap. Long-form sibling of the
> Stories module. Same lifecycle + multi-board scaffolding, different
> shape and editorial UX.

---

## 1 · Why

Stories serve the "warm, voice-first farmer narrative" use case
(emotional, short, image-heavy). Blogs serve a different need: SEO-
ready long-form articles that drive search traffic and category
authority over weeks ("Как выбрать мёд", "10 фактов о&nbsp;ламинарии").
Different audience, different shape, different editor.

## 2 · Architecture — same template as Stories

- Stored as `generated_content` rows with `channel = 'blog'`.
- Phase-2 lifecycle (draft / published / archived + revision history)
  inherits without changes.
- Free-form blogs use a lazily-bootstrapped `freeform-blogs` event +
  per-farmer suggestion shell (same lazy-bootstrap pattern as the
  storytelling shell from Phase 4).
- Optional auto-linking to the Phase-3 multi-board kanban — we use the
  existing `storytelling` board for now since blogs are a content
  pipeline, same operational shape. A dedicated `blog` board type can
  be added later if the editorial team wants the separation.

## 3 · Body shape

```json
{
  "title": "string",                 // headline
  "lede": "string",                  // 1-2 sentence subtitle / dek
  "body": "string (markdown)",       // long-form text
  "cover_image_url": "string?",
  "seo_keywords": ["string"],        // 3-7 keywords
  "meta_description": "string?",     // ~155 chars for search snippets
  "audience_tags": ["string"],
  "hashtags": ["string"]
}
```

Extends what Gemini already emits for `channel='blog'` (`title + lede +
body + hashtags`). New fields (`cover_image_url`, `seo_keywords`,
`meta_description`) start empty for legacy AI-generated rows and are
populated by the editor.

## 4 · API surface

| Method | Path | Body | Response |
|---|---|---|---|
| `GET`  | `/api/farmers/:id/blogs` | `?status=draft\|published\|archived` (optional) | `200 {blogs: [...]}` |
| `POST` | `/api/farmers/:id/blogs` | `{title, body, lede?, cover_image_url?, seo_keywords?, meta_description?, audience_tags?, hashtags?, create_plan_card?: true}` | `201 {blog, plan_card_id?}` |
| `GET`  | `/api/blogs/:id` | — | `200 GeneratedContent` |

Editing, publish/archive/restore: all via existing Phase-2 `/api/content/:id*`
endpoints — same as Stories.

## 5 · Frontend

- **Route:** `/farmer/:id/blogs` — sibling of `stories`.
- **List page:** clean editorial archive layout. Each card surfaces
  cover image (or gradient fallback), title, lede, reading-time chip,
  SEO keyword chips, status pill, date.
- **Reading-time estimate:** simple word-count / 200 wpm formula on
  the FE side; recalculated on each render, never stored.
- **Editor drawer:** two-pane writer's view. Left = wide textarea for
  the body + secondary fields (lede, cover URL, keywords, meta desc).
  Right = magazine-style live preview with Fraunces hero title, lede
  in italic, prose body with proper paragraph rhythm, dropcap on
  first paragraph.
- **Lifecycle bar** at the bottom inherits from Phase 2 — publish /
  archive / history with restore.

## 6 · Non-goals

- Markdown library / rich-text WYSIWYG. Phase 5 ships a textarea +
  simple paragraph splitting in preview. Real markdown rendering with
  bold/italic/lists/links/embeds is a UX polish for later.
- SEO scoring / readability analysis. Reading time is the only
  computed metric.
- Cover image upload. URL field only — asset table with object
  storage is a separate phase.
- Cross-blog tag taxonomy / category pages.
- Translation / multi-locale variants.

## 7 · Deliverables

- [x] This spec
- [ ] `apps/api/internal/db/blogs_repo.go` — list + lazy-bootstrap + user-create
- [ ] `apps/api/internal/handlers/blogs.go` — 3 endpoints
- [ ] Route wiring
- [ ] FE: `lib/blogs.ts`, `pages/BlogsPage.tsx`,
      `components/blogs/BlogCard.tsx`, `BlogEditorDrawer.tsx`
- [ ] App.tsx + AppShell nav entry
- [ ] Build verify (go + tsc)
