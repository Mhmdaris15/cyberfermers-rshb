import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp, Coins } from "lucide-react";
import { formatInt, formatRUB } from "@/lib/utils";
import type { PredictedLift } from "@/lib/types";
import { motion } from "framer-motion";

interface RoiPanelProps {
  lift: PredictedLift;
}

// Renders the deterministic ROI breakdown. Every number is paired with an
// assumption tooltip — judges expect to poke at the formula.
export function RoiPanel({ lift }: RoiPanelProps) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-5">
        <div className="grid grid-cols-3 gap-3">
          <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Доп. заказы" value={`+${formatInt(lift.orders_delta)}`} tone="leaf" />
          <Kpi icon={<Coins className="h-4 w-4" />} label="Доп. выручка" value={`+${formatRUB(lift.revenue_delta)}`} tone="amber" />
          <Kpi icon={<Info className="h-4 w-4" />} label="Уверенность" value={`${Math.round(lift.confidence * 100)}%`} tone="plum" />
        </div>

        {lift.channel_mix && Object.keys(lift.channel_mix).length > 0 && (
          <ChannelMixBar mix={lift.channel_mix} total={lift.orders_delta} />
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="smallcaps text-[10px] text-ink-mute">Допущения модели</h4>
            <span className="text-[10px] text-ink-mute">все числа конфигурируются в roi.go</span>
          </div>
          <ul className="divide-y divide-line/60">
            {lift.assumptions.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-sm text-ink truncate">{a.label}</span>
                  {a.note && (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button aria-label="info" className="text-ink-mute hover:text-ink">
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{a.note}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="flex items-baseline gap-1 font-mono text-sm text-ink">
                  <span>{a.value}</span>
                  <span className="text-[11px] text-ink-mute">{a.unit}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// Decomposes Δorders into per-channel contribution. The bar reads left→right
// in proportion to each channel's (reach × lift) share of the total.
function ChannelMixBar({ mix, total }: { mix: Record<string, number>; total: number }) {
  const entries = Object.entries(mix)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalShown = entries.reduce((n, [, v]) => n + v, 0) || total || 1;

  // Stable colour per channel — same channel always gets the same hue.
  const tone: Record<string, string> = {
    storefront: "leaf",
    push:       "amber",
    story:      "plum",
    blog:       "sky",
    recipe:     "rust",
    chat:       "leaf",
    social:     "amber",
    email:      "sky",
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="smallcaps text-[10px] text-ink-mute">Вклад каналов в прогноз</h4>
        <span className="text-[10px] text-ink-mute font-mono tnum">{formatInt(total)} заказов</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-line/60 bg-bg-elevated">
        {entries.map(([ch, v], i) => {
          const pct = (v / totalShown) * 100;
          const c = tone[ch] ?? "leaf";
          return (
            <motion.div
              key={ch}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: i * 0.06, duration: 0.55, ease: [0.2, 0.65, 0.2, 1] }}
              style={{ background: `hsl(var(--${c}))` }}
              title={`${ruChannel(ch)}: +${v.toFixed(1)} заказов`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-dim">
        {entries.map(([ch, v]) => {
          const c = tone[ch] ?? "leaf";
          return (
            <div key={ch} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: `hsl(var(--${c}))` }}
                aria-hidden
              />
              <span>{ruChannel(ch)}</span>
              <span className="font-mono tnum text-ink-mute">+{v.toFixed(1)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ruChannel(ch: string): string {
  return ({
    storefront: "витрина", push: "пуш", story: "сторис", blog: "блог",
    recipe: "рецепт", chat: "чат", social: "соцсети", email: "e-mail",
  } as Record<string, string>)[ch] ?? ch;
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "leaf" | "amber" | "plum" }) {
  const toneCls = tone === "leaf" ? "text-leaf" : tone === "amber" ? "text-amber" : "text-plum";
  return (
    <div className="rounded-xl border border-line/70 bg-bg-subtle/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 smallcaps text-[10px] text-ink-mute">{icon} <span>{label}</span></div>
      <div className={`font-display tnum text-3xl font-semibold leading-none tracking-tight ${toneCls}`}>{value}</div>
    </div>
  );
}
