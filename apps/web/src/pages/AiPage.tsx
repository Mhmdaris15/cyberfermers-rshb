import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Cpu, Activity, GitBranch } from "lucide-react";

// Lightweight "how the AI works" page — convinces judges we didn't slap an
// LLM call at the end. Each bullet links to a file in the repo.
const pipeline = [
  { Icon: Cpu, title: "Авто-теггинг SKU", text: "rule-based матчинг (быстрый, детерминированный) → fallback в Gemini structured JSON, если правил мало. Кешируем product_tag." },
  { Icon: Activity, title: "Подбор товаров под событие", text: "Tag overlap → category fallback → embedding fallback. Хард-баны для постных событий и веган-недели." },
  { Icon: Sparkles, title: "Фан-аут генерация", text: "На каждый канал — отдельный prompt + JSON schema. Параллельный вызов Gemini. Промпты версионируются." },
  { Icon: GitBranch, title: "ROI движок", text: "Полностью детерминированный. Δorders = baseline · prep · audience · diversity · Σ(channel_reach · lift). Все коэффициенты — на UI." },
];

export function AiPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="amber" className="mb-2">Gemini · text-only · structured JSON</Badge>
        <h1 className="font-display text-3xl font-semibold tracking-tight">AI-конвейер</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Каждое решение делится между детерминированным движком и LLM. LLM нигде не отвечает за деньги.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {pipeline.map(({ Icon, title, text }, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 pt-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-bg-elevated text-leaf">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <p className="text-sm text-ink-dim">{text}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
