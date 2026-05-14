import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { movePlanCard } from "@/lib/api";
import { BOARDS, getPlan, listBoards } from "@/lib/plan";
import { PlanBoard } from "@/components/plan-board/PlanBoard";
import { BoardSwitcher } from "@/components/plan-board/BoardSwitcher";
import { CardDetailDrawer } from "@/components/plan-board/CardDetailDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import type { BoardType, PlanCard } from "@/lib/types";

// =====================================================================
//  PlanPage — Phase-3 layout: left-rail board switcher + column grid +
//  right-side detail drawer. The active board lives in the URL
//  (`?board=<type>`) so deep links to a specific pipeline work and
//  back/forward navigation behaves the way the user expects.
// =====================================================================

export function PlanPage() {
  const { farmerId = "10060" } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [drawerCardID, setDrawerCardID] = useState<string | null>(null);

  // URL is the source of truth for the active board so the back button +
  // sharing links work. `null` = "all boards" (the unfiltered view).
  const activeBoard: BoardType | null = useMemo(() => {
    const v = params.get("board");
    if (!v) return null;
    if (BOARDS.some((b) => b.type === v)) return v as BoardType;
    return null;
  }, [params]);

  const setActiveBoard = (b: BoardType | null) => {
    const next = new URLSearchParams(params);
    if (b) next.set("board", b);
    else next.delete("board");
    setParams(next, { replace: true });
  };

  const plan = useQuery({
    queryKey: ["plan", farmerId, activeBoard ?? "all"],
    queryFn: () => getPlan(farmerId, activeBoard ?? undefined),
  });

  const boards = useQuery({
    queryKey: ["boards", farmerId],
    queryFn: () => listBoards(farmerId),
    staleTime: 30_000,
  });

  const move = useMutation({
    mutationFn: movePlanCard,
    onMutate: async (payload) => {
      const key = ["plan", farmerId, activeBoard ?? "all"];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Record<string, PlanCard[]>>(key);
      if (prev) {
        const next: Record<string, PlanCard[]> = {
          proposed: [], planned: [], live: [], completed: [],
        };
        let moved: PlanCard | undefined;
        for (const col of Object.keys(prev)) {
          for (const c of prev[col]) {
            if (c.id === payload.card_id) {
              moved = { ...c, column: payload.column as PlanCard["column"], position: payload.position };
            } else {
              next[col].push(c);
            }
          }
        }
        if (moved) {
          const target = next[payload.column] ?? (next[payload.column] = []);
          target.splice(payload.position, 0, moved);
        }
        qc.setQueryData(key, next);
      }
      return { prev };
    },
    onError: (_err, _payload, ctx) => {
      const key = ["plan", farmerId, activeBoard ?? "all"];
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error("Не удалось перенести карточку");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["plan", farmerId, activeBoard ?? "all"] });
      qc.invalidateQueries({ queryKey: ["boards", farmerId] });
    },
  });

  const total = Object.values(plan.data ?? {}).reduce((s, c) => s + (c?.length ?? 0), 0);
  const activeMeta = activeBoard ? BOARDS.find((b) => b.type === activeBoard) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <BoardSwitcher
        active={activeBoard}
        summaries={boards.data ?? []}
        onChange={setActiveBoard}
      />

      <div className="min-w-0 space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
          <div>
            <div className="smallcaps text-[10px] text-ink-mute">план кампаний</div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {activeMeta ? activeMeta.label : "Все доски"}
            </h1>
            <p className="text-sm text-ink-dim">
              {activeMeta
                ? "Карточки этой доски. Перетаскивайте между колонками или откройте детальный вид."
                : "Все ваши карточки во всех пайплайнах. Слева выберите конкретную доску для фильтра."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-md border border-line bg-bg-elevated px-2.5 py-1.5 text-xs">
              <span className="font-display text-base tabular-nums">{total}</span>
              <span className="ml-1 smallcaps text-[9px] text-ink-mute">всего</span>
            </div>
          </div>
        </header>

        {plan.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : (
          <PlanBoard
            board={plan.data ?? {}}
            onMove={(card, column, position) => {
              if (!card.id) return;
              move.mutate({
                card_id: card.id,
                farmer_id: farmerId,
                suggestion_id: card.suggestion_id,
                column,
                position,
              });
            }}
            onOpen={(card) => card.id && setDrawerCardID(card.id)}
          />
        )}
      </div>

      <CardDetailDrawer
        cardID={drawerCardID}
        farmerID={farmerId}
        onClose={() => setDrawerCardID(null)}
      />
    </div>
  );
}
