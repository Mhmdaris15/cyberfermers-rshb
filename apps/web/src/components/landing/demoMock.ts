// =====================================================================
//  demoMock.ts
//
//  Pre-baked realistic-looking data for the landing-page Interactive Demo.
//  Nothing here hits the real API — the auth-gated production endpoints
//  aren't reachable from the public landing, and even if they were the
//  Gemini cost would be wasted on visitors who haven't logged in yet.
//
//  Everything is shaped to match the real domain (channels, events,
//  audiences, score ranges, reason chips). The "live AI" wow factor
//  comes from the streaming animation in LandingDemo, not from real
//  inference.
//
//  i18n note: visible labels are stored as Tolgee key strings (suffix
//  `*Key`). The component renders them via t() so RU/EN switch in place.
//  Slug/score/numeric fields stay literal — they're not user-visible
//  copy, they're domain identifiers.
// =====================================================================

import type { LucideIcon } from "lucide-react";
import { Carrot, Milk, FlaskConical, Leaf, Wheat } from "lucide-react";

export interface MockFarmer {
  id: string;
  nameKey: string;
  blurbKey: string;
  categoryKey: string;
  skus: number;
  badgeKey: string;
  tone: "leaf" | "amber" | "plum" | "sky" | "rust";
  icon: LucideIcon;
  regionKey: string;
}

export const MOCK_FARMERS: MockFarmer[] = [
  {
    id: "ogorod",
    nameKey: "demo.farmer.ogorod.name",
    blurbKey: "demo.farmer.ogorod.blurb",
    categoryKey: "demo.farmer.cat.vegetables",
    skus: 142,
    badgeKey: "demo.farmer.badge.premium",
    tone: "leaf",
    icon: Carrot,
    regionKey: "demo.farmer.region.moscowRegion",
  },
  {
    id: "dikiy-med",
    nameKey: "demo.farmer.dikiyMed.name",
    blurbKey: "demo.farmer.dikiyMed.blurb",
    categoryKey: "demo.farmer.cat.honey",
    skus: 38,
    badgeKey: "demo.farmer.badge.organic",
    tone: "amber",
    icon: FlaskConical,
    regionKey: "demo.farmer.region.bashkortostan",
  },
  {
    id: "dom-syra",
    nameKey: "demo.farmer.domSyra.name",
    blurbKey: "demo.farmer.domSyra.blurb",
    categoryKey: "demo.farmer.cat.cheese",
    skus: 24,
    badgeKey: "demo.farmer.badge.artisan",
    tone: "plum",
    icon: Milk,
    regionKey: "demo.farmer.region.tver",
  },
  {
    id: "zelyonyi-klin",
    nameKey: "demo.farmer.zelyonyiKlin.name",
    blurbKey: "demo.farmer.zelyonyiKlin.blurb",
    categoryKey: "demo.farmer.cat.greens",
    skus: 67,
    badgeKey: "demo.farmer.badge.healthy",
    tone: "sky",
    icon: Leaf,
    regionKey: "demo.farmer.region.moscow",
  },
  {
    id: "russkoe-pole",
    nameKey: "demo.farmer.russkoePole.name",
    blurbKey: "demo.farmer.russkoePole.blurb",
    categoryKey: "demo.farmer.cat.grain",
    skus: 19,
    badgeKey: "demo.farmer.badge.craft",
    tone: "rust",
    icon: Wheat,
    regionKey: "demo.farmer.region.tula",
  },
];

// ─── events / triggers ────────────────────────────────────────────────

export interface MockEvent {
  slug: string;
  labelKey: string;
  type: "праздник" | "православный" | "сезон" | "тренд" | "тематика";
  dateKey: string;
  tone: "leaf" | "amber" | "plum" | "sky" | "rust";
}

export const MOCK_EVENTS: MockEvent[] = [
  { slug: "easter",       labelKey: "demo.event.easter",       type: "православный", dateKey: "demo.event.date.easter",       tone: "amber" },
  { slug: "med-spas",     labelKey: "demo.event.medSpas",      type: "православный", dateKey: "demo.event.date.medSpas",      tone: "amber" },
  { slug: "fermentation", labelKey: "demo.event.fermentation", type: "тренд",        dateKey: "demo.event.date.fermentation", tone: "plum" },
  { slug: "zozh-week",    labelKey: "demo.event.zozhWeek",     type: "тематика",     dateKey: "demo.event.date.zozhWeek",     tone: "leaf" },
  { slug: "harvest",      labelKey: "demo.event.harvest",      type: "сезон",        dateKey: "demo.event.date.harvest",      tone: "rust" },
  { slug: "gift-season",  labelKey: "demo.event.giftSeason",   type: "сезон",        dateKey: "demo.event.date.giftSeason",   tone: "plum" },
];

export const MOCK_AUDIENCES = [
  { slug: "zozh",        labelKey: "demo.audience.zozh" },
  { slug: "parents",     labelKey: "demo.audience.parents" },
  { slug: "gourmets",    labelKey: "demo.audience.gourmets" },
  { slug: "gift_buyers", labelKey: "demo.audience.giftBuyers" },
] as const;

