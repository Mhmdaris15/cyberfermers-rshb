import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Bot, Loader2, MessageSquare, Send, Sparkles, X } from "lucide-react";

import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { chatTurn, type ChatAction, type ChatMessage } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

// =================================================================
//  ChatSheet — grounded Q&A drawer. Floating launcher in the bottom-
//  right corner of every farmer page. The model can only answer
//  through the 5 tools exposed by the chat service; no free-form.
// =================================================================

interface ChatSheetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface UiMessage extends ChatMessage {
  id: number;
  pending?: boolean;
  actions?: ChatAction[];
  used?: string[];
}

const STARTER_CHIPS = [
  "Какие события у меня в ближайшие 30 дней?",
  "Какие SKU подходят к Пасхе?",
  "Что AI думает о моём каталоге?",
  "Что если поднять скидку на ягодный сезон до 15%?",
  "Какие каналы я не использую?",
];

export function ChatSheet({ open, onOpenChange }: ChatSheetProps) {
  const { farmerId = "10060" } = useParams();
  const toast = useToast();
  const [items, setItems] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new message.
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [items]);

  // Focus input when sheet opens.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setDraft("");
    setBusy(true);

    const id = Date.now();
    setItems((prev) => [
      ...prev,
      { id, role: "user", text: trimmed },
      { id: id + 1, role: "assistant", text: "", pending: true },
    ]);

    try {
      const history = items
        .filter((m) => !m.pending)
        .map(({ role, text }) => ({ role, text }) as ChatMessage);
      const reply = await chatTurn(farmerId, trimmed, history);
      setItems((prev) =>
        prev.map((m) =>
          m.id === id + 1
            ? { ...m, text: reply.text, pending: false, actions: reply.actions, used: reply.used }
            : m,
        ),
      );
    } catch (e: any) {
      setItems((prev) =>
        prev.map((m) =>
          m.id === id + 1
            ? { ...m, text: "Не удалось получить ответ. Попробуйте ещё раз.", pending: false }
            : m,
        ),
      );
      toast.error("Ошибка чата", e?.response?.data?.error ?? e?.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="right">
      <SheetHeader>
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-leaf/40 bg-leaf-soft/40 text-leaf">
            <Bot className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <div className="smallcaps text-[10px] text-leaf">AI-ассистент</div>
            <h2 className="font-display text-xl font-semibold leading-tight tracking-tight">
              О каталоге и календаре
            </h2>
          </div>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="text-ink-mute hover:text-ink"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </SheetHeader>

      <SheetBody className="flex flex-col gap-4">
        <div ref={scrollerRef} className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <EmptyChat onPick={send} />
          ) : (
            <AnimatePresence initial={false}>
              {items.map((m) => (
                <Bubble key={m.id} m={m} />
              ))}
            </AnimatePresence>
          )}
        </div>

        <Composer
          inputRef={inputRef}
          value={draft}
          onChange={setDraft}
          onSend={() => send(draft)}
          busy={busy}
        />
      </SheetBody>
    </Sheet>
  );
}

function Bubble({ m }: { m: UiMessage }) {
  const isUser = m.role === "user";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "rounded-br-sm bg-leaf-soft/40 text-ink"
            : "rounded-tl-sm border border-line bg-bg-elevated text-ink",
        )}
      >
        {m.pending ? (
          <span className="inline-flex items-center gap-2 text-ink-dim">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            думаю…
          </span>
        ) : (
          <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
        )}
        {!m.pending && m.used && m.used.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {m.used.map((t) => (
              <span
                key={t}
                className="rounded-md border border-line bg-bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-mute"
                title="Инструмент, которым ассистент воспользовался"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {!m.pending && m.actions && m.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {m.actions.map((a) => (
              <Link
                key={a.href}
                to={a.href}
                className="inline-flex items-center gap-1 rounded-full border border-leaf/40 bg-leaf-soft/30 px-2.5 py-1 text-[11px] text-leaf hover:bg-leaf-soft/50 focus-ring"
              >
                {a.label}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Composer({
  inputRef,
  value,
  onChange,
  onSend,
  busy,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (s: string) => void;
  onSend: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-end gap-2 border-t border-line/70 pt-3">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="Спросите про события, SKU, каналы…"
        rows={2}
        className="flex-1 resize-none rounded-lg border border-line bg-bg-elevated/60 px-3 py-2 text-sm placeholder:text-ink-mute focus-ring"
      />
      <button
        onClick={onSend}
        disabled={busy || !value.trim()}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-leaf text-bg shadow-glow disabled:opacity-50 focus-ring"
        aria-label="Отправить"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </div>
  );
}

function EmptyChat({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-line bg-bg-elevated text-leaf">
        <Sparkles className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">Спросите AI</h3>
        <p className="mt-1 text-sm text-ink-dim">
          Ответы опираются только на ваш каталог, события и план кампаний. Никаких выдумок.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        {STARTER_CHIPS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="rounded-full border border-line bg-bg-elevated/60 px-3 py-1.5 text-xs text-ink-dim hover:border-leaf/40 hover:text-ink focus-ring"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- floating launcher ------------------------------------------

export function ChatLauncher({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.4 }}
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-leaf/40 bg-bg-elevated px-4 py-3 text-sm font-medium text-ink shadow-glow hover:bg-leaf-soft/40 focus-ring"
      aria-label="Открыть AI-ассистент"
    >
      <MessageSquare className="h-4 w-4 text-leaf" />
      <span>Спросить AI</span>
    </motion.button>
  );
}
