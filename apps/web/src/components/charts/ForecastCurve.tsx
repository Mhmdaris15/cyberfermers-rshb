import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { eventTypeMeta } from "@/lib/events";
import { formatRUB } from "@/lib/utils";
import type { Suggestion } from "@/lib/types";

interface ForecastCurveProps {
  suggestions: Suggestion[];
  /** Days to project forward from `today`. Default 60. */
  horizonDays?: number;
}

// =================================================================
//  ForecastCurve — cumulative predicted Δrevenue across the next
//  N days. Hand-rolled SVG; no chart library. Each suggestion's
//  date_window_start becomes a "step" — between events we draw a
//  flat line, on event days we add a vertical impulse.
//
//  Goals:
//    – read like an "AI revenue trajectory" in <3 seconds
//    – every spike narratable ("on May 18 Easter peak adds +X ₽")
// =================================================================
export function ForecastCurve({ suggestions, horizonDays = 60 }: ForecastCurveProps) {
  // 1. Normalise: each suggestion contributes its revenue_delta on its
  //    `date_window_start` (the prep-window opening, not the event peak).
  //    Cumulative sum becomes the cumulative-revenue curve.
  const points = useMemo(() => {
    const today = startOfDay(new Date());
    const horizon = new Date(today);
    horizon.setDate(today.getDate() + horizonDays);

    const byDay = new Map<number, Suggestion[]>();
    for (const s of suggestions) {
      const d = new Date(s.date_window_start);
      if (d < today || d > horizon) continue;
      const key = daysBetween(today, d);
      const arr = byDay.get(key) ?? [];
      arr.push(s);
      byDay.set(key, arr);
    }

    let acc = 0;
    const series: ForecastPoint[] = [];
    for (let i = 0; i <= horizonDays; i++) {
      const todays = byDay.get(i) ?? [];
      const delta = todays.reduce((n, x) => n + x.predicted_lift.revenue_delta, 0);
      acc += delta;
      series.push({
        day: i,
        date: addDays(today, i),
        delta,
        cumulative: acc,
        events: todays,
      });
    }
    return series;
  }, [suggestions, horizonDays]);

  const max = points.at(-1)?.cumulative ?? 0;
  const [hover, setHover] = useState<number | null>(null);

  // SVG geometry
  const w = 720;
  const h = 220;
  const pl = 12;
  const pr = 12;
  const pt = 16;
  const pb = 24;
  const innerW = w - pl - pr;
  const innerH = h - pt - pb;
  const xFor = (day: number) => pl + (day / horizonDays) * innerW;
  const yFor = (val: number) => pt + innerH - (max > 0 ? (val / max) * innerH : 0);

  // Build a stepped curve path (cumulative).
  const path = useMemo(() => {
    if (points.length === 0) return "";
    let d = `M ${xFor(0)} ${yFor(points[0].cumulative)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${xFor(points[i].day)} ${yFor(points[i].cumulative)}`;
    }
    return d;
  }, [points, max]);

  const areaPath = path ? `${path} L ${xFor(horizonDays)} ${yFor(0)} L ${xFor(0)} ${yFor(0)} Z` : "";
  const todayPoint = points[hover ?? 0];

  return (
    <div className="glass relative overflow-hidden rounded-2xl px-4 py-5 md:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="smallcaps text-[10px] text-leaf">AI forecast</span>
          <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">
            Кумулятивный прогноз на {horizonDays} дней
          </h3>
        </div>
        <div className="text-right">
          <div className="font-display tnum text-3xl font-semibold leading-none text-amber">
            +{formatRUB(max)}
          </div>
          <div className="smallcaps mt-1 text-[10px] text-ink-mute">
            при запуске всех {points.reduce((n, p) => n + p.events.length, 0)} кампаний
          </div>
        </div>
      </header>

      <div className="relative">
        <svg
          width="100%"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="select-none"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="forecast-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="hsl(var(--leaf))" stopOpacity={0.35} />
              <stop offset="1" stopColor="hsl(var(--leaf))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="forecast-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="hsl(var(--leaf))" />
              <stop offset="1" stopColor="hsl(var(--amber))" />
            </linearGradient>
          </defs>

          {/* baseline grid */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={pl}
              x2={w - pr}
              y1={pt + innerH * (1 - t)}
              y2={pt + innerH * (1 - t)}
              stroke="hsl(var(--line))"
              strokeDasharray="2 4"
              strokeOpacity={0.5}
            />
          ))}

          {/* area + line */}
          <motion.path
            d={areaPath}
            fill="url(#forecast-area)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          />
          <motion.path
            d={path}
            fill="none"
            stroke="url(#forecast-line)"
            strokeWidth={2}
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: [0.2, 0.65, 0.2, 1] }}
          />

          {/* event impulses */}
          {points
            .filter((p) => p.events.length > 0)
            .map((p) => {
              const top = p.events[0];
              const meta = top.event ? eventTypeMeta[top.event.type] : null;
              return (
                <g key={p.day} transform={`translate(${xFor(p.day)} 0)`}>
                  <line
                    x1={0}
                    x2={0}
                    y1={pt + innerH}
                    y2={yFor(p.cumulative)}
                    stroke={top.event?.color ?? `hsl(var(--${meta?.color ?? "leaf"}))`}
                    strokeOpacity={0.45}
                    strokeWidth={1.2}
                  />
                  <circle
                    cx={0}
                    cy={yFor(p.cumulative)}
                    r={hover === p.day ? 6 : 4}
                    fill="hsl(var(--bg))"
                    stroke={top.event?.color ?? `hsl(var(--${meta?.color ?? "leaf"}))`}
                    strokeWidth={2}
                  />
                </g>
              );
            })}

          {/* invisible hit rects for hover */}
          {points.map((p) => (
            <rect
              key={p.day}
              x={xFor(p.day) - innerW / horizonDays / 2}
              y={pt}
              width={innerW / horizonDays}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(p.day)}
            />
          ))}

          {/* x-axis labels */}
          {[0, Math.floor(horizonDays / 2), horizonDays].map((d) => (
            <text
              key={d}
              x={xFor(d)}
              y={h - 6}
              textAnchor={d === 0 ? "start" : d === horizonDays ? "end" : "middle"}
              fill="hsl(var(--ink-mute))"
              fontSize={10}
            >
              {labelFor(addDays(new Date(), d))}
            </text>
          ))}
        </svg>

        {/* tooltip */}
        {todayPoint && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-bg-elevated px-3 py-2 text-xs shadow-glass"
            style={{
              left: `${(xFor(todayPoint.day) / w) * 100}%`,
              top: 4,
            }}
          >
            <div className="smallcaps text-[9px] text-ink-mute">{labelFor(todayPoint.date)}</div>
            <div className="font-mono tnum text-sm text-ink">
              +{formatRUB(todayPoint.cumulative)}
            </div>
            {todayPoint.events.length > 0 && (
              <div className="mt-1 text-[10px] text-ink-dim">
                {todayPoint.events.map((e) => e.event?.title).filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- helpers --------------------------------------------------------

interface ForecastPoint {
  day: number;
  date: Date;
  delta: number;
  cumulative: number;
  events: Suggestion[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function daysBetween(a: Date, b: Date): number {
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}
function labelFor(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(d);
}
