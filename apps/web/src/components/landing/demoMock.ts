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
//  inference. This file is the script that animation reveals.
// =====================================================================

import type { LucideIcon } from "lucide-react";
import { Carrot, Milk, FlaskConical, Leaf, Wheat } from "lucide-react";

export interface MockFarmer {
  id: string;
  name: string;
  blurb: string;
  category: string;
  skus: number;
  badge: string;       // small chip on the card
  tone: "leaf" | "amber" | "plum" | "sky" | "rust";
  icon: LucideIcon;
  region: string;
}

export const MOCK_FARMERS: MockFarmer[] = [
  {
    id: "ogorod",
    name: "Экоферма ОГО-РОД",
    blurb: "Сезонные овощи, теплицы, открытый грунт",
    category: "овощи",
    skus: 142,
    badge: "премиум",
    tone: "leaf",
    icon: Carrot,
    region: "Подмосковье",
  },
  {
    id: "dikiy-med",
    name: "Пасека Дикий мёд",
    blurb: "Луговой, гречишный, липовый. Бортевое пчеловодство",
    category: "мёд",
    skus: 38,
    badge: "органик",
    tone: "amber",
    icon: FlaskConical,
    region: "Башкортостан",
  },
  {
    id: "dom-syra",
    name: "Сыроварня Дом Сыра",
    blurb: "Артизанальные сыры, выдержка от 30 дней",
    category: "сыры",
    skus: 24,
    badge: "артизан",
    tone: "plum",
    icon: Milk,
    region: "Тверская обл.",
  },
  {
    id: "zelyonyi-klin",
    name: "Зелёный Клин",
    blurb: "Зелень, микрозелень, ростки. Гидропоника",
    category: "зелень",
    skus: 67,
    badge: "ЗОЖ",
    tone: "sky",
    icon: Leaf,
    region: "Москва",
  },
  {
    id: "russkoe-pole",
    name: "Русское Поле",
    blurb: "Древние сорта пшеницы, спельта, полба, мука",
    category: "зерно",
    skus: 19,
    badge: "ремесло",
    tone: "rust",
    icon: Wheat,
    region: "Тула",
  },
];

// ─── events / triggers ────────────────────────────────────────────────

export interface MockEvent {
  slug: string;
  label: string;
  type: "праздник" | "православный" | "сезон" | "тренд" | "тематика";
  date: string; // human, not parsed
  tone: "leaf" | "amber" | "plum" | "sky" | "rust";
}

export const MOCK_EVENTS: MockEvent[] = [
  { slug: "easter",       label: "Пасха",           type: "православный", date: "12.04", tone: "amber" },
  { slug: "med-spas",     label: "Медовый Спас",    type: "православный", date: "14.08", tone: "amber" },
  { slug: "fermentation", label: "Ферментация",     type: "тренд",        date: "тренд осени", tone: "plum" },
  { slug: "zozh-week",    label: "Неделя ЗОЖ",      type: "тематика",     date: "01.09–07.09", tone: "leaf" },
  { slug: "harvest",      label: "Осенний урожай",  type: "сезон",        date: "сен–окт", tone: "rust" },
  { slug: "gift-season",  label: "Подарочный сезон", type: "сезон",       date: "дек–янв", tone: "plum" },
];

export const MOCK_AUDIENCES = [
  { slug: "zozh",        label: "ЗОЖ" },
  { slug: "parents",     label: "Родители" },
  { slug: "gourmets",    label: "Гурманы" },
  { slug: "gift_buyers", label: "Подарки" },
] as const;

// ─── streaming-stage script ───────────────────────────────────────────
// Each line renders as one row in the terminal-style "AI thinking" panel.
// `ms` is how long that line "takes" — sum gives total animation length.
// `out` is the trailing checkmark text shown after the line completes.

export interface StreamStage {
  cmd: string;
  ms: number;
  out: string;
}

export const STREAM_STAGES: StreamStage[] = [
  { cmd: "analyze_catalog(skus, categories, tags)",  ms: 320,  out: "132ms · 8 категорий, 412 тегов" },
  { cmd: "match_events(farmer.region, season)",      ms: 280,  out: "84ms · 14 кандидатов" },
  { cmd: "embed_query(audience, trend) · gemini-001", ms: 520, out: "280ms · 768-d vector" },
  { cmd: "knn_search(top_k=12, dist=COSINE)",        ms: 240,  out: "41ms · из 412 SKU" },
  { cmd: "score_with_memory(ai_memory=158 signals)", ms: 320,  out: "92ms · boost +0.34" },
  { cmd: "generate_content(push, story, blog)",      ms: 720,  out: "1.84s · gemini-2.5-flash" },
  { cmd: "build_plan(kanban, roi_engine)",           ms: 220,  out: "38ms · 3 cards, ROI +37%" },
];

