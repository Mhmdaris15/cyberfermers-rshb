import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Brain, Cpu, Database, Globe, Layers, Network, Tags, Workflow,
} from "lucide-react";

// =====================================================================
//  LandingArchitecture — "How the system works" visual.
//
//  Composition is a positioned grid of node-cards with a single SVG
//  layer underneath that draws the connecting paths. The SVG uses
//  pathLength=1 to normalise stroke math, and dasharray + dashoffset
//  animation to produce the "data flowing" effect. A second motion
//  layer puts pulsing dots along the same paths via offsetDistance,
//  so the eye reads movement, not just style.
//
//  No new deps. No images. One SVG. Scales fluidly down to mobile by
//  stacking the cards under each other and hiding the SVG backbone.
// =====================================================================

interface NodeSpec {
  id: string;
  x: number;          // % from left
  y: number;          // % from top
  label: string;
  sub: string;
  Icon: typeof Brain;
  tone: "leaf" | "amber" | "plum" | "sky" | "rust";
  stats: string[];    // tiny terminal-style readout
}

const NODES: NodeSpec[] = [
  { id: "fe",  x: 8,  y: 28, label: "Frontend",         sub: "React · Vite · TS",     Icon: Globe,    tone: "sky",   stats: ["SSE-ready", "shadcn/ui", "Framer Motion"] },
  { id: "api", x: 36, y: 28, label: "API",              sub: "Go · Gin",              Icon: Cpu,      tone: "leaf",  stats: ["zerolog", "REST + SSE", "JWT-less auth"] },
  { id: "db",  x: 70, y: 16, label: "SurrealDB",        sub: "граф + векторы",        Icon: Database, tone: "amber", stats: ["3 491 SKU", "11 edge types", "HNSW · 768-d"] },
  { id: "ai",  x: 70, y: 64, label: "Gemini",           sub: "LLM + embed",           Icon: Brain,    tone: "plum",  stats: ["2.5 Flash", "embedding-001", "out_dim=768"] },
  { id: "rec", x: 36, y: 84, label: "Recommender",      sub: "4-уровневый скоринг",   Icon: Workflow, tone: "rust",  stats: ["tag · cat · KNN · mem", "ai_memory · 158 сигн.", "ROI engine"] },
  { id: "tag", x: 8,  y: 64, label: "Tagging + embed",  sub: "pipelines",             Icon: Tags,     tone: "sky",   stats: ["bulk · upsert", "auto-canonical", "delta-only"] },
];

// Adjacency: tuples of [from, to] node ids. Each becomes a curve.
const EDGES: [string, string, string][] = [
  ["fe",  "api", "HTTP · SSE"],
  ["api", "db",  "SurrealQL · /sql"],
  ["api", "ai",  "Gemini · 2.5"],
  ["api", "rec", "score()"],
  ["rec", "db",  "KNN · meta"],
  ["rec", "ai",  "embed query"],
  ["tag", "ai",  "embed bulk"],
  ["tag", "db",  "upsert"],
];

