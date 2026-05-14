import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight, Check, Copy, Loader2, RefreshCw, Sparkles, User,
} from "lucide-react";

import type { WorkspaceMessage } from "@/lib/ai-workspace";
import { SaveAsMenu } from "./SaveAsMenu";

// =====================================================================
//  Conversation — scrollable message list with role distinction and
//  per-message AI actions (copy / regenerate / save-as).
//
//  Visual: user messages are right-aligned chip with "ты →" leading
//  mono prefix; assistant messages are full-width glass cards with
//  "ИИ →" Fraunces prefix and a shimmer rail during streaming.
//  Action chips on the assistant message link to /stories etc. when
//  the BE response carries `actions`.
// =====================================================================

interface Props {
  messages: WorkspaceMessage[];
  farmerID: string;
  /** True while a turn is in flight — adds a fake-typing assistant
   *  bubble at the end of the list. */
  pending: boolean;
  /** Called when the user hits "Повторить" on the most recent
   *  assistant message; the page re-fires the previous user message. */
  onRegenerate: () => void;
  /** Called after a successful save-as — typically just a toast or
   *  invalidation, but we let the page own that decision. */
  onSaved?: (route: string, label: string) => void;
}

export function Conversation({
  messages, farmerID, pending, onRegenerate, onSaved,
}: Props) {
  // Auto-scroll the conversation to the latest message whenever the
  // list changes. The ref points at a sentinel after the last bubble.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  if (messages.length === 0 && !pending) {
    return <EmptyState />;
  }

  // Identify the most recent assistant message so only it gets the
  // "Повторить" affordance (regenerating earlier ones would be
  // confusing without proper thread semantics).
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 360, damping: 30 }}
            >
              {m.role === "user"
                ? <UserBubble text={m.text} />
                : (
                  <AssistantBubble
                    msg={m}
                    farmerID={farmerID}
                    isLatest={i === lastAssistantIdx}
                    onRegenerate={onRegenerate}
                    onSaved={onSaved}
                  />
                )}
            </motion.div>
          ))}
        </AnimatePresence>

        {pending && <AssistantTyping />}

        <div ref={endRef} />
      </div>
    </div>
  );
}

// ─── bubbles ──────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto flex max-w-[80%] items-start gap-2.5">
      <div className="min-w-0 flex-1">
        <div className="inline-flex max-w-full items-center gap-1.5 rounded-2xl rounded-br-md border border-leaf/30 bg-leaf-soft/40 px-3.5 py-2 text-sm leading-relaxed text-ink shadow-sm">
          <span className="whitespace-pre-line">{text}</span>
        </div>
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-ink-mute">
          <User className="h-2.5 w-2.5" />
          <span>ты</span>
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({
  msg, farmerID, isLatest, onRegenerate, onSaved,
}: {
  msg: WorkspaceMessage;
  farmerID: string;
  isLatest: boolean;
  onRegenerate: () => void;
  onSaved?: (route: string, label: string) => void;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-leaf to-amber text-bg shadow-glow">
        <Sparkles className="h-3 w-3" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="glass rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed text-ink">
          <RenderText text={msg.text} farmerID={farmerID} />

          {/* BE-provided deep-link actions (e.g. "Открыть события") */}
          {msg.actions && msg.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/40 pt-2.5">
              {msg.actions.map((a, i) => (
                <Link
                  key={i}
                  to={a.href}
                  className="inline-flex items-center gap-1 rounded-full border border-leaf/30 bg-leaf/10 px-2 py-0.5 text-[10px] text-leaf transition-colors hover:bg-leaf/15"
                >
                  {a.label}
                  <ArrowUpRight className="h-2.5 w-2.5" />
                </Link>
              ))}
            </div>
          )}

          {msg.used && msg.used.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-ink-mute">
              <span>tools:</span>
              {msg.used.map((t) => (
                <code key={t} className="rounded bg-bg-subtle px-1 py-px font-mono text-[9px]">
                  {t}
                </code>
              ))}
            </div>
          )}
        </div>

        {/* per-message action row */}
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-mute">
          <span className="smallcaps">ИИ</span>
          <span>·</span>
          <CopyButton text={msg.text} />
          {isLatest && (
            <button
              onClick={onRegenerate}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
              title="Повторить ответ"
            >
              <RefreshCw className="h-3 w-3" />
              Повторить
            </button>
          )}
          <SaveAsMenu
            farmerID={farmerID}
            text={msg.text}
            onSaved={onSaved}
          />
        </div>
      </div>
    </div>
  );
}

