import { motion } from "framer-motion";
import { Flame, Sparkles } from "lucide-react";
import { plural, formatInt, formatRUB } from "@/lib/utils";
import type { Suggestion } from "@/lib/types";

interface ExecutiveSummaryProps {
  suggestions: Suggestion[];
  /** Window over which `hot` is computed, in days. Default 14. */
  windowDays?: number;
}

// =================================================================
//  ExecutiveSummary — the "AI CMO" headline. Reads the calendar
//  response and surfaces a single proactive sentence + breakdown
//  chips. This is the dashboard's first paint after the boot
//  sequence dismisses — it must communicate value in <2 seconds.
// =================================================================
export function ExecutiveSummary({ suggestions, windowDays = 14 }: ExecutiveSummaryProps) {
  const now = Date.now();
  const horizon = now + windowDays * 86_400_000;

  const inWindow = suggestions.filter((s) => {
    const start = new Date(s.event?.start_date ?? s.date_window_start).getTime();
    return start <= horizon;
  });

  // "Hot" = predicted Δorders ≥ 2 within the window. Tunable, kept simple.
  const hot = inWindow.filter((s) => s.predicted_lift.orders_delta >= 2);
  const ordersTotal = inWindow.reduce((acc, s) => acc + s.predicted_lift.orders_delta, 0);
  const revenueTotal = inWindow.reduce((acc, s) => acc + s.predicted_lift.revenue_delta, 0);

  // Top 3 by Δorders for the chip strip.
  const top3 = [...hot]
    .sort((a, b) => b.predicted_lift.orders_delta - a.predicted_lift.orders_delta)
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.65, 0.2, 1] }}
      className="glass relative overflow-hidden rounded-2xl px-6 py-6 md:px-8 md:py-7"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-leaf/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full bg-amber/15 blur-3xl"
      />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-center gap-2 smallcaps text-[10px] text-leaf">
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI-summary</span>
        </div>

        {hot.length === 0 ? (
          <p className="font-display text-2xl font-medium leading-tight text-ink md:text-3xl">
            В ближайшие {formatInt(windowDays)} дней{" "}
            <span className="text-ink-mute">горячих событий не найдено.</span>
          </p>
        ) : (
          <p className="font-display text-2xl font-medium leading-tight md:text-3xl">
            У вас{" "}
            <span className="gradient-text font-semibold tnum">{formatInt(hot.length)}</span>{" "}
            высокопотенциальных{" "}
            {plural(hot.length, ["событие", "события", "событий"])} в&nbsp;ближайшие{" "}
            <span className="tnum">{windowDays}</span> дней. Совокупный прогноз:{" "}
            <span className="ink-gradient font-semibold tnum">+{formatInt(ordersTotal)}</span>{" "}
            {plural(ordersTotal, ["заказ", "заказа", "заказов"])} и{" "}
            <span className="ink-gradient font-semibold tnum">+{formatRUB(revenueTotal)}</span>.
          </p>
        )}

        {top3.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {top3.map((s) => {
              const days = Math.max(
                0,
                Math.round(
                  (new Date(s.event?.start_date ?? s.date_window_start).getTime() - now) / 86_400_000,
                ),
              );
              const urgent = days <= 7;
              return (
                <div
                  key={`${s.event_id}-${s.date_window_start}`}
                  className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                    urgent
                      ? "border-amber/40 bg-amber-soft/30 text-amber"
                      : "border-line bg-bg-elevated/60 text-ink-dim"
                  }`}
                >
                  {urgent && <Flame className="h-3 w-3" aria-hidden />}
                  <span className="truncate max-w-[14rem]">{s.event?.title}</span>
                  <span className="font-mono tnum opacity-70">
                    +{formatInt(s.predicted_lift.orders_delta)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
