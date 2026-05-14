import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, FilePlus, Loader2 } from "lucide-react";

import { saveAs, SAVE_TARGETS, type SaveKind } from "@/lib/ai-workspace";

// =====================================================================
//  SaveAsMenu — the move that ties the workspace into the rest of the
//  platform-OS. One click turns the current AI message into a draft in
//  any content module (Stories / Blogs / Recipes / Social / Push).
//  After save: optimistic toast-feel, invalidate caches across all
//  module + plan queries, hand the parent a click-to-navigate route.
// =====================================================================

interface Props {
  farmerID: string;
  text: string;
  onSaved?: (route: string, label: string) => void;
}

export function SaveAsMenu({ farmerID, text, onSaved }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<SaveKind | null>(null);

  const m = useMutation({
    mutationFn: (kind: SaveKind) => {
      setPendingKind(kind);
      return saveAs(farmerID, kind, text);
    },
    onSettled: () => setPendingKind(null),
    onSuccess: (res) => {
      // Cross-cutting cache invalidation — every module list might now
      // include the new draft, and the plan board has a new card too.
      qc.invalidateQueries({ queryKey: [pluralFor(res.kind), farmerID] });
      qc.invalidateQueries({ queryKey: ["plan", farmerID] });
      qc.invalidateQueries({ queryKey: ["boards", farmerID] });
      const target = SAVE_TARGETS.find((t) => t.kind === res.kind);
      onSaved?.(res.route, target?.label ?? "Контент");
      setOpen(false);
    },
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
        title="Сохранить как контент"
      >
        <FilePlus className="h-3 w-3" />
        Сохранить как
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* invisible backdrop catches outside clicks */}
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full left-0 z-40 mb-1 w-48 overflow-hidden rounded-xl border border-line bg-bg-elevated/95 shadow-glass backdrop-blur"
            >
              <div className="border-b border-line/40 px-3 py-2 text-[10px] uppercase tracking-widest text-ink-mute">
                Сохранить как
              </div>
              <ul className="py-1">
                {SAVE_TARGETS.map((t) => {
                  const Icon = t.Icon;
                  const isPending = pendingKind === t.kind;
                  return (
                    <li key={t.kind}>
                      <button
                        onClick={() => m.mutate(t.kind)}
                        disabled={m.isPending}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-dim transition-colors hover:bg-bg-subtle hover:text-ink disabled:opacity-50"
                      >
                        {isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: `hsl(var(--${t.tone}))` }} />
                          : <Icon className="h-3.5 w-3.5" style={{ color: `hsl(var(--${t.tone}))` }} />}
                        <span>{t.label}</span>
                        {m.isSuccess && pendingKind === null && (
                          <Check className="ml-auto h-3 w-3 text-leaf" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Maps a SaveKind to the React Query cache key its module page uses.
// Keep in sync with ListFarmer{Stories,Blogs,Recipes,SocialPosts,Pushes}.
function pluralFor(kind: SaveKind): string {
  switch (kind) {
    case "story":  return "stories";
    case "blog":   return "blogs";
    case "recipe": return "recipes";
    case "social": return "social";
    case "push":   return "push";
  }
}
