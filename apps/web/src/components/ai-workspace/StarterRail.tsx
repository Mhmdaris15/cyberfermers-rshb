import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { STARTER_PACKS } from "@/lib/ai-workspace";

// =====================================================================
//  StarterRail — left rail with categorised seed prompts.
//
//  Editorial intent: this is the "first move" surface. The farmer
//  lands on the workspace and immediately sees four categories of
//  what they could ask, not a blank prompt. Each chip is a one-tap
//  launch — clicking inserts the prompt into the composer and fires
//  the turn.
// =====================================================================

interface Props {
  /** Called when the user picks a starter chip — should populate the
   *  composer and submit immediately. */
  onPick: (prompt: string) => void;
  /** Disabled while a turn is in flight so the user can't queue up
   *  three turns by clicking three chips. */
  disabled?: boolean;
}

export function StarterRail({ onPick, disabled }: Props) {
  return (
    <aside className="hidden w-60 shrink-0 self-start lg:block">
      <div className="px-3 pb-2 pt-1">
        <div className="smallcaps text-[10px] text-ink-mute">тематические запросы</div>
        <h2 className="mt-1 inline-flex items-center gap-1.5 font-display text-base font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-amber" />
          С чего начать
        </h2>
      </div>
      <div className="space-y-3 px-1">
        {STARTER_PACKS.map((pack) => {
          const Icon = pack.icon;
          return (
            <section key={pack.title}>
              <div
                className="mb-1.5 flex items-center gap-1.5 px-2 text-[10px] uppercase tracking-widest"
                style={{ color: `hsl(var(--${pack.tone}))` }}
              >
                <Icon className="h-3 w-3" />
                {pack.title}
              </div>
              <div className="space-y-1">
                {pack.prompts.map((p) => (
                  <motion.button
                    key={p}
                    type="button"
                    onClick={() => onPick(p)}
                    disabled={disabled}
                    whileHover={!disabled ? { x: 2 } : undefined}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="block w-full rounded-md border border-line/60 bg-bg-elevated/40 px-2.5 py-1.5 text-left text-[11px] leading-snug text-ink-dim transition-colors hover:border-ink-mute/40 hover:bg-bg-subtle hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {p}
                  </motion.button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