// ─── streaming-stage script ───────────────────────────────────────────
// Stream lines render as terminal commands. The cmd text is intentionally
// English/code-like ("analyze_catalog(...)") so it reads as system output
// in either UI language; only the trailing free-text status is localized.

export interface StreamStage {
  cmd: string;
  ms: number;
  out: string;
}

export const STREAM_STAGES: StreamStage[] = [
  { cmd: "analyze_catalog(skus, categories, tags)",  ms: 320,  out: "132ms · 8 cats, 412 tags" },
  { cmd: "match_events(farmer.region, season)",      ms: 280,  out: "84ms · 14 candidates" },
  { cmd: "embed_query(audience, trend) · gemini-001", ms: 520, out: "280ms · 768-d vector" },
  { cmd: "knn_search(top_k=12, dist=COSINE)",        ms: 240,  out: "41ms · of 412 SKU" },
  { cmd: "score_with_memory(ai_memory=158 signals)", ms: 320,  out: "92ms · boost +0.34" },
  { cmd: "generate_content(push, story, blog)",      ms: 720,  out: "1.84s · gemini-2.5-flash" },
  { cmd: "build_plan(kanban, roi_engine)",           ms: 220,  out: "38ms · 3 cards, ROI +37%" },
];

// ─── output deck ──────────────────────────────────────────────────────

export interface MockRecommendation {
  titleKey: string;
  eventKey: string;
  audienceKey: string;
  reasons: string[];      // chip labels — kept literal (they're system tokens)
  confidence: number;
  delta_orders: number;
  delta_revenue_rub: number;
  tone: "leaf" | "amber" | "plum" | "sky";
}

export const MOCK_RECS: MockRecommendation[] = [
  {
    titleKey: "demo.rec.honeyBasket.title",
    eventKey: "demo.rec.honeyBasket.event",
    audienceKey: "demo.rec.honeyBasket.audience",
    reasons: ["tag:honey", "season:summer-end", "trend:+18%", "mem:0.84"],
    confidence: 0.92,
    delta_orders: 142,
    delta_revenue_rub: 318_000,
    tone: "amber",
  },
  {
    titleKey: "demo.rec.fermentation.title",
    eventKey: "demo.rec.fermentation.event",
    audienceKey: "demo.rec.fermentation.audience",
    reasons: ["tag:fermented", "cat:vegetables", "trend:+24%"],
    confidence: 0.81,
    delta_orders: 96,
    delta_revenue_rub: 184_000,
    tone: "plum",
  },
  {
    titleKey: "demo.rec.morningRitual.title",
    eventKey: "demo.rec.morningRitual.event",
    audienceKey: "demo.rec.morningRitual.audience",
    reasons: ["recipe-bundle", "cross-farmer", "mem:0.71"],
    confidence: 0.76,
    delta_orders: 78,
    delta_revenue_rub: 142_000,
    tone: "leaf",
  },
  {
    titleKey: "demo.rec.subscription.title",
    eventKey: "demo.rec.subscription.event",
    audienceKey: "demo.rec.subscription.audience",
    reasons: ["repeat-cadence:14d", "ai_memory:0.68"],
    confidence: 0.69,
    delta_orders: 54,
    delta_revenue_rub: 268_000,
    tone: "sky",
  },
];

// ─── content drafts ───────────────────────────────────────────────────

export interface MockContentDraft {
  channel: "push" | "story" | "blog" | "social";
  titleKey: string;
  bodyKey: string;
}

export const MOCK_CONTENT: MockContentDraft[] = [
  { channel: "push",   titleKey: "demo.content.push.title",   bodyKey: "demo.content.push.body" },
  { channel: "story",  titleKey: "demo.content.story.title",  bodyKey: "demo.content.story.body" },
  { channel: "blog",   titleKey: "demo.content.blog.title",   bodyKey: "demo.content.blog.body" },
  { channel: "social", titleKey: "demo.content.social.title", bodyKey: "demo.content.social.body" },
];

// ─── kanban preview ───────────────────────────────────────────────────

export interface MockPlanCard {
  column: "proposed" | "planned" | "live";
  titleKey: string;
  dueKey: string;
  channels: string[];
  tone: "leaf" | "amber" | "plum";
}

export const MOCK_KANBAN: MockPlanCard[] = [
  { column: "live",     titleKey: "demo.kanban.live.title",     dueKey: "demo.kanban.live.due",     channels: ["push", "story"],  tone: "amber" },
  { column: "planned",  titleKey: "demo.kanban.planned.title",  dueKey: "demo.kanban.planned.due",  channels: ["blog", "recipe"], tone: "plum"  },
  { column: "proposed", titleKey: "demo.kanban.proposed.title", dueKey: "demo.kanban.proposed.due", channels: ["social", "push"], tone: "leaf"  },
];

export function totalStreamMs(stages: StreamStage[] = STREAM_STAGES): number {
  return stages.reduce((s, x) => s + x.ms, 0);
}