function AssistantTyping() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-leaf to-amber text-bg shadow-glow">
        <Sparkles className="h-3 w-3 animate-pulse" />
      </div>
      <div className="glass inline-flex items-center gap-2 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-ink-dim">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-leaf" />
        <span className="smallcaps text-[10px]">ИИ думает…</span>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      const btn = ref.current;
      if (!btn) return;
      const old = btn.dataset.label ?? "";
      btn.dataset.label = "Скопировано";
      window.setTimeout(() => {
        if (btn) btn.dataset.label = old;
      }, 1200);
    });
  }
  return (
    <button
      ref={ref}
      onClick={copy}
      data-label="Копировать"
      className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
      title="Копировать"
    >
      <span className="hidden group-data-[label='Скопировано']:inline">
        <Check className="h-3 w-3 text-leaf" />
      </span>
      <span className="group-data-[label='Скопировано']:hidden">
        <Copy className="h-3 w-3" />
      </span>
      <span className="group-data-[label='Скопировано']:text-leaf">
        {/* fallback label — actual text comes from data-label */}
        <span className="group-data-[label='Скопировано']:hidden">Копировать</span>
        <span className="hidden group-data-[label='Скопировано']:inline">Скопировано</span>
      </span>
    </button>
  );
}

// ─── reference-chip parser ────────────────────────────────────────────

/** Simple parser for the `[[chip:label|/route]]` micro-syntax. Splits
 *  the AI text into plain runs and React-rendered chip links. Falls
 *  back to plain-text rendering if no chips are present. */
function RenderText({ text, farmerID }: { text: string; farmerID: string }) {
  void farmerID; // reserved for future per-farmer chip resolution
  const re = /\[\[chip:([^|\]]+)(?:\|([^\]]+))?\]\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) {
      parts.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    }
    const label = m[1].trim();
    const href = m[2]?.trim();
    if (href) {
      parts.push(
        <Link
          key={key++}
          to={href}
          className="mx-0.5 inline-flex items-center gap-0.5 rounded border border-leaf/30 bg-leaf/10 px-1.5 py-0 text-[12px] text-leaf transition-colors hover:bg-leaf/15"
        >
          {label}
          <ArrowUpRight className="h-2.5 w-2.5" />
        </Link>,
      );
    } else {
      parts.push(
        <span key={key++} className="mx-0.5 rounded border border-line bg-bg-subtle px-1 py-0 text-[12px] text-ink-dim">
          {label}
        </span>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(<span key={key++}>{text.slice(last)}</span>);
  }
  if (parts.length === 0) {
    return <span className="whitespace-pre-line">{text}</span>;
  }
  return <span className="whitespace-pre-line">{parts}</span>;
}

// ─── empty state ──────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-leaf to-amber shadow-glow">
        <Sparkles className="h-6 w-6 text-bg" />
      </div>
      <h2 className="mt-6 font-display text-2xl">Чистый лист</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        Слева — заготовки запросов по&nbsp;четырём темам. Начните одной
        фразой&nbsp;— ИИ&nbsp;знает ваш каталог, события, прошлые кампании
        и&nbsp;ai-память фермы.
      </p>
      <p className="mt-3 text-[11px] text-ink-mute">
        Подсказка: введите{" "}
        <code className="rounded bg-bg-subtle px-1 py-px font-mono">/</code> в&nbsp;поле
        ввода — откроется палитра команд.
      </p>
    </div>
  );
}
