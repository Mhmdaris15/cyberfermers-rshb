# Content Versioning, Drafts, History — Design Spec

> Status: approved · 2026-05-14
> Scope: Phase 2 of the platform-OS roadmap. Foundation for every
> content module (Stories, Blogs, Recipes, Push, Social) that follows.

---

## 1 · Why

AI-generated content today is a one-shot blob: `/generate` writes a row
into `generated_content`, the FE shows it, that's it. There is no:

- **draft / published / archived** lifecycle
- **revision history** — re-generating an item *overwrites* the prior version
- **human edit** path — users can only regenerate, not edit
- **audit trail** — no record of who authored a version (AI vs human)

Every later module needs these. We build them once, here, on the existing
`generated_content` table so we don't duplicate the work in five places.

---

## 2 · Architecture choices

### 2.1 · Single content table, channel-shaped body

We extend `generated_content` rather than introducing per-channel tables.
The `body` field is already `FLEXIBLE TYPE object` — channel-specific
shape (push has `title/message`, social has `title/text/hashtags`,
recipe has `ingredients/steps`, etc.) is preserved as JSON. Editors on
the FE are per-channel; the DB stays generic. **Alternative considered:**
per-channel tables (`story`, `blog`, `recipe`, ...). Rejected — the
queries to "list all content for a suggestion" become a 5-way UNION and
analytics across types fragments. The current shape is the right one.

### 2.2 · Lifecycle: draft → published → archived

```
        ┌──── publish ────┐
draft ──┤                 ├──► published ──── archive ──► archived
        └──── archive ────┘                    ↑              │
                                               │              │
                                               └── unarchive ─┘ (→ draft)
```

- **Created (AI generation)** → `status = draft`
- User edits, regenerates, restores — all stay `draft` (or `published`
  if already published; edits to a published item DON'T silently
  un-publish it, but a fresh revision is recorded).
- **Publish** sets `status = published`, `published_at = now()`.
- **Archive** is reversible: sets `status = archived`, `archived_at = now()`.
  Unarchive moves back to `draft`. (Re-publishing requires explicit
  intent — too easy to mis-click "archive" otherwise.)

### 2.3 · Versioning: append-only `content_revision`

