import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslate } from "@tolgee/react";
import {
  ArrowRight,
  Sparkles,
  Calendar,
  Bot,
  LineChart,
  Layers,
  Workflow,
  Globe2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { UserMenu } from "@/components/auth/UserMenu";
import { SeasonalityRing } from "@/components/calendar/SeasonalityRing";
import { LandingDemo } from "@/components/landing/LandingDemo";
import { LandingVideo } from "@/components/landing/LandingVideo";
import { LandingArchitecture } from "@/components/landing/LandingArchitecture";
import { LandingGallery } from "@/components/landing/LandingGallery";
import { LandingFAQ } from "@/components/landing/LandingFAQ";

// =================================================================
//  Landing — editorial dusk aesthetic.
//  Three movements: hero (manifesto + ring), feature constellation,
//  numeric proof + CTA. The Fraunces variable axis does the heavy
//  lifting on contrast; the rest is restraint.
// =================================================================
export function Landing() {
  const { t } = useTranslate();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const ringRot = useTransform(scrollYProgress, [0, 1], [0, 35]);
  const ringScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);

  return (
    <div className="relative isolate">
      {/* ── HERO ───────────────────────────────────────────────── */}
      <section ref={ref} className="relative isolate overflow-hidden">
        {/* atmospheric layers */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 grid-bg [mask-image:radial-gradient(60rem_30rem_at_50%_-10%,#000_30%,transparent_70%)]"
        />
        <div
          aria-hidden
          className="grain absolute inset-0 -z-10 opacity-30"
          style={{ filter: "blur(0.5px)" }}
        />

        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-leaf to-amber text-bg shadow-glow">
              <span className="font-display text-lg font-bold">С</span>
            </div>
            <div className="font-display text-sm font-semibold tracking-tight">
              {t("common.brand.name")}
              <span className="ml-2 text-ink-mute font-sans font-normal smallcaps text-[10px]">
                {t("common.brand.short")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="leaf" className="hidden sm:inline-flex">
              {t("landing.badge.hackathon")}
            </Badge>
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </nav>

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-28 pt-12 md:grid-cols-[1.1fr,1fr] md:pt-24">
          <motion.div
            style={{ y: heroY }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.65, 0.2, 1] }}
            className="flex flex-col gap-7"
          >
            <Badge variant="outline" className="w-fit border-leaf/40 text-leaf">
              <Sparkles className="h-3.5 w-3.5" /> {t("landing.badge.aiMarketer")}
            </Badge>

            {/* The hero headline: Fraunces variable axis at its most expressive. */}
            <h1 className="display-xl font-display text-[clamp(2.4rem,5.5vw,4.6rem)] font-semibold leading-[1.02] tracking-tight">
              {t("landing.hero.title.line1")}
              <br />
              <span className="gradient-text italic">
                {t("landing.hero.title.line2")}
              </span>
              <br />
              <span className="ink-gradient">{t("landing.hero.title.line3")}</span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-ink-dim">
              {t("landing.hero.body")}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/farmers">
                  {t("common.cta.pickFarmer")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href="#demo" rel="noreferrer">
                  {t("common.cta.tryDemo")}
                </a>
              </Button>
            </div>

            <dl className="mt-2 flex flex-wrap items-baseline gap-x-8 gap-y-3 text-sm text-ink-mute">
              <Stat label={t("landing.stats.skus")} value="3 491" />
              <Stat label={t("landing.stats.farmers")} value="65" />
              <Stat label={t("landing.stats.events")} value="40+" />
              <Stat label={t("landing.stats.channels")} value="6" />
            </dl>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.2, 0.65, 0.2, 1] }}
            className="relative grid place-items-center"
          >
            <motion.div style={{ rotate: ringRot, scale: ringScale }}>
              <SeasonalityRing size={380} />
            </motion.div>
            <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-gradient-to-tr from-leaf/15 via-transparent to-amber/20 blur-3xl" />
            <FloatingTag
              className="left-1 top-6 sm:left-0"
              accent="leaf"
              label={t("landing.tag.season.label")}
              value={t("landing.tag.season.value")}
            />
            <FloatingTag
              className="-bottom-3 right-2"
              accent="amber"
              label={t("landing.tag.event.label")}
              value={t("landing.tag.event.value")}
            />
          </motion.div>
        </div>

        {/* hairline */}
        <div className="mx-auto max-w-7xl border-t border-line/60 px-6" />
      </section>

      {/* ── INTERACTIVE DEMO — try it without login ─────────────── */}
      <LandingDemo />

      {/* ── VIDEO — recorded product demonstration ──────────────── */}
      <LandingVideo />

      {/* ── HOW IT WORKS — three-step manifesto ────────────────── */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-24">
        <header className="mb-12 flex items-end justify-between gap-6">
          <div>
            <span className="smallcaps text-[11px] text-ink-mute">
              {t("landing.how.eyebrow")}
            </span>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-5xl">
              {t("landing.how.title.line1")}<br className="hidden md:block" />
              <span className="text-ink-mute">{t("landing.how.title.line2")}</span>
            </h2>
          </div>
          <Badge variant="leaf">{t("landing.how.badge")}</Badge>
        </header>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-line/70 bg-line/40 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.article
              key={f.titleKey}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="group relative flex flex-col gap-3 bg-bg-elevated p-7"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-ink-mute">
                  0{i + 1}
                </span>
                <span
                  className="grid h-8 w-8 place-items-center rounded-md border border-line bg-bg-subtle text-leaf transition group-hover:border-leaf/50 group-hover:text-leaf"
                  aria-hidden
                >
                  <f.icon className="h-4 w-4" />
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold leading-tight">
                {t(f.titleKey)}
              </h3>
              <p className="text-sm leading-relaxed text-ink-dim">{t(f.bodyKey)}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ── ARCHITECTURE — animated node graph ──────────────────── */}
      <LandingArchitecture />

      {/* ── GALLERY — product surfaces ──────────────────────────── */}
      <LandingGallery />

      {/* ── FAQ — accordion ─────────────────────────────────────── */}
      <LandingFAQ />

      {/* ── PROOF · final CTA ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="glass relative overflow-hidden rounded-3xl px-8 py-14 md:px-14 md:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-leaf/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-12 h-80 w-80 rounded-full bg-amber/15 blur-3xl"
          />
          <div className="relative grid items-end gap-10 md:grid-cols-[2fr,1fr]">
            <div>
              <span className="smallcaps text-[11px] text-ink-mute">{t("landing.proof.eyebrow")}</span>
              <p className="mt-3 font-display text-2xl font-semibold leading-snug md:text-4xl">
                <em className="not-italic gradient-text">{t("landing.proof.body.bold")}</em>
                {" "}{t("landing.proof.body.before")}{" "}
                <span className="ink-gradient">{t("landing.proof.body.middle")}</span>
                {" "}{t("landing.proof.body.after")}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild size="lg">
                <Link to="/farmers">
                  {t("common.cta.pickFarmer")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <p className="text-xs text-ink-mute">
                {t("landing.proof.note")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line/60 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 md:flex-row">
          <p className="text-xs text-ink-mute">{t("landing.footer.copyright")}</p>
          <p className="font-mono text-[11px] text-ink-mute">
            {t("landing.footer.stack")}
          </p>
        </div>
      </footer>
    </div>
  );
}

// ── building blocks ────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono tnum text-2xl font-medium text-ink">{value}</span>
      <span className="smallcaps text-[10px] text-ink-mute">{label}</span>
    </div>
  );
}

function FloatingTag({
  className,
  accent,
  label,
  value,
}: {
  className?: string;
  accent: "leaf" | "amber";
  label: string;
  value: string;
}) {
  const dotCls = accent === "leaf" ? "bg-leaf" : "bg-amber";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className={`glass absolute z-10 hidden items-center gap-2 rounded-full px-3 py-1.5 text-[11px] sm:flex ${className ?? ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} aria-hidden />
      <span className="smallcaps text-ink-mute">{label}</span>
      <span className="font-mono tnum text-ink">{value}</span>
    </motion.div>
  );
}

const features = [
  { titleKey: "landing.features.calendar.title",    bodyKey: "landing.features.calendar.body",    icon: Calendar },
  { titleKey: "landing.features.aiCampaigns.title", bodyKey: "landing.features.aiCampaigns.body", icon: Bot },
  { titleKey: "landing.features.roi.title",         bodyKey: "landing.features.roi.body",         icon: LineChart },
  { titleKey: "landing.features.tagging.title",     bodyKey: "landing.features.tagging.body",     icon: Layers },
  { titleKey: "landing.features.kanban.title",      bodyKey: "landing.features.kanban.body",      icon: Workflow },
  { titleKey: "landing.features.global.title",      bodyKey: "landing.features.global.body",      icon: Globe2 },
];
