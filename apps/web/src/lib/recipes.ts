import { api } from "./api";
import type { ContentStatus, GeneratedContent } from "./types";

// ============================================================
//   Recipes client (phase 6).
//   Recipes are generated_content rows with channel='recipe'. Body
//   is a structured JSON document (ingredients/steps/nutrition).
//   The helpers below READ both the new structured shape and the
//   legacy flat AI shape (`name`, `yield`, `time`, `ingredients:
//   string[]`, `steps: string[]`) so old AI-generated rows still
//   render and editing migrates them transparently on first save.
// ============================================================

export type Difficulty = "easy" | "medium" | "hard";

export interface Ingredient {
  name: string;
  amount?: string;
  unit?: string;
  product_id?: string;
}

export interface Step {
  order?: number;
  text: string;
}

export interface Nutrition {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
}

export interface RecipeBody {
  // new structured shape
  title?: string;
  lede?: string;
  cover_image_url?: string;
  servings?: number;
  prep_time_min?: number;
  cook_time_min?: number;
  difficulty?: Difficulty;
  ingredients?: (string | Ingredient)[];
  steps?: (string | Step)[];
  nutrition?: Nutrition;
  audience_tags?: string[];
  hashtags?: string[];
  notes?: string;

  // legacy AI shape (read-only — editor writes the new shape)
  name?: string;
  yield?: string;
  time?: string;
}

export interface CreateRecipeBody {
  title: string;
  lede?: string;
  cover_image_url?: string;
  servings?: number;
  prep_time_min?: number;
  cook_time_min?: number;
  difficulty?: Difficulty;
  ingredients?: Ingredient[];
  steps?: Step[];
  nutrition?: Nutrition;
  audience_tags?: string[];
  hashtags?: string[];
  notes?: string;
  create_plan_card?: boolean;
}

export interface CreateRecipeResponse {
  recipe: GeneratedContent;
  plan_card_id?: string;
}

export const listFarmerRecipes = (farmerID: string, status?: ContentStatus) =>
  api
    .get<{ recipes: GeneratedContent[] }>(`/api/farmers/${farmerID}/recipes`, {
      params: status ? { status } : undefined,
    })
    .then((r) => r.data.recipes);

export const createFarmerRecipe = (farmerID: string, body: CreateRecipeBody) =>
  api
    .post<CreateRecipeResponse>(`/api/farmers/${farmerID}/recipes`, body)
    .then((r) => r.data);

export const getRecipe = (id: string) =>
  api.get<GeneratedContent>(`/api/recipes/${id}`).then((r) => r.data);

// ─── shape-normalising helpers ─────────────────────────────────────────

export function recipeTitle(r: GeneratedContent): string {
  const b = r.body as RecipeBody | undefined;
  return b?.title?.trim() || b?.name?.trim() || "Без названия";
}

export function recipeLede(r: GeneratedContent): string {
  const b = r.body as RecipeBody | undefined;
  return b?.lede?.trim() || "";
}

export function recipeCoverImage(r: GeneratedContent): string | undefined {
  const b = r.body as RecipeBody | undefined;
  return b?.cover_image_url?.trim() || undefined;
}

/** Normalise ingredients to objects, regardless of whether the row uses
 *  the new structured shape or the legacy AI `string[]` shape. */
export function recipeIngredients(r: GeneratedContent): Ingredient[] {
  const list = (r.body as RecipeBody | undefined)?.ingredients ?? [];
  return list.map((it) =>
    typeof it === "string" ? { name: it } : { ...it },
  );
}

/** Normalise steps to {order, text} objects with sequential ordering. */
export function recipeSteps(r: GeneratedContent): Required<Step>[] {
  const list = (r.body as RecipeBody | undefined)?.steps ?? [];
  return list.map((s, i) =>
    typeof s === "string"
      ? { order: i + 1, text: s }
      : { order: s.order ?? i + 1, text: s.text },
  );
}

/** Total minutes from prep + cook, falling back to parsing legacy
 *  `time` string ("30 мин", "1 ч 15 мин"). Returns 0 if unknown. */
export function recipeTotalMinutes(r: GeneratedContent): number {
  const b = r.body as RecipeBody | undefined;
  if (!b) return 0;
  if (typeof b.cook_time_min === "number" || typeof b.prep_time_min === "number") {
    return (b.cook_time_min ?? 0) + (b.prep_time_min ?? 0);
  }
  // Legacy `time` string parser. Handles "30 мин", "1 ч", "1 ч 30 мин".
  if (typeof b.time === "string") {
    let mins = 0;
    const h = b.time.match(/(\d+)\s*ч/);
    const m = b.time.match(/(\d+)\s*м/);
    if (h) mins += parseInt(h[1]) * 60;
    if (m) mins += parseInt(m[1]);
    return mins;
  }
  return 0;
}

export function recipeServings(r: GeneratedContent): string {
  const b = r.body as RecipeBody | undefined;
  if (typeof b?.servings === "number") return `${b.servings} порц.`;
  if (typeof b?.yield === "string") return b.yield;
  return "";
}

export function difficultyMeta(d?: Difficulty): { label: string; tone: string } {
  switch (d) {
    case "easy":   return { label: "просто",   tone: "border-leaf/40 bg-leaf/10 text-leaf" };
    case "medium": return { label: "средне",   tone: "border-amber/40 bg-amber/10 text-amber" };
    case "hard":   return { label: "сложно",   tone: "border-rust/40 bg-rust/10 text-rust" };
    default:       return { label: "—",        tone: "border-line bg-bg-subtle text-ink-mute" };
  }
}

export function formatMinutes(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}
