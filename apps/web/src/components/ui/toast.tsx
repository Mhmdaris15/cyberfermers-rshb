import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Minimal toast system. No Radix dep — we own the UX and the surface area
// is small enough that a 50-line component is the right scope here.

type ToastKind = "info" | "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  /** auto-dismiss after `ttl` ms; default 4000. Pass 0 to make it sticky. */
  ttl?: number;
}

interface ToastCtx {
  push: (t: Omit<ToastItem, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used under <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = Date.now() + Math.random();
      const item: ToastItem = { ttl: 4000, ...t, id };
      setItems((xs) => [...xs, item]);
      if (item.ttl && item.ttl > 0) {
        setTimeout(() => remove(id), item.ttl);
      }
    },
    [remove],
  );

  const api = useMemo<ToastCtx>(
    () => ({
      push,
      success: (title, message) => push({ kind: "success", title, message }),
      error: (title, message) => push({ kind: "error", title, message, ttl: 6000 }),
      info: (title, message) => push({ kind: "info", title, message }),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={cn(
                "glass-strong pointer-events-auto flex max-w-md gap-3 rounded-xl px-4 py-3 shadow-glass",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
                  t.kind === "error" && "bg-rust/15 text-rust",
                  t.kind === "success" && "bg-leaf/15 text-leaf",
                  t.kind === "info" && "bg-sky/15 text-sky",
                )}
              >
                {t.kind === "error" && <AlertCircle className="h-3.5 w-3.5" />}
                {t.kind === "success" && <CheckCircle2 className="h-3.5 w-3.5" />}
                {t.kind === "info" && <Info className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1 leading-snug">
                <div className="text-sm font-medium">{t.title}</div>
                {t.message && <div className="mt-0.5 text-xs text-ink-dim">{t.message}</div>}
              </div>
              <button
                onClick={() => remove(t.id)}
                aria-label="Закрыть"
                className="text-ink-mute hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
