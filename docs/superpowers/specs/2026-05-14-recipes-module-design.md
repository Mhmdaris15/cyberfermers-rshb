# Recipes Module — Design Spec

> Status: approved · 2026-05-14
> Scope: Phase 6 of the platform-OS roadmap. First content module with
> a structured (non-prose) body shape.

---

## 1 · Why structured, not prose

Stories and blogs are narrative — title + lede + body. Recipes are
**structured**: ingredients are a list of `{amount, unit, name}`
tuples; steps are an ordered list of instructions; nutrition is a
numeric table. A free-form textarea editor would discard that
structure, blocking the product-linking and seasonality features the
brief calls for ("recipe generator from available products",
"seasonal recipe recommendations", "farmer product linking").

So the recipe body is a structured JSON document, the editor is a
form with add/remove rows, and the preview is a real recipe card.

## 2 · Body shape

```json
{
  "title": "string",
  "lede": "string?",
  "cover_image_url": "string?",
  "servings": 4,
  "prep_time_min": 15,
  "cook_time_min": 30,
  "difficulty": "easy" | "medium" | "hard",
  "ingredients": [
    { "name": "Творог", "amount": "500", "unit": "г", "product_id": "abc123" }
  ],
  "steps": [
    { "order": 1, "text": "Творог протереть через сито..." }
  ],
  "nutrition": {
    "calories": 320, "protein_g": 18, "carbs_g": 25, "fat_g": 12, "fiber_g": 1
  },
  "audience_tags": ["zozh", "parents"],
  "hashtags": ["завтрак", "мёд"],
  "notes": "string?"
}
```

### Legacy AI shape compatibility

Today's AI-generated recipes use a simpler flat shape:
`{name, yield, time, ingredients: string[], steps: string[]}`.

The FE reads BOTH shapes via normalising helpers
(`recipeTitle`, `recipeIngredients`, `recipeSteps` in `lib/recipes.ts`).
The editor writes the new structured shape — opening a legacy AI
recipe in the editor transparently migrates it to the new shape on
the first save (no separate migration step, no schema change).

## 3 · Architecture — same template as Stories + Blogs

- Stored as `generated_content` with `channel = 'recipe'`.
- Phase-2 lifecycle inherits (draft / published / archived + revisions).
- Free-form recipes lazily bootstrap a `freeform-recipes` event +
  per-farmer suggestion.
- Auto-creates a `plan_card` on the existing storytelling board (one
  pipeline for all editorial output for now; a dedicated `recipe`
  board can be added later if the chef workflow diverges).

## 4 · API surface

| Method | Path | Body | Response |
|---|---|---|---|
| `GET`  | `/api/farmers/:id/recipes` | `?status=draft\|published\|archived` | `200 {recipes: [...]}` |
| `POST` | `/api/farmers/:id/recipes` | structured recipe body + `create_plan_card?` | `201 {recipe, plan_card_id?}` |
| `GET`  | `/api/recipes/:id` | — | `200 GeneratedContent` |

Edit / publish / archive / history: existing Phase-2 `/api/content/:id*`.

## 5 · Frontend

- **Route:** `/farmer/:id/recipes`.
- **List page:** card grid. Each card shows cover, title, lede,
  servings + total time + difficulty chip, hashtag chips.
- **Editor drawer:** form-driven (no prose body). Sections:
  - Cover image URL
  - Title + lede
  - Stats row: servings + prep time + cook time + difficulty select
  - **Ingredients table** — each row: amount / unit / name / remove
    button. "+ ингредиент" at the bottom. Up/down arrows to reorder
    (drag-to-reorder is Phase 6.1 polish).
  - **Steps list** — each step is a numbered textarea row with
    remove + reorder arrows. "+ шаг".
  - Nutrition accordion (5 numeric fields)
  - Tags
  - Notes (chef's notes)
- **Preview:** real recipe card. Cover image, Fraunces title, italic
  lede, three stats chips in a row, ingredients in a bulleted column
  with the amount in monospace, numbered steps with circle markers,
  nutrition pill row at the bottom, hashtags.
- Lifecycle bar inherits Phase-2 verbs.

## 6 · Non-goals (Phase 6 MVP)

- **Product-link autocomplete** that hits `/api/farmers/:id/products`
  per ingredient. The `product_id` field exists in the schema and is
  honored on save, but the v1 editor uses a plain text input; a
  searchable SKU picker lands in Phase 6.1.
- **Drag-and-drop reorder** of ingredients/steps. Up/down arrows are
  enough for MVP.
- **Auto-import from a recipe URL** (paste a Cyrillic blog URL, get a
  parsed recipe). Out of scope.
- **AI nutrition calculation** from ingredients. Operator types
  values manually for now.
- **Unit conversion / metric ↔ imperial.** All-metric.

## 7 · Deliverables

- [x] This spec
- [ ] `apps/api/internal/db/recipes_repo.go`
- [ ] `apps/api/internal/handlers/recipes.go`
- [ ] Route wiring
- [ ] FE: `lib/recipes.ts`, `pages/RecipesPage.tsx`,
      `components/recipes/RecipeCard.tsx`,
      `components/recipes/RecipeEditorDrawer.tsx`
- [ ] App.tsx + AppShell nav entry
- [ ] Build verify (go + tsc)
