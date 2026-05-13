import { motion } from "framer-motion";
import { ArrowUpRight, Brain, Flame, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatInt, formatRUB, plural } from "@/lib/utils";
import { eventTypeMeta } from "@/lib/events";
import type { Suggestion } from "@/lib/types";

interface ActionCardProps {
  s: Suggestion;
  onOpen?: () => void;
  onAdd?: () => void;
  index?: number;
}

export function ActionCard({ s, onOpen, onAdd, index = 0 }: ActionCardProps) {
  const ev = s.event;
  const meta = ev ? eventTypeMeta[ev.type] : null;
  const top = (s.products ?? []).slice(0, 4);

  // Urgency: days until event start (not the prep-window start). Pulsing dot
  // at ≤7 days; "сегодня" / "завтра" use friendlier copy.
  const eventStart = new Date(ev?.start_date ?? s.date_window_start);
  const daysUntil = Math.max(
    0,
    Math.round((eventStart.getTime() - Date.now()) / 86_400_000),
  );
  const urgent = daysUntil <= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 240, damping: 26 }}
      className="card-hover"
    >
      <Card className={cn("relative overflow-hidden")}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-30 blur-3xl"
          style={{ background: ev?.color ?? `hsl(var(--${meta?.color ?? "leaf"}))` }}
        />
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={(meta?.color as any) ?? "leaf"}>{meta?.label}</Badge>
            <UrgencyBadge daysUntil={daysUntil} urgent={urgent} />
          </div>
          <h3 className="font-display text-xl font-semibold leading-tight">{ev?.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-mute">
            <span>
              {new Date(s.date_window_start).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
              {" — "}
              {new Date(s.date_window_end).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
            </span>
            <ConfidenceBadge value={s.predicted_lift.confidence} />
          </div>
          {ev?.themes?.[0] && (
            <p className="text-sm text-ink-dim line-clamp-2">{ev.themes[0]}</p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {top.map((p) => (
              <span
                key={p.id}
                className="rounded-md border border-line bg-bg-elevated/60 px-2 py-1 text-xs text-ink-dim"
              >
                {p.name.length > 28 ? p.name.slice(0, 26) + "…" : p.name}
              </span>
            ))}
            {(s.products?.length ?? 0) > 4 && (
              <span className="rounded-md px-2 py-1 text-xs text-ink-mute">
                + ещё {(s.products?.length ?? 0) - 4}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line/70 bg-bg-subtle/40 p-3">
            <Metric
              label="Прогноз заказов"
              value={`+${formatInt(s.predicted_lift.orders_delta)}`}
              hint={`за ${ev?.prep_window_days ?? 7} дней`}
              tone="leaf"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
            />
            <Metric
              label="Прогноз выручки"
              value={`+${formatRUB(s.predicted_lift.revenue_delta)}`}
              hint={`скидка ${s.promo.discount_pct}%`}
              tone="amber"
              icon={<Sparkles className="h-3.5 w-3.5" />}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {s.channels.map((ch) => (
              <Badge key={ch} variant="outline" className="lowercase">
                {ruChannel(ch)}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onOpen}>
              Открыть кампанию <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={onAdd}>Добавить в план</Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Metric({ label, value, hint, tone, icon }: { label: string; value: string; hint?: string; tone: "leaf" | "amber"; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="smallcaps text-[10px] text-ink-mute">{label}</div>
      <div className={cn("flex items-center gap-1.5 font-display tnum text-3xl font-semibold leading-none tracking-tight", tone === "leaf" ? "text-leaf" : "text-amber")}>
        {icon}
        {value}
      </div>
      {hint && <div className="text-[11px] text-ink-mute">{hint}</div>}
    </div>
  );
}

// ConfidenceBadge — surfaces PredictedLift.Confidence as a tiered chip.
// 0.0-0.45 low, 0.45-0.70 medium, 0.70+ high. The deck/judge sees this first
// and it tells them the recommender knows when to be humble.
function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  let tier: "low" | "med" | "high" = "low";
  if (value >= 0.70) tier = "high";
  else if (value >= 0.45) tier = "med";

  const cls = cn(
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
    tier === "high" && "border-leaf/40 bg-leaf-soft/30 text-leaf",
    tier === "med" && "border-amber/40 bg-amber-soft/30 text-amber",
    tier === "low" && "border-line bg-bg-elevated/60 text-ink-dim",
  );
  return (
    <span className={cls} title="Уверенность AI в прогнозе">
      <Brain className="h-3 w-3" aria-hidden />
      <span className="tnum">{pct}%</span>
    </span>
  );
}

// UrgencyBadge — copy + color tier driven by days-until-event.
function UrgencyBadge({ daysUntil, urgent }: { daysUntil: number; urgent: boolean }) {
  let copy: string;
  if (daysUntil === 0) copy = "сегодня";
  else if (daysUntil === 1) copy = "завтра";
  else copy = `до события ${daysUntil} ${plural(daysUntil, ["день", "дня", "дней"])}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
        urgent
          ? "border-amber/40 bg-amber-soft/30 text-amber"
          : "border-line bg-bg-elevated/60 text-ink-dim",
      )}
    >
      {urgent && (
        <motion.span
          aria-hidden
          className="grid place-items-center"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          <Flame className="h-3 w-3" />
        </motion.span>
      )}
      <span className="tnum">{copy}</span>
    </span>
  );
}

function ruChannel(ch: string): string {
  return ({
    storefront: "витрина",
    push: "пуш",
    story: "сторис",
    blog: "блог",
    recipe: "рецепт",
    chat: "чат",
    social: "соцсети",
    email: "e-mail",
  } as Record<string, string>)[ch] ?? ch;
}
