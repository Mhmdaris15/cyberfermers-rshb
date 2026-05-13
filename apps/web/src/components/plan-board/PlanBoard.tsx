import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { cn, formatInt, formatRUB } from "@/lib/utils";
import { Sparkles, GripVertical } from "lucide-react";
import type { PlanCard } from "@/lib/types";
import { eventTypeMeta } from "@/lib/events";

const COLUMNS: { id: PlanCard["column"]; label: string; tone: string }[] = [
  { id: "proposed", label: "Предложено", tone: "outline" },
  { id: "planned", label: "Запланировано", tone: "leaf" },
  { id: "live", label: "В эфире", tone: "amber" },
  { id: "completed", label: "Завершено", tone: "plum" },
];

interface PlanBoardProps {
  board: Record<string, PlanCard[]>;
  /** Called for cross-column moves (button) and intra-column reorder (drag). */
  onMove?: (card: PlanCard, column: PlanCard["column"], position: number) => void;
}

export function PlanBoard({ board, onMove }: PlanBoardProps) {
  const total = Object.values(board).reduce((n, c) => n + (c?.length ?? 0), 0);
  if (total === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title="Пока пусто"
        hint="Добавьте предложения с календаря или дашборда — они окажутся в колонке «Предложено»."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => (
        <Column key={col.id} col={col} cards={board[col.id] ?? []} onMove={onMove} />
      ))}
    </div>
  );
}

function Column({
  col,
  cards,
  onMove,
}: {
  col: { id: PlanCard["column"]; label: string; tone: string };
  cards: PlanCard[];
  onMove?: PlanBoardProps["onMove"];
}) {
  const isLive = col.id === "live";
  // Local mirror to keep drag feeling instant. Synced from props on every
  // refetch; we *only* fire onReorder when the order actually changes from
  // the props baseline, to avoid feedback loops with the query cache.
  const [items, setItems] = useState(cards);
  const prevPropsRef = useRef(cards.map((c) => c.id).join("|"));

  useEffect(() => {
    const sig = cards.map((c) => c.id).join("|");
    if (sig !== prevPropsRef.current) {
      setItems(cards);
      prevPropsRef.current = sig;
    }
  }, [cards]);

  function commitReorder(next: PlanCard[]) {
    setItems(next);
    // Detect indices that changed and emit moves for them.
    for (let i = 0; i < next.length; i++) {
      const wasAt = items.findIndex((x) => x.id === next[i].id);
      if (wasAt !== i) {
        onMove?.(next[i], col.id, i);
      }
    }
  }

  return (
    <div className={cn("relative flex flex-col gap-3 rounded-2xl p-2", isLive && "live-glow")}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant={col.tone as any}>{col.label}</Badge>
          {isLive && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber">
              <span className="relative grid h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-amber" />
                <span className="absolute inset-0 animate-ping rounded-full bg-amber/60" />
              </span>
              в эфире
            </span>
          )}
          <span className="text-xs text-ink-mute">{items.length}</span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="glass rounded-xl border border-dashed border-line/60 px-4 py-6 text-center text-xs text-ink-mute">
          пусто
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={commitReorder}
          className="flex flex-col gap-3"
        >
          <AnimatePresence initial={false}>
            {items.map((card) => (
              <Reorder.Item
                key={card.id ?? card.suggestion_id}
                value={card}
                whileDrag={{ scale: 1.02, cursor: "grabbing" }}
                className="cursor-grab active:cursor-grabbing"
              >
                <CardItem card={card} onMove={(target) => onMove?.(card, target, 0)} />
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}
    </div>
  );
}

function CardItem({
  card,
  onMove,
}: {
  card: PlanCard;
  onMove: (col: PlanCard["column"]) => void;
}) {
  const sug = card.suggestion;
  const ev = sug?.event;
  const meta = ev ? eventTypeMeta[ev.type] : null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
    >
      <Card className="group relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-25 blur-2xl"
          style={{ background: ev?.color ?? `hsl(var(--${meta?.color ?? "leaf"}))` }}
        />
        <CardContent className="space-y-2 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="h-3.5 w-3.5 text-ink-mute" aria-hidden />
              <Badge variant={(meta?.color as any) ?? "leaf"}>{meta?.label ?? "—"}</Badge>
            </div>
            <span className="text-[11px] text-ink-mute">
              {new Date(card.scheduled_for ?? sug?.date_window_start ?? new Date()).toLocaleDateString(
                "ru-RU",
                { day: "2-digit", month: "short" },
              )}
            </span>
          </div>
          <div className="font-display text-sm font-semibold leading-tight">
            {ev?.title ?? "Событие"}
          </div>
          {sug && (
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-ink-dim">+{formatInt(sug.predicted_lift.orders_delta)} заказов</span>
              <span className="text-amber">+{formatRUB(sug.predicted_lift.revenue_delta)}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(sug?.channels ?? []).slice(0, 4).map((c) => (
              <span
                key={c}
                className="rounded border border-line bg-bg-elevated/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-mute"
              >
                {c}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-end gap-1 pt-2 opacity-0 transition group-hover:opacity-100">
            {COLUMNS.filter((c) => c.id !== card.column).map((c) => (
              <button
                key={c.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(c.id);
                }}
                className="rounded-md border border-line bg-bg-elevated px-1.5 py-0.5 text-[10px] text-ink-dim hover:bg-bg-subtle hover:text-ink"
              >
                → {c.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
