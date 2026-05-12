import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getCalendar, getFarmer, getFarmerProducts } from "@/lib/api";
import { ActionCard } from "@/components/action-card/ActionCard";
import { SeasonalityRing } from "@/components/calendar/SeasonalityRing";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionSheet } from "./ActionSheet";
import type { Suggestion } from "@/lib/types";
import { formatInt, formatRUB } from "@/lib/utils";
import { CalendarDays, Layers3, Sparkles, TrendingUp } from "lucide-react";

export function Dashboard() {
  const { farmerId = "10060" } = useParams();
  const [open, setOpen] = useState<Suggestion | null>(null);

  const farmer = useQuery({ queryKey: ["farmer", farmerId], queryFn: () => getFarmer(farmerId) });
  const products = useQuery({ queryKey: ["products", farmerId], queryFn: () => getFarmerProducts(farmerId) });
  const cal = useQuery({
    queryKey: ["calendar", farmerId],
    queryFn: () => getCalendar(farmerId),
  });

  const top = useMemo(() => {
    const list = (cal.data?.suggestions ?? [])
      .slice()
      .sort((a, b) => b.predicted_lift.orders_delta - a.predicted_lift.orders_delta)
      .slice(0, 6);
    return list;
  }, [cal.data]);

  const totals = useMemo(() => {
    const sList = cal.data?.suggestions ?? [];
    return {
      events: cal.data?.events?.length ?? 0,
      campaigns: sList.length,
      orders: sList.reduce((s, x) => s + x.predicted_lift.orders_delta, 0),
      revenue: sList.reduce((s, x) => s + x.predicted_lift.revenue_delta, 0),
    };
  }, [cal.data]);

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid items-center gap-6 md:grid-cols-[1fr,360px]"
      >
        <div>
          <Badge variant="leaf" className="mb-3 w-fit">Кабинет фермера</Badge>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {farmer.isLoading ? <Skeleton className="h-10 w-72" /> : farmer.data?.shop_name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-dim line-clamp-2">
            {farmer.data?.description?.slice(0, 200) ?? "Кабинет фермера на маркетплейсе Свое Родное."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Layers3 className="h-4 w-4" />} label="SKU" value={`${products.data?.count ?? 0}`} />
            <Stat icon={<CalendarDays className="h-4 w-4" />} label="События" value={`${totals.events}`} />
            <Stat icon={<Sparkles className="h-4 w-4" />} label="Кампаний" value={`${totals.campaigns}`} tone="leaf" />
            <Stat icon={<TrendingUp className="h-4 w-4" />} label="Прогноз" value={`+${formatRUB(totals.revenue)}`} tone="amber" />
          </div>
        </div>
        <div className="grid place-items-center">
          <SeasonalityRing size={260} />
        </div>
      </motion.section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Топ-предложения на ближайшие 30 дней</h2>
          <Badge variant="outline">{top.length} активных</Badge>
        </div>
        {cal.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
          </div>
        ) : top.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="Нет подходящих событий"
            hint="Проверьте, что ассортимент загружен и события засеяны (./bin/seed)."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {top.map((s, i) => (
              <ActionCard key={`${s.event_id}-${i}`} s={s} index={i} onOpen={() => setOpen(s)} onAdd={() => setOpen(s)} />
            ))}
          </div>
        )}
      </section>

      <ActionSheet suggestion={open} farmerId={farmerId} onClose={() => setOpen(null)} />
    </div>
  );
}

function Stat({ icon, label, value, tone = "default" }: { icon: React.ReactNode; label: string; value: string; tone?: "default" | "leaf" | "amber" }) {
  const cls = tone === "leaf" ? "text-leaf" : tone === "amber" ? "text-amber" : "text-ink";
  return (
    <Card className="card-hover">
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-1.5 smallcaps text-[10px] text-ink-mute">
          {icon}
          <span>{label}</span>
        </div>
        <div className={`font-display tnum text-3xl font-semibold leading-none tracking-tight ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
