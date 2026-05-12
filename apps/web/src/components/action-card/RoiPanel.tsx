import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp, Coins } from "lucide-react";
import { formatInt, formatRUB } from "@/lib/utils";
import type { PredictedLift } from "@/lib/types";

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

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-widest text-ink-mute">Допущения модели</h4>
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

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "leaf" | "amber" | "plum" }) {
  const toneCls = tone === "leaf" ? "text-leaf" : tone === "amber" ? "text-amber" : "text-plum";
  return (
    <div className="rounded-xl border border-line/70 bg-bg-subtle/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 smallcaps text-[10px] text-ink-mute">{icon} <span>{label}</span></div>
      <div className={`font-display tnum text-3xl font-semibold leading-none tracking-tight ${toneCls}`}>{value}</div>
    </div>
  );
}
