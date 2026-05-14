import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Calendar,
  Crown,
  Gift,
  Layers3,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Workflow,
} from "lucide-react";

import { chatTurn, getFarmerProducts, getInsights, listEvents, type Insight } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { CategoryHeatmap } from "@/components/charts/CategoryHeatmap";

import {
  clearSession, loadSession, saveAs, saveSession,
  type SlashCommand, type WorkspaceMessage,
} from "@/lib/ai-workspace";
import { StarterRail } from "@/components/ai-workspace/StarterRail";
import { Conversation } from "@/components/ai-workspace/Conversation";
import { Composer } from "@/components/ai-workspace/Composer";

// =====================================================================
//  AiPage — tabbed shell.
//
//    ┌── Tabs ──────────────────────────────┐
//    │  Инсайты    Воркспейс                │
//    └──────────────────────────────────────┘
//    │                                       │
//    │  InsightsTab   |   WorkspaceTab       │
//    │  (existing)        (new — phase 9)    │
//    └───────────────────────────────────────┘
//
//  The Insights tab is the entire pre-Phase-9 page logic, untouched.
//  The Workspace tab is the new conversational surface that ties the
//  five content modules together via the existing chat + per-module
//  POST endpoints.
// =====================================================================

export function AiPage() {
  return (
    <div className="space-y-5">
      <header className="border-b border-line pb-4">
        <span className="smallcaps text-[11px] text-leaf">
          <Sparkles className="inline h-3 w-3" /> AI · workspace
        </span>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
          AI-ассистент
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-dim">
          Слева — проактивные инсайты, посчитанные движком без LLM.
          Справа — конверсационный воркспейс, где можно попросить ИИ
          сгенерировать, объяснить, переписать&nbsp;— и&nbsp;превратить
          любой ответ в&nbsp;черновик контента одним кликом.
        </p>
      </header>

      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Инсайты
          </TabsTrigger>
          <TabsTrigger value="workspace">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Воркспейс
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights">
          <InsightsTab />
        </TabsContent>
        <TabsContent value="workspace">
          <WorkspaceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Insights tab (existing logic, lifted from the pre-Phase-9 page) ──

function InsightsTab() {
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
    <div className="space-y-6 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-ink-mute">
          Анализирует ваш каталог, теги, события маркетплейса и&nbsp;календарь
          на&nbsp;90 дней вперёд. Возвращает только сильные сигналы —
          ранжированы по&nbsp;бизнес-влиянию.
        </p>
        <Button variant="secondary" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} />
          Пересчитать
        </Button>
      </div>

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

// ─── Workspace tab (new, Phase 9) ─────────────────────────────────────

function WorkspaceTab() {
  const { farmerId = "10060" } = useParams();
  const toast = useToast();

  // Session lives in React state, hydrated from localStorage. Saved
  // every time the array changes so a refresh doesn't blow away the
  // conversation — but the server holds no thread persistence yet.
  const [messages, setMessages] = useState<WorkspaceMessage[]>(() => loadSession(farmerId));
  const [injected, setInjected] = useState<string | undefined>(undefined);

  const turn = useMutation({
    mutationFn: (text: string) =>
      chatTurn(farmerId, text, messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        text: m.text,
      }))),
  });

  function push(messagesNext: WorkspaceMessage[]) {
    setMessages(messagesNext);
    saveSession(farmerId, messagesNext);
  }

  async function send(text: string) {
    if (!text.trim() || turn.isPending) return;
    const next: WorkspaceMessage[] = [
      ...messages,
      { role: "user", text, ts: Date.now() },
    ];
    push(next);
    try {
      const reply = await turn.mutateAsync(text);
      push([
        ...next,
        {
          role: "assistant",
          text: reply.text,
          ts: Date.now(),
          actions: reply.actions ?? [],
          used: reply.used ?? [],
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ошибка сети";
      push([
        ...next,
        { role: "assistant", text: `Не удалось получить ответ: ${msg}`, ts: Date.now() },
      ]);
    }
  }

  async function regenerate() {
    // Find the last user message and resend it. We drop the trailing
    // assistant reply first so the regenerated one takes its place.
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx < 0) return;
    const trimmed = messages.slice(0, lastUserIdx + 1);
    push(trimmed);
    await send(messages[lastUserIdx].text);
  }

  async function onSlash(cmd: SlashCommand, arg: string) {
    switch (cmd.kind) {
      case "explain":
        await send(arg.trim() ? `Объясни подробнее: ${arg}` : "Объясни, что у меня сейчас в плане");
        return;
      case "regen":
        await regenerate();
        return;
      case "clear":
        clearSession(farmerId);
        setMessages([]);
        return;
      case "save-story":
      case "save-blog":
      case "save-recipe":
      case "save-social":
      case "save-push": {
        const map = {
          "save-story":  "story",
          "save-blog":   "blog",
          "save-recipe": "recipe",
          "save-social": "social",
          "save-push":   "push",
        } as const;
        const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
        if (!lastAssistant) {
          toast.error("Нет ответа ИИ для сохранения");
          return;
        }
        try {
          const res = await saveAs(farmerId, map[cmd.kind], lastAssistant.text);
          toast.success(`Сохранено: ${res.route}`);
        } catch {
          toast.error("Не удалось сохранить");
        }
        return;
      }
    }
  }

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[28rem] gap-4 overflow-hidden rounded-2xl border border-line bg-bg-elevated/30 pt-1">
      <StarterRail
        onPick={(prompt) => setInjected(prompt)}
        disabled={turn.isPending}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Conversation
          messages={messages}
          farmerID={farmerId}
          pending={turn.isPending}
          onRegenerate={regenerate}
          onSaved={(route, label) => toast.success(`${label} сохранён${label === "Push" ? "" : "а"} → ${route}`)}
        />
        <Composer
          onSubmit={send}
          onSlash={onSlash}
          disabled={turn.isPending}
          injected={injected}
          onInjectedConsumed={() => setInjected(undefined)}
        />
      </div>
    </div>
  );
}

// ─── existing insight card / score bar / kindMeta (unchanged) ─────────

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
