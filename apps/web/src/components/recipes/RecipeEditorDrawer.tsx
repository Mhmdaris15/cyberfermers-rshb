import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowDown, ArrowUp, ChefHat, Check, Clock, Hash,
  Image as ImageIcon, Loader2, Plus, Trash2, Users2, Utensils, X,
} from "lucide-react";

import { ContentLifecycleBar } from "@/components/action-card/ContentLifecycleBar";
import { updateContent } from "@/lib/content";
import {
  createFarmerRecipe, difficultyMeta, formatMinutes, getRecipe,
  recipeCoverImage, recipeIngredients, recipeLede, recipeSteps,
  recipeTitle, type Difficulty, type Ingredient, type RecipeBody,
  type Step,
} from "@/lib/recipes";
import type { GeneratedContent } from "@/lib/types";

// =====================================================================
//  RecipeEditorDrawer — structured form, not a prose textarea.
//
//  Left pane: title, lede, cover URL, stats row (servings + prep +
//  cook + difficulty), an *ingredients table* (rows with amount /
//  unit / name / up-down reorder / remove), a *steps list* (numbered
//  textareas), collapsible nutrition accordion, tags + notes.
//
//  Right pane: real recipe-card preview with hero, stats chips,
//  ingredient bullets (amounts in mono), numbered step circles,
//  optional nutrition footer.
// =====================================================================

interface Props {
  recipeID: string | null | "new";
  farmerID: string;
  onClose: () => void;
}

