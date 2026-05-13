import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { CalendarEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategoryHeatmapProps {
  /** Events covering at least the next 12 months. */
  events: CalendarEvent[];
  /** Farmer's categories — heatmap rows. */
  categories: string[];
  /** Optional click handler for a (category, monthIndex) cell. */
  onCellClick?: (category: string, month: number) => void;
}

// =================================================================
//  CategoryHeatmap — 12-month × farmer's top categories grid.
//  Each cell encodes the number of events in our KB whose category
//  list contains that category AND whose date window covers that
//  month. Colour intensity ramps with the cell count.
//
//  Custom SVG (no chart lib). Distinctive visual that ties the
//  farmer's catalog to the seasonal calendar at a glance.
// =================================================================
export function CategoryHeatmap({ events, categories, onCellClick }: CategoryHeatmapProps) {
  // top 6 categories keep the grid readable on mobile
  const rows = useMemo(() => categories.slice(0, 6), [categories]);

  // Pre-compute month coverage per event
  const grid = useMemo(() => {
    const m: Record<string, number[]> = {};
    for (const cat of rows) m[cat] = new Array(12).fill(0);
    for (const ev of events) {
      if (!ev.categories) continue;
      const start = new Date(ev.start_date);
      const end = new Date(ev.end_date);
      const startMonth = start.getMonth();
      const endMonth = end.getMonth();
      // Walk months from startMonth..endMonth, wrapping at year-end.
      let cur = startMonth;
      const guard = new Set<number>();
      while (!guard.has(cur)) {
        guard.add(cur);
        for (const c of ev.categories) {
          if (m[c]) m[c][cur]++;
        }
        if (cur === endMonth) break;
        cur = (cur + 1) % 12;
        if (guard.size > 12) break; // safety
      }
    }
    return m;
  }, [events, rows]);

  // Find max cell to drive colour intensity.
  const maxCell = useMemo(() => {
    let mx = 0;
    for (const r of rows) for (const v of grid[r] ?? []) mx = Math.max(mx, v);
    return mx || 1;
  }, [rows, grid]);

  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const today = new Date().getMonth();

  const [hover, setHover] = useState<{ cat: string; m: number; n: number } | null>(null);

  if (rows.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-4 md:p-5">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <span className="smallcaps text-[10px] text-leaf">heatmap</span>
          <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">
            Сезонность ваших категорий
          </h3>
          <p className="mt-0.5 text-xs text-ink-dim">
            Когда событийный календарь наиболее активно затрагивает каждую из ваших категорий.
          </p>
        </div>
        <Legend />
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Header row: months */}
          <div className="grid grid-cols-[160px_repeat(12,1fr)] gap-1.5 pb-2 text-[10px] uppercase tracking-widest text-ink-mute">
            <div />
            {months.map((m, i) => (
              <div
                key={m}
                className={cn("text-center", i === today && "text-leaf font-semibold")}
              >
                {m}
              </div>
            ))}
          </div>
          {/* Body */}
          {rows.map((cat, rIdx) => (
            <motion.div
              key={cat}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: rIdx * 0.05 }}
              className="grid grid-cols-[160px_repeat(12,1fr)] items-center gap-1.5 py-1"
            >
              <div className="truncate pr-2 text-sm text-ink" title={cat}>
                {cat}
              </div>
              {(grid[cat] ?? []).map((n, i) => {
                const intensity = n / maxCell;
                const isToday = i === today;
                return (
                  <button
                    key={i}
                    onClick={() => onCellClick?.(cat, i)}
                    onMouseEnter={() => setHover({ cat, m: i, n })}
                    onMouseLeave={() => setHover(null)}
                    className={cn(
                      "relative h-8 rounded-md border transition focus-ring",
                      isToday ? "border-leaf/60" : "border-line/50",
                    )}
                    style={{
                      background: n
                        ? `hsl(var(--leaf) / ${0.15 + intensity * 0.5})`
                        : "hsl(var(--bg-elevated) / 0.6)",
                    }}
                    aria-label={`${cat} · ${months[i]}: ${n}`}
                  >
                    {n > 0 && (
                      <span
                        className="absolute inset-0 grid place-items-center font-mono text-[10px] tnum"
                        style={{ color: intensity > 0.55 ? "hsl(var(--bg))" : "hsl(var(--ink))" }}
                      >
                        {n}
                      </span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          ))}
        </div>
      </div>

      {hover && (
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-dim">
          <span className="smallcaps text-[10px] text-ink-mute">фокус</span>
          <span className="text-ink">{hover.cat}</span>
          <span className="opacity-50">·</span>
          <span>{months[hover.m]}</span>
          <span className="opacity-50">·</span>
          <span className="font-mono tnum text-leaf">{hover.n} событий</span>
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-ink-mute">
      <span>меньше</span>
      <div className="flex h-3 overflow-hidden rounded-sm border border-line">
        {[0.15, 0.3, 0.45, 0.6, 0.75].map((a) => (
          <div
            key={a}
            className="h-3 w-3"
            style={{ background: `hsl(var(--leaf) / ${a})` }}
          />
        ))}
      </div>
      <span>больше</span>
    </div>
  );
}
