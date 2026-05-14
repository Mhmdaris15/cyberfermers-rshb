import { motion } from "framer-motion";
import { Archive, Clock, Hash, Pencil, Sparkles } from "lucide-react";

import type { GeneratedContent } from "@/lib/types";
import {
  blogCoverImage, blogLede, blogTitle, readingMinutes,
  type BlogBody,
} from "@/lib/blogs";

// =====================================================================
//  BlogCard — editorial archive row. Reading-time-first, image-second.
//
//  Differs from StoryCard: the lede gets more vertical space, the cover
//  is wider (16:8 instead of 16:9), and the meta strip surfaces reading
//  time + SEO keyword count instead of audience chips.
// =====================================================================

export function BlogCard({ blog, onOpen }: { blog: GeneratedContent; onOpen: () => void }) {
  const title = blogTitle(blog);
  const lede  = blogLede(blog);
  const cover = blogCoverImage(blog);
  const ai    = !blog.is_user_edited;
  const seoKw = ((blog.body as BlogBody | undefined)?.seo_keywords ?? []).slice(0, 4);
  const mins  = readingMinutes(blog);

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-bg-elevated/40 text-left transition-shadow hover:shadow-glass focus-ring"
    >
      <div className="relative aspect-[16/8] w-full overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <CoverFallback seed={blog.id ?? title} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-elevated via-transparent to-transparent opacity-95" />

        {/* status pill, top-right */}
        <span className="absolute right-3 top-3">
          <StatusPill status={blog.status ?? "draft"} />
        </span>

        {/* author marker, top-left */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-bg/30 bg-bg/70 px-2 py-0.5 text-[10px] text-ink-dim backdrop-blur">
          {ai ? <Sparkles className="h-2.5 w-2.5 text-amber" /> : <Pencil className="h-2.5 w-2.5 text-leaf" />}
          {ai ? "AI" : "автор"}
        </span>

        {/* reading time chip, bottom-right */}
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 text-[10px] text-ink-dim backdrop-blur">
          <Clock className="h-2.5 w-2.5" />
          {mins} мин чтения
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-5 py-4">
        <h3 className="line-clamp-2 font-display text-xl leading-tight tracking-tight">
          {title}
        </h3>
        {lede && (
          <p className="line-clamp-3 text-sm italic leading-relaxed text-ink-dim">
            {lede}
          </p>
        )}

        {seoKw.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {seoKw.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-0.5 rounded-full border border-sky/30 bg-sky/10 px-1.5 py-0.5 text-[10px] text-sky"
              >
                <Hash className="h-2.5 w-2.5" />
                {k}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-line/40 pt-2.5 text-[11px] text-ink-mute">
          <span>{formatDate(blog.updated_at ?? blog.created_at)}</span>
          {(blog.current_revision ?? 1) > 1 && (
            <span className="font-mono">v{blog.current_revision}</span>
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

// CoverFallback — sky/amber gradient + grain. Same seeded-hash idea as
// StoryCard's HeroFallback, but the palette leans cooler (sky-led
// instead of plum-led) so blogs read as more editorial / informational.
function CoverFallback({ seed }: { seed: string }) {
  const h = hash(seed);
  const a = (h + 200) % 360;
  const b = (h * 11 + 40) % 360;
  return (
    <div
      className="relative h-full w-full"
      style={{
        background: `
          radial-gradient(60% 60% at 25% 25%, hsl(${a} 50% 20%) 0%, transparent 60%),
          radial-gradient(50% 60% at 80% 75%, hsl(${b} 55% 18%) 0%, transparent 60%),
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
