import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Calendar,
  Crown,
  Gift,
  Layers3,
  Megaphone,
  RefreshCw,
  Sparkles,
  Workflow,
} from "lucide-react";

import { getFarmerProducts, getInsights, listEvents, type Insight } from "@/lib/api";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CategoryHeatmap } from "@/components/charts/CategoryHeatmap";

// =================================================================
//  AI Insights — proactive intelligence. The page used to explain the
//  AI pipeline architecture; now it surfaces *recommendations*: where
//  the catalog is under-leveraged, what events are about to open,
//  which channels are missing, which categories convert best.
//
//  Every card is computed by the Go insights engine; no LLM in the
//  loop. The FE merely renders + adds an icon per kind.
// =================================================================
export function AiPage() {
  const { farmerId = "10060" } = useParams();
  const q = useQuery({
    queryKey: ["insights", farmerId],
    queryFn: () => getInsights(farmerId),
    staleTime: 60_000,
  });
  // 12-month window of events for the heatmap.
  const heatmapQ = useQuery({
    queryKey: ["events-12mo"],
    queryFn: () => {
      const now = new Date();
      const to = new Date(now);
      to.setFullYear(now.getFullYear() + 1);
      return listEvents(now.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
    },
    staleTime: 5 * 60_000,
  });
  // We derive farmer categories from their own SKUs (the /api/farmers/:id
  // endpoint doesn't include counts). Already cached if the user visited any
  // page that uses this query.
  const productsQ = useQuery({
    queryKey: ["products", farmerId],
    queryFn: () => getFarmerProducts(farmerId),
    staleTime: 60_000,
  });
  const farmerCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of productsQ.data?.products ?? []) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, [productsQ.data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="smallcaps text-[11px] text-leaf">
            <Sparkles className="inline h-3 w-3" /> AI · proactive intelligence
          </span>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            AI-ассистент уже всё посмотрел
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-dim">
            Анализирует ваш каталог, теги, события маркетплейса и календарь
            на 90 дней вперёд. Возвращает только сильные сигналы — ранжированы
            по бизнес-влиянию.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} />
          Пересчитать
        </Button>
      </header>

      {heatmapQ.isLoading || productsQ.isLoading ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : farmerCategories.length > 0 && (heatmapQ.data?.length ?? 0) > 0 ? (
        <CategoryHeatmap events={heatmapQ.data ?? []} categories={farmerCategories} />
      ) : null}

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Сильных сигналов пока нет"
          hint="Это бывает, когда каталог только что загружен. Прогоните теггинг и попробуйте снова."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(q.data ?? []).map((insight, i) => (
            <InsightCard key={`${insight.kind}-${i}`} insight={insight} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const meta = kindMeta(insight.kind);
  const tone = (insight.tone ?? meta.tone) as Insight["tone"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="card-hover"
    >
      <Card className="relative h-full overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-25 blur-3xl"
          style={{ background: `hsl(var(--${tone}))` }}
        />
        <CardContent className="flex h-full flex-col gap-3 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-lg border",
                `border-${tone}/40 bg-${tone}-soft/30 text-${tone}`,
              )}
            >
              <meta.Icon className="h-4 w-4" />
            </div>
            <Badge variant={tone as any}>{meta.label}</Badge>
          </div>
          <h3 className="font-display text-lg font-semibold leading-tight">
            {insight.title}
          </h3>
          <p className="text-sm leading-relaxed text-ink-dim">{insight.body}</p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            <ScoreBar value={insight.score} tone={tone} />
            {meta.cta && (
              <a
                href={meta.cta.href}
                className="inline-flex items-center gap-1 text-xs text-ink-dim hover:text-ink"
              >
                {meta.cta.label}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ScoreBar({ value, tone }: { value: number; tone: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="smallcaps text-[9px] text-ink-mute">импакт</span>
      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-bg-elevated">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.2, 0.65, 0.2, 1] }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: `hsl(var(--${tone}))` }}
        />
      </div>
      <span className="font-mono tnum text-[10px] text-ink-mute">{pct}</span>
    </div>
  );
}

// per-kind icon + label + (optional) link to the relevant deeper page.
function kindMeta(kind: string): { Icon: any; label: string; tone: Insight["tone"]; cta?: { label: string; href: string } } {
  switch (kind) {
    case "season_opening":
      return { Icon: Calendar, label: "Открытие сезона", tone: "leaf", cta: { label: "В календарь", href: "../calendar" } };
    case "gift_gap":
      return { Icon: Gift, label: "Подарочный сегмент", tone: "amber", cta: { label: "В каталог", href: "../products" } };
    case "premium_gap":
      return { Icon: Crown, label: "Премиум-сегмент", tone: "plum", cta: { label: "В каталог", href: "../products" } };
    case "category_strength":
      return { Icon: Layers3, label: "Сильная категория", tone: "leaf" };
    case "channel_gap":
      return { Icon: Megaphone, label: "Каналы коммуникации", tone: "sky", cta: { label: "В настройки", href: "../settings" } };
    case "match_gap":
      return { Icon: Workflow, label: "Возможность теггинга", tone: "amber" };
    case "repeat_cadence":
      return { Icon: RefreshCw, label: "Повторные продажи", tone: "plum" };
  }
  return { Icon: Sparkles, label: "Инсайт", tone: "leaf" };
}
