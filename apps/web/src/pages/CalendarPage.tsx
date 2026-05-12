import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCalendar } from "@/lib/api";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { MonthSwitcher } from "@/components/calendar/MonthSwitcher";
import { ActionSheet } from "./ActionSheet";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { eventTypeMeta } from "@/lib/events";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent, Suggestion } from "@/lib/types";

export function CalendarPage() {
  const { farmerId = "10060" } = useParams();
  const [month, setMonth] = useState(() => new Date());
  const [open, setOpen] = useState<Suggestion | null>(null);

  const from = new Date(month.getFullYear(), month.getMonth() - 1, 1).toISOString().slice(0, 10);
  const to = new Date(month.getFullYear(), month.getMonth() + 2, 0).toISOString().slice(0, 10);

  const cal = useQuery({
    queryKey: ["calendar", farmerId, month.getFullYear(), month.getMonth()],
    queryFn: () => getCalendar(farmerId, from, to),
  });

  const byEvent = useMemo(() => {
    const m = new Map<string, Suggestion>();
    for (const s of cal.data?.suggestions ?? []) m.set(s.event_id, s);
    return m;
  }, [cal.data]);

  const onEventClick = (ev: CalendarEvent) => {
    const s = byEvent.get(ev.id);
    if (s) setOpen(s);
  };

  return (
    <div className="space-y-6">
      <MonthSwitcher month={month} onChange={setMonth} rightSlot={<LegendBar />} />
      {cal.isLoading ? <Skeleton className="h-[640px] w-full" /> : (
        <MonthGrid month={month} events={cal.data?.events ?? []} onEventClick={onEventClick} />
      )}
      <SuggestionsStrip cal={cal.data} onClick={(s) => setOpen(s)} />
      <ActionSheet suggestion={open} farmerId={farmerId} onClose={() => setOpen(null)} />
    </div>
  );
}

function LegendBar() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.keys(eventTypeMeta) as (keyof typeof eventTypeMeta)[]).map((k) => {
        const m = eventTypeMeta[k];
        return (
          <Badge key={k} variant={m.color as any} className="text-[10px]">
            {m.label}
          </Badge>
        );
      })}
    </div>
  );
}

function SuggestionsStrip({ cal, onClick }: { cal?: { suggestions: Suggestion[] }; onClick: (s: Suggestion) => void }) {
  if (!cal?.suggestions?.length) return null;
  const items = cal.suggestions.slice(0, 8);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max">
        {items.map((s) => (
          <button key={s.event_id + s.date_window_start} onClick={() => onClick(s)} className="min-w-[260px] text-left">
            <Card className="card-hover">
              <CardContent className="space-y-1 pt-4">
                <div className="text-[11px] uppercase tracking-widest text-ink-mute">
                  {eventTypeMeta[s.event?.type ?? "trend"].label}
                </div>
                <div className="font-display text-sm font-semibold">{s.event?.title}</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-leaf">+{Math.round(s.predicted_lift.orders_delta)} заказов</span>
                  <span className="text-amber">+{Math.round(s.predicted_lift.revenue_delta)} ₽</span>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
