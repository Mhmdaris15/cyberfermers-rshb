import type { CalendarEvent, EventType } from "./types";

// Visual token mapping per event type. Keeps the calendar visually coherent
// without per-event color guessing on the FE.
export const eventTypeMeta: Record<EventType, { label: string; color: string; soft: string; glow: string }> = {
  holiday:      { label: "Праздник",            color: "amber",  soft: "amber-soft",  glow: "shadow-amber" },
  season:       { label: "Сезон",               color: "leaf",   soft: "leaf-soft",   glow: "shadow-glow" },
  themed_week:  { label: "Тематическая неделя", color: "plum",   soft: "plum-soft",   glow: "" },
  trend:        { label: "Тренд",               color: "sky",    soft: "sky-soft",    glow: "" },
  professional: { label: "Профессиональный день", color: "rust", soft: "rust-soft",   glow: "" },
};

export function eventBadgeClasses(t: EventType): string {
  const m = eventTypeMeta[t];
  return `bg-${m.soft}/40 text-${m.color} border border-${m.color}/30`;
}

export function rangeContainsDate(ev: CalendarEvent, day: Date): boolean {
  const d = day.getTime();
  return new Date(ev.start_date).getTime() <= d && new Date(ev.end_date).getTime() >= d;
}