Each save (AI re-generation, user edit, restore) creates a row in a
separate `content_revision` table, while `generated_content` always
holds the CURRENT state (for fast reads — no need to "follow the latest
revision pointer" on the hot path). `current_revision` on the content
row equals the most recent revision_number — invariant maintained by
all write paths.

**Why not embedded array of revisions?** Document size grows unbounded;
SurrealDB queries on the revision history become expensive. Separate
table indexed by `(content, revision_number)` is the natural fit.

**Why not "soft delete via tombstone"?** Revisions are immutable
history, not "active vs deleted state". The state machine lives on the
content row.

### 2.4 · Authorship

`content_revision.author` is `option<record<app_user>>`:
- `NONE` → AI generation (no human author — the model is the author,
  recorded separately in `model` + `prompt_version`).
- Concrete user → human edit (recorded for the audit log).

UI surfaces this as an "AI" badge vs. an author monogram.

### 2.5 · Restore semantics

`POST /api/content/:id/revisions/:n/restore` does **not** mutate
revision N. It copies revision N's body into a NEW revision
(`revision_number = current_revision + 1`) and updates the content row.
History stays linear and immutable. This means restoring is itself an
audit-logged event.

---

## 3 · Data model

### 3.1 · Additions to `generated_content`

```surql
DEFINE FIELD status           ON generated_content TYPE string
                                ASSERT $value IN ['draft','published','archived']
                                DEFAULT 'draft';
DEFINE FIELD current_revision ON generated_content TYPE int DEFAULT 1;
DEFINE FIELD is_user_edited   ON generated_content TYPE bool DEFAULT false;
DEFINE FIELD published_at     ON generated_content TYPE option<datetime>;
DEFINE FIELD archived_at      ON generated_content TYPE option<datetime>;
DEFINE FIELD updated_at       ON generated_content TYPE datetime DEFAULT time::now();
```

These are all additive — SurrealDB's `DEFINE FIELD` is idempotent and
fills defaults for existing rows on next read. No migration scripts.

### 3.2 · New table `content_revision`

```surql
DEFINE TABLE content_revision SCHEMAFULL;
DEFINE FIELD content         ON content_revision TYPE record<generated_content>;
DEFINE FIELD revision_number ON content_revision TYPE int ASSERT $value > 0;
DEFINE FIELD body            ON content_revision FLEXIBLE TYPE object;
DEFINE FIELD model           ON content_revision TYPE option<string>;
DEFINE FIELD prompt_version  ON content_revision TYPE option<string>;
DEFINE FIELD is_user_edited  ON content_revision TYPE bool DEFAULT false;
DEFINE FIELD author          ON content_revision TYPE option<record<app_user>>;
DEFINE FIELD note            ON content_revision TYPE option<string>;
DEFINE FIELD created_at      ON content_revision TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_revision_content_unique ON content_revision FIELDS content, revision_number UNIQUE;
DEFINE INDEX idx_revision_content        ON content_revision FIELDS content;
```

`note` is a one-line human label per revision (e.g. "восстановлено из
v3", "ручная правка") — surfaces in the FE history dropdown.

---

## 4 · API surface

| Method | Path | Auth | Body / Query | Effect |
|---|---|---|---|---|
| `PATCH` | `/api/content/:id` | user | `{body: object, note?: string}` | Mutates `body`, sets `is_user_edited=true`, increments `current_revision`, snapshots into `content_revision` (author = caller, model/prompt_version copied from current row) |
| `POST` | `/api/content/:id/publish` | user | — | `status=published`, `published_at=now()` |
| `POST` | `/api/content/:id/archive` | user | — | `status=archived`, `archived_at=now()` |
| `POST` | `/api/content/:id/unarchive` | user | — | `status=draft`, clears `archived_at` |
| `GET`  | `/api/content/:id/revisions` | user | — | `200 {revisions: [...]}` newest first |
| `POST` | `/api/content/:id/revisions/:n/restore` | user | `{note?: string}` | New revision with old body; updates content row |

Existing endpoints are touched minimally:

- **`POST /api/suggestions/:id/generate`** — already calls `UpsertGenerated`.
  We extend that path so AI generation creates a `content_revision` with
  `author = NONE` and increments `current_revision`. Cache-hit path (the
  "we already have this channel" short-circuit) does NOT create a new
  revision — it's the same content, no need to log a no-op.

- **`GET /api/suggestions/:id/content`** — adds the lifecycle fields to
  the response. FE consumers ignore unknown fields, so this is a
  non-breaking schema change.

### 4.1 · Authorization

All endpoints require an authenticated user (any role — not just admin).
Phase 2 has no per-content ownership concept; any logged-in user can
edit/publish content for any farmer. Multi-tenant ownership scoping is
its own spec, not this one.

---

## 5 · Repo methods (Go)

New file `apps/api/internal/db/content_repo.go`:

```go
func (r *Repo) GetContent(id string) (*models.GeneratedContent, error)
func (r *Repo) UpdateContentBody(id string, body map[string]any, note string, userID string) (*models.GeneratedContent, error)
func (r *Repo) TransitionContent(id, newStatus string) (*models.GeneratedContent, error)
func (r *Repo) ListContentRevisions(contentID string) ([]models.ContentRevision, error)
func (r *Repo) RestoreContentRevision(contentID string, revisionNumber int, note string, userID string) (*models.GeneratedContent, error)
```

`UpsertGenerated` (existing) gets a small extension:
- On insert: creates revision 1 with `author = NONE`, `model + prompt_version` recorded.
- On update: creates new revision N+1 only if body actually changed.

The "body actually changed" comparison uses `json.Marshal` byte equality —
not deep struct compare. Avoids over-counting revisions when the AI
regenerates byte-identical output (rare but possible with cache).

---

## 6 · Frontend integration

ActionSheet's existing "Контент" tab gets:

1. **Inline edit textarea** per channel — JSON body deserialized into a
   per-channel form (push: title + message; social: title + text +
   hashtags; recipe: structured form; etc.). For phase 2 we start with a
   simple textarea bound to `body.text` for the "text" channels and
   keep the structured ones as-is (their dedicated editors land in their
   own module phases).
2. **Status pill** next to each channel — `черновик / опубликовано / в архиве`.
3. **Publish / Archive / Unarchive buttons** — primary action depends on
   current status.
4. **History dropdown** — shows revisions newest first with author
   monogram (AI vs human), relative time, "Восстановить" per row.

React Query mutations invalidate `/api/suggestions/:id/content` on
success. Optimistic update on body edit so the textarea doesn't flicker.

---

## 7 · Non-goals (explicit)

- **Scheduled publishing** (`publish_at` future timestamp + scheduler
  goroutine) — comes with the Social Media Center / Push phases.
- **Per-channel send tracking** (`publication` table with telegram/insta
  state) — same, lands with the channel-specific publishing phases.
- **Asset attachments** (images, recipe cards) — lands with the Stories
  / Recipes phases.
- **Audience targeting on content** — content is always for the
  suggestion's farmer's audience implicitly. Per-content targeting is a
  later phase.
- **Diff view** in the history dropdown — phase 2 ships restore only;
  visual diff is a separate UX polish task.
- **Conflict resolution** when two users edit simultaneously — last-
  writer-wins; the optimistic UI surfaces the resulting state. A real
  conflict resolution would need ETag-style version checks; out of
  scope for hackathon.

---

## 8 · Deliverables

- [x] This spec note
- [ ] `infrastructure/surrealdb/schema.surql` — additive fields + new table
- [ ] `apps/api/internal/models/domain.go` — `GeneratedContent` extension + `ContentRevision`
- [ ] `apps/api/internal/db/content_repo.go` — repo methods
- [ ] `apps/api/internal/db/repo.go` — extend `UpsertGenerated` with revision snapshot
- [ ] `apps/api/internal/handlers/content.go` — new handlers
- [ ] `apps/api/internal/handlers/handlers.go` — wire routes under `authed` group
- [ ] `apps/web/src/lib/content.ts` — typed client + React Query mutations
- [ ] `apps/web/src/components/action-card/ContentTabs.tsx` — inline editor + history
- [ ] Build verify: go build, go test, tsc --noEmit
