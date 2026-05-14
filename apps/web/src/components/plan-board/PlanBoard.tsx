import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { cn, formatInt, formatRUB } from "@/lib/utils";
import { CalendarClock, Flame, GripVertical, Sparkles } from "lucide-react";
import type { CardPriority, PlanCard } from "@/lib/types";
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
  /** Called when the user wants to inspect/edit a card's full detail. */
  onOpen?: (card: PlanCard) => void;
}

export function PlanBoard({ board, onMove, onOpen }: PlanBoardProps) {
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
        <Column
          key={col.id}
          col={col}
          cards={board[col.id] ?? []}
          onMove={onMove}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function Column({
  col,
  cards,
  onMove,
  onOpen,
}: {
  col: { id: PlanCard["column"]; label: string; tone: string };
  cards: PlanCard[];
  onMove?: PlanBoardProps["onMove"];
  onOpen?: PlanBoardProps["onOpen"];
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
                <CardItem
                  card={card}
                  onMove={(target) => onMove?.(card, target, 0)}
                  onOpen={() => onOpen?.(card)}
                />
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
  onOpen,
}: {
  card: PlanCard;
  onMove: (col: PlanCard["column"]) => void;
  onOpen?: () => void;
}) {
  const sug = card.suggestion;
  const ev = sug?.event;
  const meta = ev ? eventTypeMeta[ev.type] : null;

  // Rich-card surface: prefer explicit Phase-3 title/description over the
  // legacy event title; merge audience/hashtag/channel chips from BOTH
  // the card and the underlying suggestion (cards created via /generate
  // inherit the suggestion's channels by default).
  const displayTitle = card.title?.trim() || ev?.title || "Кампания";
  const channels = (card.channels?.length ? card.channels : sug?.channels) ?? [];
  const tags = card.hashtags ?? [];
  const aud  = card.audience_tags ?? [];

  const due = card.due_date ? new Date(card.due_date) : null;
  const overdue = !!due && due.getTime() < Date.now() && card.column !== "completed";

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
        {/* Body is the open-detail surface. Drag is handled by the
            parent Reorder.Item; click triggers onOpen. We exclude the
            quick-action row at the bottom via stopPropagation there. */}
        <button
          type="button"
          onClick={onOpen}
          aria-label="Открыть карточку"
          className="block w-full text-left focus-ring"
        >
          <CardContent className="space-y-2 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5 text-ink-mute" aria-hidden />
                <Badge variant={(meta?.color as any) ?? "leaf"}>{meta?.label ?? "—"}</Badge>
                {card.priority && card.priority !== "normal" && (
                  <PriorityChip priority={card.priority} />
                )}
              </div>
              <span className={cn(
                "inline-flex items-center gap-1 text-[11px]",
                overdue ? "text-rust" : "text-ink-mute",
              )}>
                {due && <CalendarClock className="h-3 w-3" />}
                {(due ?? new Date(card.scheduled_for ?? sug?.date_window_start ?? new Date()))
                  .toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
              </span>
            </div>

            <div className="font-display text-sm font-semibold leading-tight">
              {displayTitle}
            </div>

            {card.description && (
              <p className="line-clamp-2 text-xs text-ink-dim">{card.description}</p>
            )}

            {sug && !card.description && (
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-ink-dim">+{formatInt(sug.predicted_lift.orders_delta)} заказов</span>
                <span className="text-amber">+{formatRUB(sug.predicted_lift.revenue_delta)}</span>
              </div>
            )}

            {/* chip row — audience first, then channels, then hashtags */}
            {(aud.length + channels.length + tags.length > 0) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {aud.slice(0, 2).map((a) => (
                  <span key={a} className="rounded-full border border-plum/30 bg-plum/10 px-1.5 py-0.5 text-[10px] text-plum">
                    {a}
                  </span>
                ))}
                {channels.slice(0, 3).map((c) => (
                  <span
                    key={c}
                    className="rounded border border-line bg-bg-elevated/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-mute"
                  >
                    {c}
                  </span>
                ))}
                {tags.slice(0, 2).map((h) => (
                  <span key={h} className="rounded-full border border-leaf/30 bg-leaf/10 px-1.5 py-0.5 text-[10px] text-leaf">
                    #{h.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </button>

        {/* quick-move actions, revealed on hover. stopPropagation prevents
            the parent button's onOpen from firing on these clicks. */}
        <div
          className="flex items-center justify-end gap-1 px-4 pb-3 opacity-0 transition group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
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
      </Card>
    </motion.div>
  );
}

function PriorityChip({ priority }: { priority: CardPriority }) {
  const map: Record<CardPriority, { label: string; tone: string }> = {
    low:    { label: "low",    tone: "border-line bg-bg-subtle text-ink-mute" },
    normal: { label: "normal", tone: "" }, // never rendered — caller filters
    high:   { label: "high",   tone: "border-amber/40 bg-amber/10 text-amber" },
    urgent: { label: "urgent", tone: "border-rust/40 bg-rust/10 text-rust" },
  };
  const c = map[priority];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
      c.tone,
    )}>
      {priority === "urgent" && <Flame className="h-2.5 w-2.5" />}
      {c.label}
    </span>
  );
}
