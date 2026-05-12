import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EventChip } from "./EventChip";
import { rangeContainsDate } from "@/lib/events";
import type { CalendarEvent } from "@/lib/types";

interface MonthGridProps {
  month: Date;                        // any date in the target month
  events: CalendarEvent[];
  onEventClick?: (ev: CalendarEvent) => void;
}

// MonthGrid renders the canonical 7×6 month layout with Russian week order
// (Mon..Sun). Event chips collapse gracefully when a day has > 2 events.
export function MonthGrid({ month, events, onEventClick }: MonthGridProps) {
  const cells = useMemo(() => buildCells(month), [month]);
  const today = new Date();

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-line/60 bg-bg-subtle/50 text-[11px] uppercase tracking-widest text-ink-mute">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
              <div key={d} className="px-3 py-2.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = d.toDateString() === today.toDateString();
          const dayEvents = events.filter((ev) => rangeContainsDate(ev, d));
          const visible = dayEvents.slice(0, 2);
          const overflow = dayEvents.length - visible.length;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.008 }}
              className={cn(
                "group relative min-h-[112px] border-b border-r border-line/40 p-2 transition",
                !inMonth && "opacity-40",
                isToday && "bg-leaf-soft/10",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md px-1.5 text-xs font-medium",
                    isToday ? "bg-leaf text-bg shadow-glow" : "text-ink-dim",
                  )}
                >
                  {d.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-ink-mute">{dayEvents.length}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {visible.map((ev) => (
                  <EventChip
                    key={ev.id + ev.slug}
                    ev={ev}
                    compact
                    onClick={() => onEventClick?.(ev)}
                  />
                ))}
                {overflow > 0 && (
                  <span className="text-[10px] text-ink-mute">+ ещё {overflow}</span>
                )}
              </div>
            </motion.div>
          );
        })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Build a 42-cell grid starting from the Monday of the first row.
function buildCells(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Mon=0..Sun=6
  const start = new Date(first);
  start.setDate(1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