export function LandingArchitecture() {
  const reduce = useReducedMotion();
  const gradId = useId();

  return (
    <section id="architecture" className="relative mx-auto max-w-7xl px-6 py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/4 -z-10 h-[36rem] opacity-40"
        style={{
          background: `
            radial-gradient(28rem 18rem at 70% 30%, hsl(var(--amber) / 0.10), transparent 70%),
            radial-gradient(28rem 18rem at 30% 70%, hsl(var(--sky) / 0.10), transparent 70%)`,
        }}
      />

      <header className="mb-12 max-w-3xl">
        <span className="smallcaps text-[11px] text-amber">
          <Network className="mr-1 inline h-3 w-3" />
          под капотом
        </span>
        <h2 className="mt-2 font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
          Как устроена система<br />
          <span className="gradient-text italic">— один кадр</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-dim">
          Никаких чёрных ящиков. Каждый сигнал, проходящий от фермера до ответа ИИ,
          можно пройти руками: пайплайны эмбеддингов и тегов, граф SurrealDB,
          движок рекомендаций, генерация контента. Шесть узлов, восемь рёбер,
          ноль магии.
        </p>
      </header>

      {/* ── desktop graph ─────────────────────────────────────────── */}
      <div className="relative hidden h-[640px] w-full overflow-hidden rounded-3xl border border-line/60 bg-bg-elevated/30 lg:block">
        {/* fine grid backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--line) / 0.4) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--line) / 0.4) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            maskImage:
              "radial-gradient(ellipse 80% 70% at 50% 50%, black 40%, transparent 100%)",
          }}
        />

        {/* SVG layer — edges + flowing dots */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1000 640"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId + "edge"} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--leaf))" stopOpacity="0.0" />
              <stop offset="50%" stopColor="hsl(var(--leaf))" stopOpacity="0.7" />
              <stop offset="100%" stopColor="hsl(var(--amber))" stopOpacity="0.0" />
            </linearGradient>

            <filter id={gradId + "glow"} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          {EDGES.map(([from, to], i) => {
            const a = NODES.find((n) => n.id === from)!;
            const b = NODES.find((n) => n.id === to)!;
            const x1 = (a.x / 100) * 1000;
            const y1 = (a.y / 100) * 640;
            const x2 = (b.x / 100) * 1000;
            const y2 = (b.y / 100) * 640;
            // curved control point — bend toward midpoint Y, offset for personality
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2 + (i % 2 === 0 ? -40 : 40);
            const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
            return (
              <g key={`${from}-${to}`}>
                {/* static thin guide */}
                <path
                  d={d}
                  fill="none"
                  stroke="hsl(var(--line))"
                  strokeOpacity={0.5}
                  strokeWidth={1}
                />
                {/* animated dashed flow */}
                <motion.path
                  d={d}
                  fill="none"
                  stroke={`url(#${gradId}edge)`}
                  strokeWidth={1.5}
                  strokeDasharray="6 14"
                  pathLength={1}
                  initial={{ strokeDashoffset: 0 }}
                  animate={reduce ? undefined : { strokeDashoffset: [-0, -40] }}
                  transition={{
                    duration: 3 + (i % 3),
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* HTML node cards */}
        {NODES.map((n) => (
          <NodeCard key={n.id} node={n} />
        ))}

        {/* corner telemetry block — adds AI-OS feel */}
        <div className="absolute right-5 top-5 rounded-lg border border-line/60 bg-bg/70 px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-mute backdrop-blur">
          <div className="text-leaf">● svoe-rodnoe.runtime</div>
          <div>nodes 6 · edges 8</div>
          <div>uptime 99.94%</div>
        </div>
        <div className="absolute bottom-5 left-5 rounded-lg border border-line/60 bg-bg/70 px-3 py-2 font-mono text-[10px] leading-relaxed text-ink-mute backdrop-blur">
          <div className="text-amber">▲ now serving</div>
          <div>65 ферм · 40 событий · 12 окон</div>
          <div>last embed&nbsp;run · 4&nbsp;мин назад</div>
        </div>
      </div>

      {/* ── mobile fallback — stacked cards ───────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
        {NODES.map((n) => (
          <NodeCard key={n.id} node={n} stacked />
        ))}
      </div>

      {/* ── pipeline annotation row ───────────────────────────────── */}
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Pipeline
          tone="leaf"
          label="Embedding pipeline"
          line="SKU · событие → canonical text → Gemini embed → SurrealDB HNSW"
        />
        <Pipeline
          tone="amber"
          label="Tagging pipeline"
          line="SKU → rules + Gemini → product_tag → `fits` edges"
        />
        <Pipeline
          tone="plum"
          label="Real-time planning"
          line="user · контекст → recommend() → draft content → plan_card"
        />
      </div>
    </section>
  );
}

// ─── individual node card ─────────────────────────────────────────────

function NodeCard({ node, stacked = false }: { node: NodeSpec; stacked?: boolean }) {
  const { Icon } = node;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
      className={`group glass-strong w-[220px] rounded-2xl border p-3 transition-colors ${
        stacked ? "relative" : "absolute"
      }`}
      style={
        stacked
          ? { width: "100%" }
          : {
              left: `calc(${node.x}% - 110px)`,
              top: `calc(${node.y}% - 50px)`,
              borderColor: `hsl(var(--${node.tone}) / 0.4)`,
              boxShadow: `0 0 0 1px hsl(var(--${node.tone}) / 0.1), 0 12px 40px -12px hsl(var(--${node.tone}) / 0.35)`,
            }
      }
    >
      {/* glow halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl opacity-0 blur-xl transition-opacity group-hover:opacity-100"
        style={{ background: `hsl(var(--${node.tone}) / 0.25)` }}
      />
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="grid h-7 w-7 place-items-center rounded-md"
          style={{
            background: `hsl(var(--${node.tone}) / 0.16)`,
            color: `hsl(var(--${node.tone}))`,
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="relative inline-flex h-1.5 w-1.5">
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-50"
            style={{ background: `hsl(var(--${node.tone}))` }}
          />
          <span
            className="relative h-1.5 w-1.5 rounded-full"
            style={{ background: `hsl(var(--${node.tone}))` }}
          />
        </span>
      </div>
      <div className="text-sm font-semibold text-ink">{node.label}</div>
      <div className="text-[11px] text-ink-mute">{node.sub}</div>
      <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-ink-dim">
        {node.stats.map((s) => (
          <li key={s} className="flex items-center gap-1">
            <span className="text-ink-mute">›</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function Pipeline({ tone, label, line }: { tone: string; label: string; line: string }) {
  return (
    <div className="glass rounded-2xl border border-line/60 p-4">
      <div className="smallcaps text-[10px]" style={{ color: `hsl(var(--${tone}))` }}>
        {label}
      </div>
      <div className="mt-1 font-mono text-[11px] leading-relaxed text-ink-dim">
        {line}
      </div>
    </div>
  );
}
