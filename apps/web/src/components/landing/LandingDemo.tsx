import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Bot, Check, ChevronRight, Cpu, Layers, Loader2, Sparkles,
  TerminalSquare, Zap,
} from "lucide-react";

import {
  MOCK_AUDIENCES, MOCK_CONTENT, MOCK_EVENTS, MOCK_FARMERS, MOCK_KANBAN,
  MOCK_RECS, STREAM_STAGES, totalStreamMs,
  type MockFarmer, type MockEvent,
} from "./demoMock";

// =====================================================================
//  LandingDemo — the centerpiece. Three stages presented as a single
//  "AI command center" surface:
//
//    [1 Фермер]  [2 Контекст]  [3 ▶ Запустить ИИ]
//
//  Stage 1: pick a farmer (5 personas). Stage 2: pick event + audience.
//  Stage 3: hit the big button. A terminal-style "ИИ думает" panel
//  streams 7 pipeline phases (each with a fake ms timing), then the
//  output deck reveals — 4 recommendation cards with confidence bars,
//  a 3-column kanban preview, a content-channel tab strip, and a
//  live-ticking ROI chip.
//
//  Nothing here calls the real API — auth-gated. The streaming script
//  + reveal is built from the seed data shapes the real system uses,
//  so the demo communicates "this is what you get" without paying the
//  Gemini cost on a public landing page.
// =====================================================================

type Stage = "pick" | "thinking" | "reveal";

