import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cpu, Layers3, Calendar, Sparkles, LineChart, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// =================================================================
//   AiBootSequence — cinematic intro shown ONCE per session per
//   farmer. Five staged messages that map 1:1 onto the actual
//   pipeline running in the background:
//
//     1. catalog ETL  →  "Analyzing catalog…"
//     2. tagging      →  "Detecting product DNA…"
//     3. events KB    →  "Matching seasonal events…"
//     4. content gen  →  "Drafting campaign ideas…"
//     5. ROI engine   →  "Predicting business impact…"
//
//   The component does *not* gate dashboard data fetches; the queries
//   start in parallel. The sequence is purely UX theatre — but it's
//   the theatre that makes the system *feel* intelligent.
// =================================================================

interface AiBootSequenceProps {
  farmerId: string;
  /** When true, sequence runs immediately. */
  visible: boolean;
  /** Fires after the last step + the configured `holdMs`. */
  onDone: () => void;
  /** Total ms each step lingers on screen. Default 700. */
  stepMs?: number;
  /** Extra ms held on the final "ready" frame before onDone. Default 350. */
  holdMs?: number;
}

const steps = [
  { Icon: Layers3,   label: "Анализируем каталог",         hint: "65 фермеров · 3 491 SKU" },
  { Icon: Cpu,       label: "Распознаём ДНК продуктов",    hint: "теги, категории, премиум-сигналы" },
  { Icon: Calendar,  label: "Сопоставляем сезонные события", hint: "40+ событий в базе знаний" },
  { Icon: Sparkles,  label: "Готовим черновики кампаний",  hint: "push · story · blog · recipe · chat" },
  { Icon: LineChart, label: "Прогнозируем бизнес-импакт",   hint: "ROI-движок, явные допущения" },
] as const;

export function AiBootSequence({
  farmerId,
  visible,
  onDone,
  stepMs = 700,
  holdMs = 350,
}: AiBootSequenceProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setActive(0);
    const timers: number[] = [];
    for (let i = 1; i < steps.length; i++) {
      timers.push(window.setTimeout(() => setActive(i), i * stepMs));
    }
    timers.push(
      window.setTimeout(() => onDone(), steps.length * stepMs + holdMs),
    );
    return () => timers.forEach(clearTimeout);
  }, [visible, stepMs, holdMs, onDone]);

  const progress = ((active + 1) / steps.length) * 100;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-bg"
          role="status"
          aria-live="polite"
        >
          {/* atmosphere */}
          <div
            aria-hidden
            className="absolute inset-0 grid-bg [mask-image:radial-gradient(60rem_30rem_at_50%_50%,#000_30%,transparent_75%)]"
          />
          <div aria-hidden className="grain absolute inset-0 opacity-30" />

          {/* breathing leaf */}
          <motion.div
            aria-hidden
            initial={{ scale: 0.9 }}
            animate={{ scale: [0.9, 1.04, 0.9] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute h-[42rem] w-[42rem] rounded-full bg-gradient-to-tr from-leaf/15 via-amber/10 to-plum/10 blur-3xl"
          />

          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-8 px-6 text-center">
            <div className="smallcaps text-[11px] text-ink-mute">
              AI marketing assistant · org#{farmerId}
            </div>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              <span className="ink-gradient">Готовим ваш кабинет</span>
            </h2>

            <ol className="mt-4 flex w-full flex-col gap-3">
              {steps.map(({ Icon, label, hint }, i) => {
                const state =
                  i < active ? "done" : i === active ? "live" : "pending";
                return (
                  <motion.li
                    key={label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={cn(
                      "glass flex items-center gap-3 rounded-xl border px-4 py-3 text-left",
                      state === "done" && "border-leaf/40",
                      state === "live" && "border-amber/50 shadow-amber",
                      state === "pending" && "border-line opacity-50",
                    )}
                  >
                    <div
                      className={cn(
                        "relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                        state === "done" && "border-leaf/50 bg-leaf-soft/30 text-leaf",
                        state === "live" && "border-amber/60 bg-amber-soft/40 text-amber",
                        state === "pending" && "border-line bg-bg-elevated text-ink-mute",
                      )}
                    >
                      {state === "done" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                      {state === "live" && (
                        <motion.span
                          aria-hidden
                          initial={{ scale: 1, opacity: 0.7 }}
                          animate={{ scale: 1.6, opacity: 0 }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          className="absolute inset-0 rounded-lg border border-amber"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {label}
                        {state === "live" && (
                          <span className="ml-1 text-amber">…</span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-mute">{hint}</div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>

            {/* progress bar */}
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 22 }}
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-leaf via-amber to-plum"
              />
            </div>
            <button
              onClick={onDone}
              className="text-xs text-ink-mute underline-offset-4 hover:text-ink hover:underline focus-ring"
            >
              Пропустить
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- session-scoped "seen" tracking --------------------------------

const KEY = "ai-boot-seen";

export function useAiBootGate(farmerId: string) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = JSON.parse(sessionStorage.getItem(KEY) || "{}");
      if (!seen[farmerId]) {
        setVisible(true);
      }
    } catch {
      // sessionStorage unavailable — skip the intro.
    }
  }, [farmerId]);

  const dismiss = () => {
    setVisible(false);
    try {
      const seen = JSON.parse(sessionStorage.getItem(KEY) || "{}");
      seen[farmerId] = Date.now();
      sessionStorage.setItem(KEY, JSON.stringify(seen));
    } catch {
      /* noop */
    }
  };

  return { visible, dismiss };
}