export function RecipeEditorDrawer({ recipeID, farmerID, onClose }: Props) {
  return (
    <AnimatePresence>
      {recipeID && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-6xl flex-col border-l border-line bg-bg shadow-glass"
          >
            {recipeID === "new"
              ? <CreateFlow farmerID={farmerID} onClose={onClose} />
              : <EditFlow recipeID={recipeID} farmerID={farmerID} onClose={onClose} />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── form state ────────────────────────────────────────────────────────

function useRecipeForm() {
  const [title, setTitle] = useState("");
  const [lede, setLede] = useState("");
  const [cover, setCover] = useState("");
  const [servings, setServings] = useState<number | "">(4);
  const [prep, setPrep] = useState<number | "">(15);
  const [cook, setCook] = useState<number | "">(30);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", amount: "", unit: "" }]);
  const [steps, setSteps] = useState<Step[]>([{ order: 1, text: "" }]);
  const [nutrition, setNutrition] = useState<{ [k: string]: number | "" }>({
    calories: "", protein_g: "", carbs_g: "", fat_g: "", fiber_g: "",
  });
  const [audience, setAudience] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  return {
    title, setTitle, lede, setLede, cover, setCover,
    servings, setServings, prep, setPrep, cook, setCook,
    difficulty, setDifficulty, ingredients, setIngredients,
    steps, setSteps, nutrition, setNutrition,
    audience, setAudience, tags, setTags, notes, setNotes,
  };
}
type FormState = ReturnType<typeof useRecipeForm>;

function buildBody(f: FormState): Record<string, unknown> {
  const cleanIngredients = f.ingredients
    .map((it) => ({
      name: it.name.trim(),
      amount: it.amount?.trim() || undefined,
      unit: it.unit?.trim() || undefined,
      product_id: it.product_id?.trim() || undefined,
    }))
    .filter((it) => it.name);
  const cleanSteps = f.steps
    .map((s, i) => ({ order: i + 1, text: s.text.trim() }))
    .filter((s) => s.text);
  const nutrition: Record<string, number> = {};
  for (const [k, v] of Object.entries(f.nutrition)) {
    if (typeof v === "number") nutrition[k] = v;
  }
  return {
    title: f.title.trim(),
    lede: f.lede.trim(),
    cover_image_url: f.cover.trim() || undefined,
    servings: typeof f.servings === "number" ? f.servings : undefined,
    prep_time_min: typeof f.prep === "number" ? f.prep : undefined,
    cook_time_min: typeof f.cook === "number" ? f.cook : undefined,
    difficulty: f.difficulty,
    ingredients: cleanIngredients,
    steps: cleanSteps,
    nutrition: Object.keys(nutrition).length > 0 ? nutrition : undefined,
    audience_tags: csv(f.audience),
    hashtags: csv(f.tags),
    notes: f.notes.trim() || undefined,
  };
}

// ─── create flow ───────────────────────────────────────────────────────

function CreateFlow({ farmerID, onClose }: { farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const f = useRecipeForm();

  const m = useMutation({
    mutationFn: () => {
      const body = buildBody(f);
      return createFarmerRecipe(farmerID, {
        title: body.title as string,
        lede: body.lede as string,
        cover_image_url: body.cover_image_url as string | undefined,
        servings: body.servings as number | undefined,
        prep_time_min: body.prep_time_min as number | undefined,
        cook_time_min: body.cook_time_min as number | undefined,
        difficulty: body.difficulty as Difficulty,
        ingredients: body.ingredients as Ingredient[],
        steps: body.steps as Step[],
        nutrition: body.nutrition as never,
        audience_tags: body.audience_tags as string[],
        hashtags: body.hashtags as string[],
        notes: body.notes as string | undefined,
        create_plan_card: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes", farmerID] });
      qc.invalidateQueries({ queryKey: ["plan", farmerID] });
      qc.invalidateQueries({ queryKey: ["boards", farmerID] });
      onClose();
    },
  });

  return (
    <Shell onClose={onClose} title={f.title.trim() || "Новый рецепт"} eyebrow="новый рецепт">
      <SplitEditor f={f} />
      <Footer>
        {m.isError && <FootMsg tone="rust">ошибка</FootMsg>}
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !f.title.trim()}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
          Создать рецепт
        </button>
      </Footer>
    </Shell>
  );
}

// ─── edit flow ─────────────────────────────────────────────────────────

function EditFlow({ recipeID, farmerID, onClose }: { recipeID: string; farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["recipe", recipeID], queryFn: () => getRecipe(recipeID) });
  const f = useRecipeForm();

  // Hydrate from upstream (handles legacy AI shape via normalisers).
  useEffect(() => {
    if (!q.data) return;
    const b = (q.data.body as RecipeBody | undefined) ?? {};
    f.setTitle(recipeTitle(q.data));
    f.setLede(recipeLede(q.data));
    f.setCover(recipeCoverImage(q.data) ?? "");
    f.setServings(typeof b.servings === "number" ? b.servings : 4);
    f.setPrep(typeof b.prep_time_min === "number" ? b.prep_time_min : 15);
    f.setCook(typeof b.cook_time_min === "number" ? b.cook_time_min : 30);
    f.setDifficulty(b.difficulty ?? "easy");
    const ings = recipeIngredients(q.data);
    f.setIngredients(ings.length ? ings : [{ name: "", amount: "", unit: "" }]);
    const stps = recipeSteps(q.data).map((s) => ({ order: s.order, text: s.text }));
    f.setSteps(stps.length ? stps : [{ order: 1, text: "" }]);
    f.setNutrition({
      calories:  b.nutrition?.calories  ?? "",
      protein_g: b.nutrition?.protein_g ?? "",
      carbs_g:   b.nutrition?.carbs_g   ?? "",
      fat_g:     b.nutrition?.fat_g     ?? "",
      fiber_g:   b.nutrition?.fiber_g   ?? "",
    });
    f.setAudience((b.audience_tags ?? []).join(", "));
    f.setTags((b.hashtags ?? []).join(", "));
    f.setNotes(b.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const m = useMutation({
    mutationFn: () => updateContent(recipeID, { body: buildBody(f), note: "правка рецепта" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipe", recipeID] });
      qc.invalidateQueries({ queryKey: ["recipes", farmerID] });
    },
  });

  if (q.isLoading || !q.data) {
    return (
      <Shell onClose={onClose} title="..." eyebrow="загружаю">
        <div className="grid h-full place-items-center p-10 text-sm text-ink-mute">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell onClose={onClose} title={recipeTitle(q.data)} eyebrow={q.data.is_user_edited ? "рецепт · автор" : "рецепт · AI"}>
      <SplitEditor f={f} />

      <div className="border-t border-line bg-bg-elevated/30 px-6 pb-2 pt-1">
        <ContentLifecycleBar
          content={q.data}
          onChange={() => {
            qc.invalidateQueries({ queryKey: ["recipe", recipeID] });
            qc.invalidateQueries({ queryKey: ["recipes", farmerID] });
          }}
        />
      </div>

      <Footer>
        {m.isSuccess && <FootMsg tone="leaf">сохранено как новая версия</FootMsg>}
        {m.isError && <FootMsg tone="rust">ошибка</FootMsg>}
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !f.title.trim()}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Сохранить
        </button>
      </Footer>
    </Shell>
  );
}

// ─── split editor ──────────────────────────────────────────────────────

function SplitEditor({ f }: { f: FormState }) {
  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
      <FormColumn f={f} />
      <PreviewColumn f={f} />
    </div>
  );
}

function FormColumn({ f }: { f: FormState }) {
  return (
    <div className="space-y-4">
      <Field label="Название">
        <input
          value={f.title}
          onChange={(e) => f.setTitle(e.target.value)}
          placeholder="Сырники с медом и черникой"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2.5 font-display text-xl focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      <Field label="Краткое описание">
        <textarea
          value={f.lede}
          onChange={(e) => f.setLede(e.target.value)}
          rows={2}
          placeholder="Завтрак из творога с собственного мёда фермы — за полчаса."
          className="w-full resize-y rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm leading-relaxed focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      <Field label="URL обложки" icon={<ImageIcon className="h-3 w-3" />}>
        <input
          value={f.cover}
          onChange={(e) => f.setCover(e.target.value)}
          placeholder="https://example.com/syrniki.jpg"
          spellCheck={false}
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 font-mono text-xs focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      {/* stats row */}
      <div className="grid grid-cols-4 gap-2">
        <NumField label="Порций" icon={<Users2 className="h-3 w-3" />} value={f.servings} onChange={f.setServings} />
        <NumField label="Подгот., мин"  value={f.prep}     onChange={f.setPrep} />
        <NumField label="Готовка, мин" value={f.cook}      onChange={f.setCook} />
        <Field label="Сложность">
          <select
            value={f.difficulty}
            onChange={(e) => f.setDifficulty(e.target.value as Difficulty)}
            className="w-full rounded-md border border-line bg-bg-elevated px-2 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          >
            <option value="easy">просто</option>
            <option value="medium">средне</option>
            <option value="hard">сложно</option>
          </select>
        </Field>
      </div>

      {/* ingredients table */}
      <SectionHeader title="Ингредиенты" icon={<Utensils className="h-3.5 w-3.5" />} />
      <div className="space-y-1.5">
        {f.ingredients.map((ing, i) => (
          <div key={i} className="grid grid-cols-[3rem_4rem_minmax(0,1fr)_auto] items-center gap-1.5">
            <input
              value={ing.amount ?? ""}
              onChange={(e) => f.setIngredients(replace(f.ingredients, i, { ...ing, amount: e.target.value }))}
              placeholder="500"
              className="rounded-md border border-line bg-bg-elevated px-2 py-1.5 text-right font-mono text-xs focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
            />
            <input
              value={ing.unit ?? ""}
              onChange={(e) => f.setIngredients(replace(f.ingredients, i, { ...ing, unit: e.target.value }))}
              placeholder="г"
              className="rounded-md border border-line bg-bg-elevated px-2 py-1.5 text-center text-xs text-ink-dim focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
            />
            <input
              value={ing.name}
              onChange={(e) => f.setIngredients(replace(f.ingredients, i, { ...ing, name: e.target.value }))}
              placeholder="творог"
              className="rounded-md border border-line bg-bg-elevated px-2.5 py-1.5 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
            />
            <RowControls
              onUp={() => f.setIngredients(move(f.ingredients, i, -1))}
              onDown={() => f.setIngredients(move(f.ingredients, i, +1))}
              onDelete={() => f.setIngredients(f.ingredients.filter((_, j) => j !== i))}
              canUp={i > 0}
              canDown={i < f.ingredients.length - 1}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => f.setIngredients([...f.ingredients, { name: "", amount: "", unit: "" }])}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-line bg-bg-elevated/40 px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-leaf/60 hover:bg-leaf/5 hover:text-leaf"
        >
          <Plus className="h-3 w-3" />
          ингредиент
        </button>
      </div>

      {/* steps list */}
      <SectionHeader title="Шаги приготовления" icon={<ChefHat className="h-3.5 w-3.5" />} />
      <div className="space-y-2">
        {f.steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-leaf/15 text-[11px] font-mono text-leaf">
              {i + 1}
            </div>
            <textarea
              value={s.text}
              onChange={(e) => f.setSteps(replace(f.steps, i, { ...s, text: e.target.value }))}
              rows={2}
              placeholder="Творог протереть через сито…"
              className="flex-1 resize-y rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm leading-relaxed focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
            />
            <RowControls
              onUp={() => f.setSteps(move(f.steps, i, -1))}
              onDown={() => f.setSteps(move(f.steps, i, +1))}
              onDelete={() => f.setSteps(f.steps.filter((_, j) => j !== i))}
              canUp={i > 0}
              canDown={i < f.steps.length - 1}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => f.setSteps([...f.steps, { order: f.steps.length + 1, text: "" }])}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-line bg-bg-elevated/40 px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-leaf/60 hover:bg-leaf/5 hover:text-leaf"
        >
          <Plus className="h-3 w-3" />
          шаг
        </button>
      </div>

      {/* nutrition accordion */}
      <details className="rounded-md border border-line/60 bg-bg-subtle/40 p-3">
        <summary className="cursor-pointer select-none text-xs font-medium text-ink-dim hover:text-ink">
          Пищевая ценность (на порцию)
        </summary>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {(["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const).map((k) => (
            <NumField
              key={k}
              label={nutritionLabel(k)}
              value={f.nutrition[k]}
              onChange={(v) => f.setNutrition({ ...f.nutrition, [k]: v })}
            />
          ))}
        </div>
      </details>

      <Field label="Аудитория" icon={<Users2 className="h-3 w-3" />} hint="Через запятую">
        <input
          value={f.audience}
          onChange={(e) => f.setAudience(e.target.value)}
          placeholder="zozh, parents, gourmets"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>
      <Field label="Хэштеги" icon={<Hash className="h-3 w-3" />} hint="Через запятую">
        <input
          value={f.tags}
          onChange={(e) => f.setTags(e.target.value)}
          placeholder="завтрак, мёд"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>
      <Field label="Заметки шефа">
        <textarea
          value={f.notes}
          onChange={(e) => f.setNotes(e.target.value)}
          rows={2}
          placeholder="Вместо черники можно использовать малину или клубнику…"
          className="w-full resize-y rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm leading-relaxed focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>
    </div>
  );
}

// ─── preview column — real recipe card ─────────────────────────────────

function PreviewColumn({ f }: { f: FormState }) {
  const total = (typeof f.prep === "number" ? f.prep : 0) + (typeof f.cook === "number" ? f.cook : 0);
  const diff = difficultyMeta(f.difficulty);
  const nutritionEntries = Object.entries(f.nutrition).filter(([, v]) => typeof v === "number");
  return (
    <aside className="sticky top-4 flex h-fit flex-col gap-3 self-start">
      <div className="smallcaps flex items-center gap-1 text-[10px] text-ink-mute">
        <ChefHat className="h-2.5 w-2.5" />
        предпросмотр рецепта
      </div>
      <article className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        {f.cover ? (
          <img src={f.cover} alt="" className="aspect-[16/10] w-full object-cover" />
        ) : (
          <div
            className="aspect-[16/10] w-full"
            style={{
              background: `radial-gradient(60% 60% at 30% 30%, hsl(var(--amber) / 0.40) 0%, transparent 60%),
                           radial-gradient(50% 60% at 80% 75%, hsl(var(--rust) / 0.30) 0%, transparent 60%),
                           linear-gradient(140deg, hsl(var(--bg-elevated)), hsl(var(--bg)))`,
            }}
          />
        )}
        <div className="space-y-4 p-6">
          <h1 className="font-display text-2xl leading-tight tracking-tight">
            {f.title.trim() || "Название рецепта"}
          </h1>
          {f.lede.trim() && <p className="italic text-ink-dim">{f.lede.trim()}</p>}

          {/* operational chips */}
          <div className="flex flex-wrap gap-1.5">
            {total > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-subtle px-2 py-0.5 text-[11px] text-ink-dim">
                <Clock className="h-2.5 w-2.5" /> {formatMinutes(total)}
              </span>
            )}
            {typeof f.servings === "number" && f.servings > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-subtle px-2 py-0.5 text-[11px] text-ink-dim">
                <Users2 className="h-2.5 w-2.5" /> {f.servings} порц.
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${diff.tone}`}>
              <Utensils className="h-2.5 w-2.5" /> {diff.label}
            </span>
          </div>

          {/* ingredients */}
          {f.ingredients.some((i) => i.name.trim()) && (
            <div>
              <div className="smallcaps mb-1 text-[10px] text-ink-mute">ингредиенты</div>
              <ul className="space-y-1 text-sm">
                {f.ingredients.filter((i) => i.name.trim()).map((it, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="h-1 w-1 shrink-0 translate-y-1 rounded-full bg-leaf" />
                    <span className="font-mono text-xs tabular-nums text-ink-dim">
                      {it.amount?.trim() || "—"}
                      {it.unit?.trim() ? ` ${it.unit.trim()}` : ""}
                    </span>
                    <span className="text-ink">{it.name.trim()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* steps */}
          {f.steps.some((s) => s.text.trim()) && (
            <div>
              <div className="smallcaps mb-2 text-[10px] text-ink-mute">приготовление</div>
              <ol className="space-y-2.5 text-sm leading-relaxed">
                {f.steps.filter((s) => s.text.trim()).map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-leaf/15 font-mono text-[10px] text-leaf">
                      {i + 1}
                    </span>
                    <span>{s.text.trim()}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {nutritionEntries.length > 0 && (
            <div className="border-t border-line/40 pt-3">
              <div className="smallcaps mb-1 text-[10px] text-ink-mute">пищевая ценность</div>
              <div className="flex flex-wrap gap-1.5">
                {nutritionEntries.map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-subtle px-2 py-0.5 text-[10px] text-ink-dim">
                    <span className="font-mono tabular-nums text-ink">{v}</span>
                    <span>{nutritionShort(k)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {(csv(f.audience).length + csv(f.tags).length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-line/40 pt-3">
              {csv(f.audience).map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full border border-plum/30 bg-plum/10 px-2 py-0.5 text-[10px] text-plum">
                  <Users2 className="h-2.5 w-2.5" /> {a}
                </span>
              ))}
              {csv(f.tags).map((h) => (
                <span key={h} className="inline-flex items-center rounded-full border border-leaf/30 bg-leaf/10 px-2 py-0.5 text-[10px] text-leaf">
                  <Hash className="h-2.5 w-2.5" /> {h.replace(/^#/, "")}
                </span>
              ))}
            </div>
          )}

          {f.notes.trim() && (
            <div className="border-t border-line/40 pt-3 text-xs italic leading-relaxed text-ink-dim">
              <span className="smallcaps mr-1 text-[10px] not-italic text-ink-mute">от шефа · </span>
              {f.notes.trim()}
            </div>
          )}
        </div>
      </article>
    </aside>
  );
}

// ─── small reusable bits ──────────────────────────────────────────────

function Shell({
  onClose, title, eyebrow, children,
}: { onClose: () => void; title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-line bg-bg/85 px-6 py-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="smallcaps text-[10px] text-amber">{eyebrow}</div>
          <h2 className="mt-1 truncate font-display text-2xl leading-tight">{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-line bg-bg/95 px-6 py-3 backdrop-blur">
      {children}
    </div>
  );
}

function FootMsg({ tone, children }: { tone: "leaf" | "rust"; children: React.ReactNode }) {
  const Icon = tone === "leaf" ? Check : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 pt-2 text-[10px] uppercase tracking-widest text-ink-mute">
      {icon}
      {title}
    </div>
  );
}

function Field({
  label, hint, icon, children,
}: { label: React.ReactNode; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-ink-mute">
        {icon}
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-ink-mute">{hint}</p>}
    </div>
  );
}

function NumField({
  label, icon, value, onChange,
}: {
  label: React.ReactNode; icon?: React.ReactNode;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <Field label={label} icon={icon}>
      <input
        type="number"
        min={0}
        value={value === "" ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-full rounded-md border border-line bg-bg-elevated px-2 py-2 text-right text-sm tabular-nums focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
      />
    </Field>
  );
}

function RowControls({
  onUp, onDown, onDelete, canUp, canDown,
}: {
  onUp: () => void; onDown: () => void; onDelete: () => void;
  canUp: boolean; canDown: boolean;
}) {
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={onUp}
        disabled={!canUp}
        aria-label="Выше"
        className="grid h-7 w-7 place-items-center rounded text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink disabled:opacity-30"
      >
        <ArrowUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!canDown}
        aria-label="Ниже"
        className="grid h-7 w-7 place-items-center rounded text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink disabled:opacity-30"
      >
        <ArrowDown className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Удалить"
        className="grid h-7 w-7 place-items-center rounded text-ink-mute transition-colors hover:bg-rust/10 hover:text-rust"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── pure helpers ──────────────────────────────────────────────────────

function csv(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function replace<T>(arr: T[], i: number, v: T): T[] {
  const out = arr.slice();
  out[i] = v;
  return out;
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

function nutritionLabel(k: string): string {
  switch (k) {
    case "calories":  return "ккал";
    case "protein_g": return "белки, г";
    case "carbs_g":   return "углев., г";
    case "fat_g":     return "жиры, г";
    case "fiber_g":   return "клетч., г";
    default:          return k;
  }
}

function nutritionShort(k: string): string {
  switch (k) {
    case "calories":  return "ккал";
    case "protein_g": return "белки";
    case "carbs_g":   return "углев.";
    case "fat_g":     return "жиры";
    case "fiber_g":   return "клетч.";
    default:          return k;
  }
}