export function LandingDemo() {
  const reduce = useReducedMotion();

  const [farmer, setFarmer] = useState<MockFarmer>(MOCK_FARMERS[0]);
  const [event, setEvent]   = useState<MockEvent>(MOCK_EVENTS[1]);
  const [audience, setAudience] = useState<string>(MOCK_AUDIENCES[2].slug);
  const [stage, setStage] = useState<Stage>("pick");

  // Streaming progress — which lines of the terminal have "completed"
  // and the partial text on the currently-typing line.
  const [streamIdx, setStreamIdx] = useState(-1);

  useEffect(() => {
    if (stage !== "thinking") return;
    // Reset; advance through stages one-by-one with each one's mock ms.
    let cancelled = false;
    setStreamIdx(-1);
    let acc = 0;
    STREAM_STAGES.forEach((s, i) => {
      acc += s.ms;
      window.setTimeout(() => {
        if (!cancelled) setStreamIdx(i);
      }, reduce ? 0 : acc);
    });
    window.setTimeout(() => {
      if (!cancelled) setStage("reveal");
    }, reduce ? 50 : totalStreamMs() + 240);
    return () => { cancelled = true; };
  }, [stage, reduce]);

  function startGenerate() {
    if (stage === "thinking") return;
    setStreamIdx(-1);
    setStage("thinking");
  }

  function reset() {
    setStage("pick");
    setStreamIdx(-1);
  }

  return (
    <section id="demo" className="relative mx-auto max-w-7xl px-6 py-24">
      {/* atmospheric overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 h-[40rem] opacity-50"
        style={{
          background: `
            radial-gradient(40rem 24rem at 20% 30%, hsl(var(--leaf) / 0.10), transparent 60%),
            radial-gradient(40rem 24rem at 90% 60%, hsl(var(--amber) / 0.10), transparent 60%)`,
        }}
      />

      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="smallcaps text-[11px] text-leaf">
            <Sparkles className="mr-1 inline h-3 w-3" />
            интерактивное демо
          </span>
          <h2 className="mt-2 font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
            Попробуйте прямо здесь<br className="hidden md:block" />
            <span className="gradient-text italic">— без логина</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-dim">
            Выберите ферму, контекст, нажмите «Запустить ИИ» — и&nbsp;увидите тот
            же&nbsp;поток, что&nbsp;запускают живые пользователи: 7&nbsp;стадий
            рекомендатора, готовые черновики контента и&nbsp;план кампании.
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-line bg-bg-elevated/60 px-3 py-1.5 text-[10px] text-ink-mute md:inline-flex">
          <span className="relative h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-leaf opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-leaf" />
          </span>
          <span className="smallcaps">command center · live</span>
        </div>
      </header>

      {/* ── Stage 1 + 2 — picker ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1.05fr_minmax(0,1fr)]">
        {/* Farmer column */}
        <Panel title="01 · Выберите ферму" icon={<Layers className="h-3 w-3" />}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {MOCK_FARMERS.map((f) => (
              <FarmerTile
                key={f.id}
                farmer={f}
                active={f.id === farmer.id}
                onPick={() => setFarmer(f)}
              />
            ))}
          </div>
        </Panel>

        {/* Context column */}
        <Panel title="02 · Контекст" icon={<Zap className="h-3 w-3" />}>
          <div className="space-y-4">
            <div>
              <div className="smallcaps mb-1.5 text-[10px] text-ink-mute">событие или тренд</div>
              <div className="flex flex-wrap gap-1.5">
                {MOCK_EVENTS.map((e) => (
                  <button
                    key={e.slug}
                    onClick={() => setEvent(e)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      e.slug === event.slug
                        ? `border-${e.tone}/60 bg-${e.tone}/10 text-${e.tone}`
                        : "border-line bg-bg-elevated/60 text-ink-dim hover:bg-bg-subtle"
                    }`}
                  >
                    {e.label}
                    <span className="text-ink-mute">·</span>
                    <span className="font-mono tabular-nums">{e.date}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="smallcaps mb-1.5 text-[10px] text-ink-mute">аудитория</div>
              <div className="flex flex-wrap gap-1.5">
                {MOCK_AUDIENCES.map((a) => (
                  <button
                    key={a.slug}
                    onClick={() => setAudience(a.slug)}
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      a.slug === audience
                        ? "border-plum/60 bg-plum/10 text-plum"
                        : "border-line bg-bg-elevated/60 text-ink-dim hover:bg-bg-subtle"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-line/60 bg-bg-subtle/40 px-3 py-2 text-[11px] leading-relaxed text-ink-mute">
              <span className="smallcaps text-leaf">контекст · </span>
              {farmer.name} · {farmer.region} · {farmer.skus}&nbsp;SKU ·{" "}
              событие&nbsp;«{event.label}» · аудитория{" "}
              {MOCK_AUDIENCES.find((a) => a.slug === audience)?.label}
            </div>

            <button
              type="button"
              onClick={startGenerate}
              disabled={stage === "thinking"}
              className="group relative inline-flex w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 py-3 text-sm font-semibold text-bg shadow-glow transition-all hover:brightness-110 disabled:cursor-progress disabled:opacity-60 focus-ring"
            >
              {stage === "thinking" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  ИИ обрабатывает…
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4" />
                  Запустить ИИ
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
        </Panel>
      </div>

      {/* ── Stage 3 — streaming terminal + reveal ─────────────────── */}
      <AnimatePresence mode="wait">
        {stage === "thinking" && (
          <motion.div
            key="thinking"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
            className="mt-6"
          >
            <ThinkingPanel streamIdx={streamIdx} />
          </motion.div>
        )}

        {stage === "reveal" && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            className="mt-6 space-y-6"
          >
            <RevealHeader onReset={reset} />
            <div className="grid gap-6 lg:grid-cols-[1.6fr_minmax(0,1fr)]">
              <RecommendationsDeck />
              <RoiAndKanban />
            </div>
            <ContentDeck />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── building blocks ─────────────────────────────────────────────────

function Panel({
  title, icon, children,
}: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-strong overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-line/60 bg-bg-subtle/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ink-mute">
          {icon}
          {title}
        </div>
        <span className="font-mono text-[10px] text-ink-mute">●●●</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FarmerTile({
  farmer, active, onPick,
}: { farmer: MockFarmer; active: boolean; onPick: () => void }) {
  const Icon = farmer.icon;
  return (
    <motion.button
      type="button"
      onClick={onPick}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className={`group relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all focus-ring ${
        active
          ? `border-${farmer.tone}/60 bg-${farmer.tone}/10 shadow-glow`
          : "border-line bg-bg-elevated/40 hover:border-ink-mute/40 hover:bg-bg-subtle"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`grid h-7 w-7 place-items-center rounded-md ${
            active ? `bg-${farmer.tone}/20 text-${farmer.tone}` : "bg-bg-subtle text-ink-mute"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-mute">
          {farmer.category}
        </span>
      </div>
      <h3 className="line-clamp-1 text-sm font-semibold text-ink">{farmer.name}</h3>
      <p className="line-clamp-2 text-[11px] leading-snug text-ink-dim">{farmer.blurb}</p>
      <div className="mt-1 flex items-center justify-between text-[10px] text-ink-mute">
        <span className="font-mono tabular-nums">{farmer.skus} SKU</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
          active ? `bg-${farmer.tone}/20 text-${farmer.tone}` : "bg-bg-subtle text-ink-mute"
        }`}>
          {farmer.badge}
        </span>
      </div>
      {active && (
        <motion.span
          layoutId="farmer-pick-pin"
          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-leaf shadow-glow"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
    </motion.button>
  );
}

// ─── thinking panel — terminal-style streaming ────────────────────────

function ThinkingPanel({ streamIdx }: { streamIdx: number }) {
  return (
    <div className="glass-strong relative overflow-hidden rounded-2xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `linear-gradient(180deg, hsl(var(--leaf) / 0.05), transparent 60%)`,
        }}
      />
      <div className="flex items-center justify-between border-b border-line/60 bg-bg-subtle/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-leaf">
          <TerminalSquare className="h-3 w-3" />
          ии · pipeline · live
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-ink-mute">
          <span className="relative h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-amber" />
          </span>
          <span className="font-mono">running</span>
        </div>
      </div>
      <div className="space-y-1 px-4 py-4 font-mono text-[12px] leading-relaxed">
        {STREAM_STAGES.map((s, i) => {
          const done = i <= streamIdx;
          const current = i === streamIdx + 1;
          if (!done && !current) return (
            <div key={i} className="text-ink-mute/30">
              <span>$ </span>
              <span>{s.cmd}</span>
              <span className="text-ink-mute/20"> · ожидание</span>
            </div>
          );
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18 }}
              className={done ? "text-ink-dim" : "text-leaf"}
            >
              <span className="text-leaf">$ </span>
              <span>{s.cmd}</span>
              {done ? (
                <span className="ml-2 inline-flex items-center gap-1 text-leaf">
                  <Check className="h-3 w-3" />
                  <span className="text-ink-mute">{s.out}</span>
                </span>
              ) : (
                <span className="ml-2 inline-flex items-center gap-1 text-amber">
                  <Cpu className="h-3 w-3 animate-pulse" />
                  <span className="text-ink-mute">обработка…</span>
                  <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-leaf" aria-hidden />
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── reveal — header banner ───────────────────────────────────────────

function RevealHeader({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-leaf/40 bg-leaf/5 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-ink">
        <Check className="h-4 w-4 text-leaf" />
        <span className="font-medium">Готово.</span>
        <span className="text-ink-dim">
          4&nbsp;рекомендации · 4&nbsp;черновика контента · 3&nbsp;карточки в&nbsp;плане
        </span>
      </div>
      <button
        onClick={onReset}
        className="text-xs text-ink-mute transition-colors hover:text-ink"
      >
        ↺ запустить ещё раз
      </button>
    </div>
  );
}

// ─── reveal — recommendations deck ────────────────────────────────────

function RecommendationsDeck() {
  return (
    <div className="glass-strong overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-line/60 bg-bg-subtle/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ink-mute">
          <Sparkles className="h-3 w-3" />
          рекомендации · ranked
        </div>
        <span className="font-mono text-[10px] text-ink-mute">
          {MOCK_RECS.length} результата
        </span>
      </div>
      <ul className="divide-y divide-line/40">
        {MOCK_RECS.map((r, i) => (
          <motion.li
            key={r.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.05 + i * 0.05 }}
            className="px-4 py-3.5"
          >
            <div className="flex items-start gap-3">
              <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md bg-${r.tone}/15 text-${r.tone} font-mono text-[10px]`}>
                #{i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-ink">{r.title}</h4>
                <div className="mt-0.5 flex items-baseline gap-2 text-[11px] text-ink-mute">
                  <span>{r.event}</span>
                  <span>·</span>
                  <span>{r.audience}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {r.reasons.map((c) => (
                    <span
                      key={c}
                      className="rounded border border-line bg-bg-elevated/60 px-1.5 py-0 font-mono text-[10px] text-ink-mute"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <ConfidenceBar value={r.confidence} tone={r.tone} />
                <div className="mt-1 text-[10px] text-amber">
                  +{r.delta_orders} зак. · +{Math.round(r.delta_revenue_rub / 1000)}k₽
                </div>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function ConfidenceBar({ value, tone }: { value: number; tone: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="font-mono text-[10px] tabular-nums text-ink-dim">
        {pct}%
      </span>
      <div className="relative h-1 w-16 overflow-hidden rounded-full bg-bg-elevated">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.2, 0.65, 0.2, 1] }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: `hsl(var(--${tone}))` }}
        />
      </div>
    </div>
  );
}

// ─── reveal — ROI + Kanban preview ────────────────────────────────────

function RoiAndKanban() {
  // Animate the ROI delta counter from 0 to its target.
  const [roi, setRoi] = useState(0);
  const target = 37;
  useEffect(() => {
    let start: number | null = null;
    const dur = 1200;
    function step(t: number) {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / dur);
      setRoi(Math.round(p * target));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, []);

  return (
    <div className="space-y-4">
      {/* ROI tile */}
      <div className="glass-strong relative overflow-hidden rounded-2xl p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber/25 blur-3xl"
        />
        <div className="smallcaps text-[10px] text-amber">
          прогноз · 30 дней
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-5xl font-semibold tabular-nums text-ink">
            +{roi}%
          </span>
          <span className="text-sm text-ink-mute">к&nbsp;выручке</span>
        </div>
        <div className="mt-2 text-xs leading-relaxed text-ink-dim">
          Детерминированная формула. Без скрытых коэффициентов.{" "}
          <span className="text-leaf">+370&nbsp;заказов</span>,{" "}
          <span className="text-amber">+912&nbsp;000&nbsp;₽</span>.
        </div>
      </div>

      {/* Mini kanban */}
      <div className="glass-strong overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-line/60 bg-bg-subtle/60 px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ink-mute">
            <Layers className="h-3 w-3" />
            план · превью
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-line/40">
          {(["proposed", "planned", "live"] as const).map((col) => {
            const cards = MOCK_KANBAN.filter((c) => c.column === col);
            return (
              <div key={col} className="bg-bg-elevated p-2 text-[11px]">
                <div className={`mb-1.5 smallcaps text-[9px] ${
                  col === "live" ? "text-amber" : col === "planned" ? "text-leaf" : "text-ink-mute"
                }`}>
                  {col === "proposed" ? "идея" : col === "planned" ? "запланир." : "в эфире"}
                </div>
                {cards.map((c, i) => (
                  <motion.div
                    key={c.title}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.05 }}
                    className={`mb-1.5 rounded-md border bg-bg-subtle/60 p-2 ${
                      c.tone === "amber" ? "border-amber/40" : c.tone === "plum" ? "border-plum/40" : "border-leaf/40"
                    }`}
                  >
                    <div className="line-clamp-2 text-[11px] leading-snug text-ink">
                      {c.title}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[9px] text-ink-mute">
                      <span>{c.due}</span>
                      <span className="font-mono">{c.channels.join(" · ")}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── reveal — content channel tabs ────────────────────────────────────

function ContentDeck() {
  const [active, setActive] = useState<typeof MOCK_CONTENT[number]["channel"]>("push");
  const draft = useMemo(
    () => MOCK_CONTENT.find((d) => d.channel === active) ?? MOCK_CONTENT[0],
    [active],
  );
  return (
    <div className="glass-strong overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-line/60 bg-bg-subtle/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ink-mute">
          <Sparkles className="h-3 w-3" />
          контент · мультиканально
        </div>
        <div className="flex gap-1">
          {MOCK_CONTENT.map((c) => (
            <button
              key={c.channel}
              onClick={() => setActive(c.channel)}
              className={`rounded px-2.5 py-1 text-[11px] uppercase tracking-widest transition-colors ${
                active === c.channel
                  ? "bg-leaf/15 text-leaf"
                  : "text-ink-mute hover:bg-bg-subtle hover:text-ink"
              }`}
            >
              {c.channel}
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="grid gap-px bg-line/40 md:grid-cols-[1.4fr_minmax(0,1fr)]"
        >
          {/* the AI-drafted text */}
          <div className="bg-bg-elevated px-5 py-4">
            <h4 className="font-display text-lg font-semibold leading-tight">
              {draft.title}
            </h4>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-dim">
              {draft.body}
            </p>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-ink-mute">
              <span className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono">
                gemini-2.5-flash
              </span>
              <span>·</span>
              <span>prompt v3</span>
              <span>·</span>
              <span>847&nbsp;токенов</span>
              <span className="ml-auto inline-flex items-center gap-1 text-leaf">
                <Check className="h-3 w-3" />
                сохранён как draft
              </span>
            </div>
          </div>

          {/* render hints sidebar — what the channel actually does */}
          <div className="bg-bg-subtle/60 px-5 py-4 text-[11px] leading-relaxed text-ink-mute">
            <div className="smallcaps mb-2 text-[10px] text-leaf">
              как это публикуется
            </div>
            <p>{channelHint(draft.channel)}</p>
            <div className="mt-3 inline-flex items-center gap-1 text-ink-dim">
              <ChevronRight className="h-3 w-3" />
              редактируется в&nbsp;продуктовой панели
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function channelHint(channel: string): string {
  switch (channel) {
    case "push":
      return "Уходит как push-уведомление подписчикам. ИИ соблюдает лимит iOS 178 символов в теле и предлагает emoji-префикс.";
    case "story":
      return "Эмоциональный текст для сторис/блога. Магазинная вёрстка с буквицей и обложкой в&nbsp;превью.";
    case "blog":
      return "Длинный читательский формат с подзаголовком и SEO-полями. Расчёт времени чтения встроен.";
    case "social":
      return "Версии для Instagram / Telegram / VK с автоматической проверкой лимитов символов на платформу.";
  }
  return "";
}
