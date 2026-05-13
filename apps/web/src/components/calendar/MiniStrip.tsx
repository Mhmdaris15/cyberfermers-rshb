import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { eventTypeMeta, rangeContainsDate } from "@/lib/events";
import type { CalendarEvent } from "@/lib/types";

interface MiniStripProps {
  events: CalendarEvent[];
  /** Days to show from `today`. Default 21. */
  days?: number;
  /** Optional callback when a day is clicked. */
  onDayClick?: (date: Date) => void;
  toFullCalendarHref?: string;
}

// =================================================================
//  MiniStrip — a horizontal 21-day calendar lived on the Dashboard.
//  Compact glance: each day is a vertical cell, event chips collapse
//  into colored dots. Today is highlighted; clicks pass back so the
//  parent can scroll the full calendar or open a recommendation.
// =================================================================
export function MiniStrip({ events, days = 21, onDayClick, toFullCalendarHref }: MiniStripProps) {
  const cells = useMemo(() => {
    const start = startOfDay(new Date());
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [days]);

  const evsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const d of cells) {
      const key = ymd(d);
      m.set(key, events.filter((e) => rangeContainsDate(e, d)));
    }
    return m;
  }, [cells, events]);

  const today = ymd(new Date());

  return (
    <div className="glass rounded-2xl px-4 py-4 md:px-5">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="smallcaps text-[10px] text-ink-mute">Календарь</span>
          <span className="text-sm font-medium text-ink">ближайшие {days} дней</span>
        </div>
        {toFullCalendarHref && (
          <Link
            to={toFullCalendarHref}
            className="inline-flex items-center gap-1 text-xs text-ink-dim hover:text-ink focus-ring rounded"
          >
            Открыть календарь <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </header>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1.5">
          {cells.map((d, i) => {
            const key = ymd(d);
            const dayEvents = evsByDay.get(key) ?? [];
            const isToday = key === today;
            return (
              <motion.button
                key={key}
                onClick={() => onDayClick?.(d)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.015 }}
                className={cn(
                  "group relative flex h-20 w-12 shrink-0 flex-col items-center justify-between rounded-lg border border-line/70 bg-bg-elevated/60 px-1.5 py-2 transition",
                  "hover:border-leaf/40 focus-ring",
                  isToday && "border-leaf/60 bg-leaf-soft/30",
                )}
              >
                <div className="flex flex-col items-center leading-none">
                  <span className="text-[9px] uppercase tracking-widest text-ink-mute">
                    {weekdayShort(d)}
                  </span>
                  <span
                    className={cn(
                      "font-display tnum text-base font-semibold",
                      isToday ? "text-leaf" : "text-ink",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div className="flex h-3 items-end gap-0.5">
                  {dayEvents.slice(0, 4).map((ev) => {
                    const meta = eventTypeMeta[ev.type];
                    return (
                      <span
                        key={ev.id + ev.slug}
                        title={ev.title}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: ev.color ?? `hsl(var(--${meta.color}))` }}
                      />
                    );
                  })}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- helpers --------------------------------------------------------

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekdayShort(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(d);
}
