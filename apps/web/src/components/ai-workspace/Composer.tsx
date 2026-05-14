import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, SendHorizontal } from "lucide-react";

import { matchSlash, type SlashCommand } from "@/lib/ai-workspace";

// =====================================================================
//  Composer — sticky-bottom textarea with `/`-triggered command palette.
//
//  Two behaviours that distinguish this from a plain chat input:
//
//    1. When the draft starts with `/`, a popover appears with the
//       matching slash commands. Arrow keys + Enter pick. Tab + click
//       also work.
//    2. Enter submits; Shift+Enter inserts a newline. The textarea
//       grows up to 5 lines, then scrolls.
//
//  The component is intentionally stateless about the AI conversation
//  — it just emits onSubmit(text) and onSlash(cmd, arg). The page
//  decides what each command means.
// =====================================================================

interface Props {
  onSubmit: (text: string) => void;
  onSlash: (cmd: SlashCommand, arg: string) => void;
  /** Disables the composer (e.g. while a turn is in flight). */
  disabled?: boolean;
  /** External value injection — e.g. when StarterRail picks a chip.
   *  Setting this triggers an auto-submit on the next tick. */
  injected?: string;
  onInjectedConsumed?: () => void;
}

export function Composer({
  onSubmit, onSlash, disabled, injected, onInjectedConsumed,
}: Props) {
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState(0); // palette cursor
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to ~5 lines (120px), then scroll.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(120, ta.scrollHeight) + "px";
  }, [draft]);

  // When the parent injects a starter prompt, we set the draft AND
  // submit on the next tick. The textarea briefly shows the prompt so
  // the user sees what's being sent.
  useEffect(() => {
    if (!injected) return;
    setDraft(injected);
    const t = window.setTimeout(() => {
      onSubmit(injected.trim());
      setDraft("");
      onInjectedConsumed?.();
    }, 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injected]);

  const slashHits = matchSlash(draft);
  const paletteOpen = slashHits.length > 0;

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("/")) {
      const head = trimmed.split(/\s/)[0].toLowerCase();
      const arg = trimmed.slice(head.length).trim();
      const exact = matchSlash(head);
      if (exact.length > 0) {
        onSlash(exact[0], arg);
        setDraft("");
        return;
      }
    }
    onSubmit(trimmed);
    setDraft("");
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (paletteOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => (i + 1) % slashHits.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => (i - 1 + slashHits.length) % slashHits.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const cmd = slashHits[selected];
        const head = draft.split(/\s/)[0].toLowerCase();
        if (cmd && head === cmd.trigger) {
          // exact match — fire it
          const arg = draft.slice(head.length).trim();
          onSlash(cmd, arg);
          setDraft("");
        } else if (cmd) {
          // autocomplete the trigger into the draft and append a
          // trailing space so the operator can type the arg
          setDraft(cmd.trigger + (cmd.takesArg ? " " : ""));
        }
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(draft);
    }
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    submit(draft);
  }

  // Reset the palette cursor when the candidate set changes.
  useEffect(() => {
    setSelected(0);
  }, [slashHits.length]);

  return (
    <div className="relative border-t border-line bg-bg/85 px-4 py-3 backdrop-blur">
      <form onSubmit={onFormSubmit} className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            disabled={disabled}
            rows={1}
            placeholder="Спросите ИИ или нажмите / для команд…"
            className="w-full resize-none rounded-2xl border border-line bg-bg-elevated px-4 py-2.5 pr-12 text-sm leading-relaxed focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30 disabled:opacity-60"
          />
          <span className="pointer-events-none absolute bottom-2.5 right-3.5 inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-ink-mute">
            <CornerDownLeft className="h-2.5 w-2.5" />
            enter
          </span>

          <AnimatePresence>
            {paletteOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full left-0 right-0 z-10 mb-1 overflow-hidden rounded-xl border border-line bg-bg-elevated/95 backdrop-blur shadow-glass"
              >
                <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-ink-mute">
                  команды
                </div>
                <ul className="max-h-60 overflow-y-auto pb-1">
                  {slashHits.map((c, i) => {
                    const Icon = c.Icon;
                    const active = i === selected;
                    return (
                      <li key={c.trigger}>
                        <button
                          type="button"
                          onMouseEnter={() => setSelected(i)}
                          onClick={() => {
                            // Insert trigger + space; let the operator
                            // fill the arg (or fire immediately if no arg).
                            if (c.takesArg) {
                              setDraft(c.trigger + " ");
                              taRef.current?.focus();
                            } else {
                              onSlash(c, "");
                              setDraft("");
                            }
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                            active ? "bg-leaf/10 text-leaf" : "text-ink-dim hover:bg-bg-subtle hover:text-ink"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="flex-1">
                            <span className="font-mono text-[12px]">{c.trigger}</span>
                            <span className="ml-2 text-[11px] text-ink-mute">— {c.label}</span>
                          </span>
                          {c.takesArg && (
                            <span className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono text-[9px] text-ink-mute">
                              &lt;arg&gt;
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-leaf text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
          aria-label="Отправить"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