// ─── output deck (what reveals after streaming completes) ─────────────

export interface MockRecommendation {
  title: string;
  event: string;
  audience: string;
  reasons: string[];      // chip labels
  confidence: number;     // 0..1
  delta_orders: number;
  delta_revenue_rub: number;
  tone: "leaf" | "amber" | "plum" | "sky";
}

export const MOCK_RECS: MockRecommendation[] = [
  {
    title: "Корзина «Медовый Спас» — мёд × орехи × ягода",
    event: "Медовый Спас",
    audience: "Гурманы + Подарки",
    reasons: ["tag:honey", "season:summer-end", "trend:+18%", "mem:0.84"],
    confidence: 0.92,
    delta_orders: 142,
    delta_revenue_rub: 318_000,
    tone: "amber",
  },
  {
    title: "Ферментация недели — капуста, морковь, имбирь",
    event: "Тренд: ферментация",
    audience: "ЗОЖ",
    reasons: ["tag:fermented", "cat:vegetables", "trend:+24%"],
    confidence: 0.81,
    delta_orders: 96,
    delta_revenue_rub: 184_000,
    tone: "plum",
  },
  {
    title: "Утренний ритуал — творожные сырники с мёдом",
    event: "Recipe drop",
    audience: "Родители",
    reasons: ["recipe-bundle", "cross-farmer", "mem:0.71"],
    confidence: 0.76,
    delta_orders: 78,
    delta_revenue_rub: 142_000,
    tone: "leaf",
  },
  {
    title: "Подписка на сезон — еженедельная коробка",
    event: "Subscription nudge",
    audience: "Постоянные · ЗОЖ",
    reasons: ["repeat-cadence:14d", "ai_memory:0.68"],
    confidence: 0.69,
    delta_orders: 54,
    delta_revenue_rub: 268_000,
    tone: "sky",
  },
];

// ─── content drafts revealed in the demo ──────────────────────────────

export interface MockContentDraft {
  channel: "push" | "story" | "blog" | "social";
  title: string;
  body: string;
}

export const MOCK_CONTENT: MockContentDraft[] = [
  {
    channel: "push",
    title: "🍯 Свежий мёд приехал!",
    body: "Партия лугового мёда уже в магазине. Подписчикам — скидка 15% до пятницы.",
  },
  {
    channel: "story",
    title: "История одной банки",
    body: "С весны мы ездили по семи пасекам Башкортостана. Эта банка — со старого луга у деревни Аркаулово. Никакого сахара, только дикое разнотравье.",
  },
  {
    channel: "blog",
    title: "Как выбрать честный мёд: 5 признаков",
    body: "1. Кристаллизация — это не порок. 2. Цвет зависит от трав. 3. Лаборатория важнее, чем «дед сам качал». 4. Цена ниже 600₽/кг — повод задуматься. 5. Спросите про сезон сбора.",
  },
  {
    channel: "social",
    title: "Утро · Спас · Чай с мёдом",
    body: "Спас. Самое время заварить чай и проверить три банки разного цвета на свет. Какой ваш?",
  },
];

// ─── kanban preview ───────────────────────────────────────────────────

export interface MockPlanCard {
  column: "proposed" | "planned" | "live";
  title: string;
  due: string;          // human label like "через 4 дня"
  channels: string[];   // chip labels
  tone: "leaf" | "amber" | "plum";
}

export const MOCK_KANBAN: MockPlanCard[] = [
  { column: "live",      title: "Корзина Спаса · push + story",  due: "сегодня",   channels: ["push", "story"],          tone: "amber" },
  { column: "planned",   title: "Ферментация · блог + recipe",   due: "через 2 д.", channels: ["blog", "recipe"],         tone: "plum" },
  { column: "proposed",  title: "Подписка на сезон · email",     due: "через 5 д.", channels: ["social", "push"],         tone: "leaf" },
];

// Total streaming duration helper — lets the parent know when to flip
// from "thinking" to "reveal".
export function totalStreamMs(stages: StreamStage[] = STREAM_STAGES): number {
  return stages.reduce((s, x) => s + x.ms, 0);
}
