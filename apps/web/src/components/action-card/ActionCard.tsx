import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatInt, formatRUB } from "@/lib/utils";
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
          <div className="flex items-center justify-between">
            <Badge variant={(meta?.color as any) ?? "leaf"}>{meta?.label}</Badge>
            <span className="text-[11px] text-ink-mute">
              {new Date(s.date_window_start).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
              {" — "}
              {new Date(s.date_window_end).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
            </span>
          </div>
          <h3 className="font-display text-xl font-semibold leading-tight">{ev?.title}</h3>
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
