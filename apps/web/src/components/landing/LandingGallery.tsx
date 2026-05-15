import { motion } from "framer-motion";
import { useTranslate } from "@tolgee/react";

// =================================================================
//  LandingGallery — asymmetric editorial product gallery.
//  Eight surfaces, sized by visual weight (hero tiles tall + wide,
//  supporting tiles compact). Captions in smallcaps, accent dot
//  per tile, no shadows. Lazy-loaded screenshots from /images.
// =================================================================

type Tile = {
  key: string;
  src: string;
  span: string;
  accent: "leaf" | "amber" | "plum" | "sky" | "rust";
  numeralKey: string;
  labelKey: string;
  bodyKey: string;
};

const TILES: Tile[] = [
  {
    key: "dashboard",
    src: "/images/dashboard.png",
    span: "md:col-span-7 md:row-span-2",
    accent: "leaf",
    numeralKey: "landing.gallery.dashboard.numeral",
    labelKey: "landing.gallery.dashboard.label",
    bodyKey: "landing.gallery.dashboard.body",
  },
  {
    key: "calendar",
    src: "/images/calendar-month.png",
    span: "md:col-span-5",
    accent: "amber",
    numeralKey: "landing.gallery.calendar.numeral",
    labelKey: "landing.gallery.calendar.label",
    bodyKey: "landing.gallery.calendar.body",
  },
  {
    key: "ai",
    src: "/images/ai-assistant.png",
    span: "md:col-span-5",
    accent: "plum",
    numeralKey: "landing.gallery.ai.numeral",
    labelKey: "landing.gallery.ai.label",
    bodyKey: "landing.gallery.ai.body",
  },
  {
    key: "kanban",
    src: "/images/kanban-board.png",
    span: "md:col-span-6",
    accent: "sky",
    numeralKey: "landing.gallery.kanban.numeral",
    labelKey: "landing.gallery.kanban.label",
    bodyKey: "landing.gallery.kanban.body",
  },
  {
    key: "stories",
    src: "/images/stories-editor.png",
    span: "md:col-span-6",
    accent: "rust",
    numeralKey: "landing.gallery.stories.numeral",
    labelKey: "landing.gallery.stories.label",
    bodyKey: "landing.gallery.stories.body",
  },
  {
    key: "social",
    src: "/images/social-editor.png",
    span: "md:col-span-4",
    accent: "leaf",
    numeralKey: "landing.gallery.social.numeral",
    labelKey: "landing.gallery.social.label",
    bodyKey: "landing.gallery.social.body",
  },
  {
    key: "push",
    src: "/images/push-editor.png",
    span: "md:col-span-4",
    accent: "amber",
    numeralKey: "landing.gallery.push.numeral",
    labelKey: "landing.gallery.push.label",
    bodyKey: "landing.gallery.push.body",
  },
  {
    key: "roi",
    src: "/images/roi-popover.png",
    span: "md:col-span-4",
    accent: "plum",
    numeralKey: "landing.gallery.roi.numeral",
    labelKey: "landing.gallery.roi.label",
    bodyKey: "landing.gallery.roi.body",
  },
];

const ACCENT_DOT: Record<Tile["accent"], string> = {
  leaf: "bg-leaf",
  amber: "bg-amber",
  plum: "bg-plum",
  sky: "bg-sky",
  rust: "bg-rust",
};

const ACCENT_RING: Record<Tile["accent"], string> = {
  leaf: "group-hover:border-leaf/50",
  amber: "group-hover:border-amber/50",
  plum: "group-hover:border-plum/50",
  sky: "group-hover:border-sky/50",
  rust: "group-hover:border-rust/50",
};

export function LandingGallery() {
  const { t } = useTranslate();

  return (
    <section id="gallery" className="mx-auto max-w-7xl px-6 py-24">
      <header className="mb-12 flex items-end justify-between gap-6">
        <div>
          <span className="smallcaps text-[11px] text-ink-mute">
            {t("landing.gallery.eyebrow")}
          </span>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-5xl">
            {t("landing.gallery.title.line1")}
            <br className="hidden md:block" />
            <span className="text-ink-mute italic">
              {t("landing.gallery.title.line2")}
            </span>
          </h2>
        </div>
        <p className="hidden max-w-xs text-right text-sm leading-relaxed text-ink-dim md:block">
          {t("landing.gallery.intro")}
        </p>
      </header>

      <div className="grid auto-rows-[18rem] grid-cols-1 gap-4 md:grid-cols-12 md:auto-rows-[14rem]">
        {TILES.map((tile, i) => (
          <motion.figure
            key={tile.key}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, delay: i * 0.05, ease: [0.2, 0.65, 0.2, 1] }}
            className={`group relative col-span-1 overflow-hidden rounded-xl border border-line/70 bg-bg-elevated transition-colors duration-300 ${tile.span} ${ACCENT_RING[tile.accent]}`}
          >
            <img
              src={tile.src}
              alt={t(tile.labelKey)}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-top opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-[1.015]"
            />
            {/* gradient veil for legibility */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent"
            />
            {/* numeral corner */}
            <span className="absolute right-3 top-3 font-mono text-[10px] tracking-wider text-ink-mute">
              {t(tile.numeralKey)}
            </span>
            <figcaption className="absolute inset-x-4 bottom-4 flex items-center gap-2.5 text-ink">
              <span
                className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT[tile.accent]}`}
                aria-hidden
              />
              <span className="smallcaps text-[10px] text-ink-mute">
                {t(tile.labelKey)}
              </span>
              <span
                aria-hidden
                className="h-px flex-1 bg-line/60"
              />
              <span className="font-display text-sm font-medium tracking-tight text-ink">
                {t(tile.bodyKey)}
              </span>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
