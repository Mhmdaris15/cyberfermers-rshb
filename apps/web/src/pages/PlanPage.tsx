import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPlan, movePlanCard } from "@/lib/api";
import { PlanBoard } from "@/components/plan-board/PlanBoard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { PlanCard } from "@/lib/types";

export function PlanPage() {
  const { farmerId = "10060" } = useParams();
  const qc = useQueryClient();
  const toast = useToast();

  const plan = useQuery({ queryKey: ["plan", farmerId], queryFn: () => getPlan(farmerId) });

  const move = useMutation({
    mutationFn: movePlanCard,
    // Optimistic update: snapshot the current board, mutate the card immediately,
    // and roll back on error. Cuts perceived latency to zero on drag.
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ["plan", farmerId] });
      const prev = qc.getQueryData<Record<string, PlanCard[]>>(["plan", farmerId]);
      if (prev) {
        const next: Record<string, PlanCard[]> = { proposed: [], planned: [], live: [], completed: [] };
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
        qc.setQueryData(["plan", farmerId], next);
      }
      return { prev };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.prev) qc.setQueryData(["plan", farmerId], ctx.prev);
      toast.error("Не удалось перенести карточку");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["plan", farmerId] }),
  });

  const total = Object.values(plan.data ?? {}).reduce((s, c) => s + (c?.length ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">План кампаний</h1>
          <p className="text-sm text-ink-dim">
            Перетаскивайте карточки внутри колонки или нажимайте «→» для смены колонки.
          </p>
        </div>
        <Badge variant="outline">{total} карточек</Badge>
      </div>
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
        />
      )}
    </div>
  );
}
