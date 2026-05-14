import { motion } from "framer-motion";
import { Archive, Hash, Pencil, Sparkles, Users } from "lucide-react";

import type { GeneratedContent } from "@/lib/types";
import { storyBody, storyHeroImage, storyTitle, type StoryBody } from "@/lib/stories";

// =====================================================================
//  StoryCard — magazine-row preview card for the Stories grid.
//
//  Editorial intent: each card reads like a magazine spread cell — hero
//  image at the top (or a gradient mood-board fallback when missing),
//  Fraunces title, two-line body excerpt, status pill + AI/manual
//  authorship marker. Hover lifts the card slightly and reveals the
//  Pencil "edit" affordance.
// =====================================================================

interface Props {
  story: GeneratedContent;
  onOpen: () => void;
}

export function StoryCard({ story, onOpen }: Props) {
  const title = storyTitle(story);
  const excerpt = excerptOf(storyBody(story), 140);
  const hero = storyHeroImage(story);
  const ai = !story.is_user_edited;
  const tags = (story.body as StoryBody | undefined)?.hashtags ?? [];
  const aud  = (story.body as StoryBody | undefined)?.audience_tags ?? [];

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-bg-elevated/40 text-left transition-shadow hover:shadow-glass focus-ring"
    >
      {/* Hero — image or generated gradient fallback */}
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {hero ? (
          <img
            src={hero}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <HeroFallback seed={story.id ?? title} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-elevated via-transparent to-transparent opacity-95" />

        {/* status pill, top-right */}
        <span className="absolute right-3 top-3">
          <StatusPill status={story.status ?? "draft"} />
        </span>

        {/* AI / manual badge, top-left */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-bg/30 bg-bg/70 px-2 py-0.5 text-[10px] text-ink-dim backdrop-blur">
          {ai ? <Sparkles className="h-2.5 w-2.5 text-amber" /> : <Pencil className="h-2.5 w-2.5 text-leaf" />}
          {ai ? "AI" : "автор"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        <h3 className="line-clamp-2 font-display text-lg leading-tight tracking-tight">
          {title}
        </h3>
        {excerpt && (
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-dim">
            {excerpt}
          </p>
        )}

        {(aud.length + tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {aud.slice(0, 2).map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full border border-plum/30 bg-plum/10 px-1.5 py-0.5 text-[10px] text-plum">
                <Users className="h-2.5 w-2.5" />
                {a}
              </span>
            ))}
            {tags.slice(0, 3).map((h) => (
              <span key={h} className="inline-flex items-center rounded-full border border-leaf/30 bg-leaf/10 px-1.5 py-0.5 text-[10px] text-leaf">
                <Hash className="h-2.5 w-2.5" />
                {h.replace(/^#/, "")}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-line/40 pt-2.5 text-[11px] text-ink-mute">
          <span>{formatDate(story.updated_at ?? story.created_at)}</span>
          {(story.current_revision ?? 1) > 1 && (
            <span className="font-mono">v{story.current_revision}</span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ─── pieces ───────────────────────────────────────────────────────────────

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

// HeroFallback — a stable per-story gradient + grain texture. Two hash
// passes over the seed feed the gradient stop angles + accent colors so
// every story without an image still looks intentional and distinct.
function HeroFallback({ seed }: { seed: string }) {
  const h = hash(seed);
  const a = h % 360;
  const b = (h * 7) % 360;
  return (
    <div
      className="relative h-full w-full"
      style={{
        background: `
          radial-gradient(60% 60% at 20% 30%, hsl(${a} 55% 22%) 0%, transparent 60%),
          radial-gradient(50% 60% at 80% 70%, hsl(${b} 55% 18%) 0%, transparent 60%),
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
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function excerptOf(s: string, n: number): string {
  if (!s) return "";
  // Strip the first line if it duplicates the title (common in AI output).
  const cleaned = s.replace(/^#+\s.*\n/, "").trim();
  if (cleaned.length <= n) return cleaned;
  return cleaned.slice(0, n) + "…";
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "2-digit" });
}
