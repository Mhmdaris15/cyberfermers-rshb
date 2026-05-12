import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, X, Loader2 } from "lucide-react";

import { Sheet, SheetBody, SheetFooter, SheetHeader } from "@/components/ui/sheet";
import { ContentTabs } from "@/components/action-card/ContentTabs";
import { RoiPanel } from "@/components/action-card/RoiPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";

import {
  addPlanCard,
  generateContent,
  listContent,
  persistSuggestion,
} from "@/lib/api";
import type { GeneratedContent, Suggestion } from "@/lib/types";
import { eventTypeMeta } from "@/lib/events";

interface ActionSheetProps {
  suggestion: Suggestion | null;
  farmerId: string;
  onClose: () => void;
}

// Drawer that exposes one suggestion: matched SKUs, ROI breakdown, per-channel
// generated content tabs, and the "add to plan" CTA. The suggestion may arrive
// transient (no id, served by /calendar) — we persist on-demand via
// `persistSuggestion` and keep the id in local state so we never mutate props.
export function ActionSheet({ suggestion, farmerId, onClose }: ActionSheetProps) {
  const open = !!suggestion;
  const qc = useQueryClient();
  const toast = useToast();

  // Local mirror of suggestion + its id; resets every time a new suggestion is
  // opened. This is the canonical place to hold the persisted-id transition.
  const [local, setLocal] = useState<Suggestion | null>(suggestion);
  const [content, setContent] = useState<GeneratedContent[]>([]);
  const [generating, setGenerating] = useState(false);
  const [persisting, setPersisting] = useState(false);

  // Reset state when a new suggestion opens. Don't blank `local` on close to
  // keep the fade-out smooth.
  useEffect(() => {
    if (suggestion) {
      setLocal(suggestion);
      setContent([]);
    }
  }, [suggestion]);

  // If we receive a suggestion that already has an id (e.g. from plan board
  // reopen), preload any existing generated content.
  useEffect(() => {
    const id = local?.id;
    if (!open || !id) return;
    listContent(id)
      .then(setContent)
      .catch(() => setContent([]));
  }, [open, local?.id]);

  if (!suggestion || !local) {
    return (
      <Sheet open={false} onOpenChange={onClose}>
        <div />
      </Sheet>
    );
  }

  const ev = local.event;
  const meta = ev ? eventTypeMeta[ev.type] : null;

  // Ensures the suggestion is persisted server-side. Returns the id.
  // Callers shouldn't mutate the prop — we update local state instead.
  async function ensurePersisted(): Promise<string> {
    if (local!.id) return local!.id;
    setPersisting(true);
    try {
      const saved = await persistSuggestion(farmerId, local!);
      setLocal(saved);
      return saved.id!;
    } finally {
      setPersisting(false);
    }
  }

  async function onGenerate() {
    setGenerating(true);
    try {
      const id = await ensurePersisted();
      const out = await generateContent(id);
      setContent(out);
      toast.success("Кампания сгенерирована", `${out.length} канал(а) готовы.`);
    } catch (e: any) {
      toast.error("Не удалось сгенерировать", e?.response?.data?.error ?? e?.message);
    } finally {
      setGenerating(false);
    }
  }

  async function onAddToPlan() {
    try {
      const id = await ensurePersisted();
      const sug = { ...local!, id };
      await addPlanCard({ farmer_id: farmerId, suggestion: sug, column: "planned" });
      qc.invalidateQueries({ queryKey: ["plan", farmerId] });
      toast.success("Добавлено в план", "Карточка в колонке «Запланировано».");
      onClose();
    } catch (e: any) {
      toast.error("Не удалось добавить в план", e?.response?.data?.error ?? e?.message);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose} side="right">
      <SheetHeader>
        <div className="flex items-start gap-3">
          {meta && (
            <span
              className="mt-1 h-3 w-3 shrink-0 rounded-full"
              style={{ background: ev?.color ?? `hsl(var(--${meta.color}))` }}
              aria-hidden
            />
          )}
          <div className="space-y-1">
            <Badge variant={(meta?.color as any) ?? "leaf"}>{meta?.label}</Badge>
            <h2 className="font-display text-2xl font-semibold tracking-tight">{ev?.title}</h2>
            <p className="text-xs text-ink-mute">
              {new Date(local.date_window_start).toLocaleDateString("ru-RU")} —{" "}
              {new Date(local.date_window_end).toLocaleDateString("ru-RU")} ·{" "}
              {local.channels.join(" · ")}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
          <X className="h-4 w-4" />
        </Button>
      </SheetHeader>

      <SheetBody>
        <div className="space-y-6">
          {/* Matched SKUs */}
          <section>
            <h4 className="mb-2 text-xs uppercase tracking-widest text-ink-mute">
              Подобранные SKU ({(local.products ?? []).length})
            </h4>
            {(local.products ?? []).length === 0 ? (
              <p className="text-sm text-ink-mute">Нет товаров под это событие.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {(local.products ?? []).map((p) => (
                  <div key={p.id} className="glass flex items-center gap-3 rounded-lg p-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-bg-elevated text-xs uppercase text-ink-mute">
                      {p.category.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-[11px] text-ink-mute">{p.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* ROI panel */}
          <section>
            <h4 className="mb-2 text-xs uppercase tracking-widest text-ink-mute">Прогноз</h4>
            <RoiPanel lift={local.predicted_lift} />
          </section>

          <Separator />

          {/* Generated content tabs */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-widest text-ink-mute">Контент по каналам</h4>
              <Button size="sm" onClick={onGenerate} disabled={generating || persisting}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Генерируем…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Сгенерировать кампанию
                  </>
                )}
              </Button>
            </div>
            <ContentTabs content={content} loading={generating} />
          </section>
        </div>
      </SheetBody>

      <SheetFooter>
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={onAddToPlan} disabled={persisting}>
          {persisting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Добавить в план
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
