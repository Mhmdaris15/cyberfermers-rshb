import { motion } from "framer-motion";
import { Archive, CalendarClock, Hash, Instagram, Layers, MessageCircle, Pencil, Send, Sparkles } from "lucide-react";

import type { GeneratedContent } from "@/lib/types";
import {
  PLATFORMS, platformMeta, socialCaption, socialPlatforms,
  socialScheduledFor, socialSlides, socialTitle,
  type SocialBody, type SocialPlatform,
} from "@/lib/social";

// =====================================================================
//  SocialCard — Instagram-tile aesthetic.
//
//  First slide image is the cover (square crop for IG-feed vibes).
//  Platform icon chips sit on top so a single glance tells the operator
//  "this is queued for IG + TG". A "scheduled" pill replaces the
//  status pill when scheduled_for is set, because that's the more
//  decision-relevant fact for a social post.
// =====================================================================

const PLATFORM_ICON: Record<SocialPlatform, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  telegram:  Send,
  vk:        MessageCircle,
};

export function SocialCard({ post, onOpen }: { post: GeneratedContent; onOpen: () => void }) {
  const title    = socialTitle(post);
  const caption  = socialCaption(post);
  const slides   = socialSlides(post);
  const platforms = socialPlatforms(post);
  const tags     = ((post.body as SocialBody | undefined)?.hashtags ?? []).slice(0, 3);
  const ai       = !post.is_user_edited;
  const scheduled = socialScheduledFor(post);
  const cover    = slides[0]?.image_url;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-bg-elevated/40 text-left transition-shadow hover:shadow-glass focus-ring"
    >
      {/* Square cover for IG-feed vibes */}
      <div className="relative aspect-square w-full overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt={slides[0]?.alt ?? ""}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <CoverFallback seed={post.id ?? title} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-elevated via-transparent to-transparent opacity-95" />

        {/* slide count badge (IG-style "1/N") */}
        {slides.length > 1 && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 font-mono text-[10px] text-ink-dim backdrop-blur">
            <Layers className="h-2.5 w-2.5" />
            1/{slides.length}
          </span>
        )}

        {/* status / scheduled pill — scheduled replaces status when set */}
        <span className="absolute right-3 top-3">
          {scheduled
            ? <ScheduledPill at={scheduled} />
            : <StatusPill status={post.status ?? "draft"} />}
        </span>

        {/* author badge */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-bg/30 bg-bg/70 px-2 py-0.5 text-[10px] text-ink-dim backdrop-blur">
          {ai ? <Sparkles className="h-2.5 w-2.5 text-amber" /> : <Pencil className="h-2.5 w-2.5 text-leaf" />}
          {ai ? "AI" : "автор"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
        <h3 className="line-clamp-1 font-display text-base leading-tight tracking-tight">
          {title}
        </h3>
        {caption && (
          <p className="line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-ink-dim">
            {caption}
          </p>
        )}

        {/* platform chips */}
        {platforms.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {platforms.map((p) => {
              const Icon = PLATFORM_ICON[p];
              return (
                <span
                  key={p}
                  className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-br ${platformMeta(p).tone} px-1.5 py-0.5 text-[10px] text-bg`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {platformMeta(p).label}
                </span>
              );
            })}
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {tags.map((h) => (
              <span key={h} className="inline-flex items-center rounded-full border border-leaf/30 bg-leaf/10 px-1.5 py-0.5 text-[10px] text-leaf">
                <Hash className="h-2.5 w-2.5" />
                {h.replace(/^#/, "")}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-line/40 pt-2 text-[11px] text-ink-mute">
          <span>{formatDate(post.updated_at ?? post.created_at)}</span>
          {(post.current_revision ?? 1) > 1 && (
            <span className="font-mono">v{post.current_revision}</span>
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

function ScheduledPill({ at }: { at: Date }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky/40 bg-sky/15 px-2 py-0.5 text-[10px] text-sky backdrop-blur">
      <CalendarClock className="h-2.5 w-2.5" />
      {at.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

function CoverFallback({ seed }: { seed: string }) {
  // Sweep through IG-ish vibrant gradients (warm pink → orange).
  const h = hash(seed);
  const a = (h * 17 + 0)  % 60;
  const b = (h * 11 + 310) % 360;
  return (
    <div
      className="relative h-full w-full"
      style={{
        background: `
          radial-gradient(60% 60% at 30% 30%, hsl(${a} 70% 30%) 0%, transparent 60%),
          radial-gradient(50% 60% at 80% 75%, hsl(${b} 65% 25%) 0%, transparent 60%),
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

void PLATFORMS; // kept imported for type narrowing nearby
