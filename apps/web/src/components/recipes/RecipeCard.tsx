import { motion } from "framer-motion";
import { Archive, Clock, Hash, Pencil, Sparkles, Users2, Utensils } from "lucide-react";

import type { GeneratedContent } from "@/lib/types";
import {
  difficultyMeta, formatMinutes, recipeCoverImage, recipeLede,
  recipeServings, recipeTitle, recipeTotalMinutes,
  type RecipeBody,
} from "@/lib/recipes";

// =====================================================================
//  RecipeCard — recipe-card aesthetic. Three operational chips
//  (time / servings / difficulty) lead the meta strip because those
//  are what someone scanning a recipe library actually decides on.
//  Lede is short prose; cover fallback uses an amber/rust palette
//  (kitchen warmth) to differentiate from Stories (plum) and Blogs (sky).
// =====================================================================

export function RecipeCard({ recipe, onOpen }: { recipe: GeneratedContent; onOpen: () => void }) {
  const title = recipeTitle(recipe);
  const lede  = recipeLede(recipe);
  const cover = recipeCoverImage(recipe);
  const ai    = !recipe.is_user_edited;
  const total = recipeTotalMinutes(recipe);
  const serv  = recipeServings(recipe);
  const diff  = difficultyMeta((recipe.body as RecipeBody | undefined)?.difficulty);
  const tags  = ((recipe.body as RecipeBody | undefined)?.hashtags ?? []).slice(0, 3);

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-bg-elevated/40 text-left transition-shadow hover:shadow-glass focus-ring"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <CoverFallback seed={recipe.id ?? title} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-elevated via-transparent to-transparent opacity-95" />

        <span className="absolute right-3 top-3">
          <StatusPill status={recipe.status ?? "draft"} />
        </span>
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-bg/30 bg-bg/70 px-2 py-0.5 text-[10px] text-ink-dim backdrop-blur">
          {ai ? <Sparkles className="h-2.5 w-2.5 text-amber" /> : <Pencil className="h-2.5 w-2.5 text-leaf" />}
          {ai ? "AI" : "автор"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-5 py-4">
        <h3 className="line-clamp-2 font-display text-xl leading-tight tracking-tight">
          {title}
        </h3>
        {lede && (
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-dim">
            {lede}
          </p>
        )}

        {/* operational chip row — the recipe's actual decision metadata */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {total > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-subtle px-2 py-0.5 text-[10px] text-ink-dim">
              <Clock className="h-2.5 w-2.5" />
              {formatMinutes(total)}
            </span>
          )}
          {serv && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-subtle px-2 py-0.5 text-[10px] text-ink-dim">
              <Users2 className="h-2.5 w-2.5" />
              {serv}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${diff.tone}`}>
            <Utensils className="h-2.5 w-2.5" />
            {diff.label}
          </span>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((h) => (
              <span key={h} className="inline-flex items-center rounded-full border border-leaf/30 bg-leaf/10 px-1.5 py-0.5 text-[10px] text-leaf">
                <Hash className="h-2.5 w-2.5" />
                {h.replace(/^#/, "")}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-line/40 pt-2.5 text-[11px] text-ink-mute">
          <span>{formatDate(recipe.updated_at ?? recipe.created_at)}</span>
          {(recipe.current_revision ?? 1) > 1 && (
            <span className="font-mono">v{recipe.current_revision}</span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function StatusPill({ status }: { status: NonNullable<GeneratedContent["status"]> }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-leaf/40 bg-leaf/20 px-2 py-0.5 text-[10px] text-leaf backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-leaf" />
        опубликовано
      </span>
    );
  }
  if (status === "archived") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg/70 px-2 py-0.5 text-[10px] text-ink-mute backdrop-blur">
        <Archive className="h-2.5 w-2.5" />
        в&nbsp;архиве
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/15 px-2 py-0.5 text-[10px] text-amber backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full bg-amber" />
      черновик
    </span>
  );
}

// CoverFallback — amber/rust palette for kitchen warmth.
function CoverFallback({ seed }: { seed: string }) {
  const h = hash(seed);
  const a = (h * 13 + 30)  % 60 + 20;
  const b = (h * 7  + 350) % 30 + 0;
  return (
    <div
      className="relative h-full w-full"
      style={{
        background: `
          radial-gradient(60% 60% at 30% 30%, hsl(${a} 60% 22%) 0%, transparent 60%),
          radial-gradient(50% 60% at 80% 75%, hsl(${b} 65% 20%) 0%, transparent 60%),
          linear-gradient(140deg, hsl(var(--bg-elevated)), hsl(var(--bg)))`,
      }}
    >
      <div
        aria-hidden
        className="grain absolute inset-0 opacity-60"
        style={{ filter: "blur(0.5px)" }}
      />
    </div>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "2-digit" });
}
