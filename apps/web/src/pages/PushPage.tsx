import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Plus } from "lucide-react";

import { listFarmerPushes, pushDispatchStatus, pushScheduledFor } from "@/lib/push";
import { PushCard } from "@/components/push/PushCard";
import { PushEditorDrawer } from "@/components/push/PushEditorDrawer";
import type { ContentStatus, GeneratedContent } from "@/lib/types";

// =====================================================================
//  PushPage — operational queue, not editorial archive. Filter chips
//  show queued / sent / failed counts so the operator sees their
//  dispatch pipeline at a glance. List is sorted with scheduled-future
//  pushes first (next-up at the top), then sent (most recent), then
//  drafts.
// =====================================================================

type Filter = "all" | "queued" | "sent" | "scheduled" | "draft" | "archived";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all",       label: "Все" },
  { id: "scheduled", label: "По расписанию" },
  { id: "queued",    label: "В очереди" },
  { id: "sent",      label: "Отправлены" },
  { id: "draft",     label: "Черновики" },
  { id: "archived",  label: "Архив" },
];

export function PushPage() {
  const { farmerId = "10060" } = useParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [drawer, setDrawer] = useState<string | "new" | null>(null);

  // We always fetch all + status='archived' separately; client-side
  // filtering for queued/sent/scheduled because those derive from body
  // fields not the top-level status.
  const q = useQuery({
    queryKey: ["push", farmerId, filter === "archived" ? "archived" : "active"],
    queryFn: () =>
      listFarmerPushes(
        farmerId,
        filter === "archived" ? ("archived" as ContentStatus) : undefined,
      ),
  });

  const visible = useMemo(() => filterPushes(q.data ?? [], filter), [q.data, filter]);
  const counts = useMemo(() => countByFilter(q.data ?? []), [q.data]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="smallcaps text-[10px] text-rust">push</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Push-уведомления
          </h1>
          <p className="max-w-xl text-sm text-ink-dim">
            Короткие сообщения с&nbsp;высокой срочностью. Запланируйте
            время&nbsp;— сервер автоматически отправит, как только оно
            наступит (проверка каждые 30&nbsp;секунд).
          </p>
        </div>
        <button
          onClick={() => setDrawer("new")}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Новый push
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const count = counts[f.id];
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-leaf/60 bg-leaf/10 text-leaf"
                  : "border-line bg-bg-elevated text-ink-dim hover:bg-bg-subtle"
              }`}
            >
              <span>{f.label}</span>
              <span className={`rounded-full px-1.5 text-[10px] font-mono ${active ? "bg-leaf/15" : "bg-bg-subtle"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {q.isLoading ? (
        <List>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-bg-elevated/50" />
          ))}
        </List>
      ) : visible.length === 0 ? (
        <Empty onCreate={() => setDrawer("new")} />
      ) : (
        <List>
          {visible.map((p) => (
            <PushCard
              key={p.id}
              push={p}
              onOpen={() => p.id && setDrawer(p.id)}
            />
          ))}
        </List>
      )}

      <PushEditorDrawer
        pushID={drawer}
        farmerID={farmerId}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}

// 1-2 column list — pushes are short rows, not magazine cards
function List({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {children}
    </div>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-bg-elevated/30 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-rust/15 text-rust">
        <BellRing className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-display text-lg">Очередь пуста</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-dim">
          Создайте первый push к&nbsp;завозу нового продукта или акции.
          Заголовок&nbsp;— до&nbsp;30 знаков, тело&nbsp;— до&nbsp;178,
          чтобы текст полностью читался на&nbsp;экране блокировки.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110"
      >
        <Plus className="h-4 w-4" />
        Создать первый push
      </button>
    </div>
  );
}

function filterPushes(list: GeneratedContent[], filter: Filter): GeneratedContent[] {
  const now = Date.now();
  let out = list;
  if (filter === "scheduled") {
    out = list.filter((p) => {
      const sched = pushScheduledFor(p);
      return sched != null && sched.getTime() > now && pushDispatchStatus(p) !== "sent";
    });
  } else if (filter === "queued") {
    out = list.filter((p) => pushDispatchStatus(p) === "queued");
  } else if (filter === "sent") {
    out = list.filter((p) => pushDispatchStatus(p) === "sent");
  } else if (filter === "draft") {
    out = list.filter((p) => (p.status ?? "draft") === "draft");
  } else if (filter === "archived") {
    out = list.filter((p) => p.status === "archived");
  }
  // Sort: scheduled-future first (nearest first), then sent (most recent), then everything else
  return [...out].sort((a, b) => {
    const sa = pushScheduledFor(a)?.getTime();
    const sb = pushScheduledFor(b)?.getTime();
    if (sa && sa > now && sb && sb > now) return sa - sb;
    if (sa && sa > now) return -1;
    if (sb && sb > now) return 1;
    return new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime();
  });
}

function countByFilter(list: GeneratedContent[]): Record<Filter, number> {
  const out: Record<Filter, number> = {
    all: list.length, queued: 0, sent: 0, scheduled: 0, draft: 0, archived: 0,
  };
  const now = Date.now();
  for (const p of list) {
    const d = pushDispatchStatus(p);
    const s = pushScheduledFor(p)?.getTime();
    if (d === "queued") out.queued++;
    if (d === "sent")   out.sent++;
    if (s && s > now && d !== "sent") out.scheduled++;
    if ((p.status ?? "draft") === "draft") out.draft++;
    if (p.status === "archived") out.archived++;
  }
  return out;
}
