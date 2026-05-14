import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Globe } from "lucide-react";
import { useTolgee, useTranslate } from "@tolgee/react";

import { type Lang, SUPPORTED_LANGS, persistLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// =====================================================================
//  LanguageSwitcher — editorial RU/EN pill with a popover panel.
//
//  Variants:
//    "pill"    (default) — full glyph + label, fits in app header & topbar
//    "compact" — circle, two-letter code, for mobile/dense rails
//
//  Behavior:
//    - Click toggles a small popover
//    - Selecting a language: changes Tolgee runtime + persists to LS +
//      cookie + <html lang>, all via persistLanguage()
//    - Esc / outside-click closes
//    - Keyboard-navigable (Enter/Space toggles, items focusable)
// =====================================================================

const SHORT: Record<Lang, string> = { ru: "RU", en: "EN" };

interface Props {
  variant?: "pill" | "compact";
  className?: string;
}

export function LanguageSwitcher({ variant = "pill", className }: Props) {
  const { t } = useTranslate();
  const tolgee = useTolgee(["language"]);
  const current = (tolgee.getLanguage() as Lang | undefined) ?? "ru";

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // close on outside-click / Esc
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function pick(lang: Lang) {
    if (lang !== current) {
      await tolgee.changeLanguage(lang);
      persistLanguage(lang);
    }
    setOpen(false);
  }

  const isCompact = variant === "compact";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("lang.switcher.label")}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-md border border-line bg-bg-elevated/60 text-ink-dim transition-colors hover:border-leaf/40 hover:text-ink focus-ring",
          isCompact ? "h-8 w-8 justify-center" : "px-2.5 py-1.5",
        )}
      >
        <Globe className={cn("h-3.5 w-3.5", isCompact ? "" : "text-leaf")} />
        {!isCompact && (
          <span className="font-mono text-[11px] font-medium tabular-nums tracking-wider">
            {SHORT[current]}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.14, ease: [0.2, 0.65, 0.2, 1] }}
            className="glass-strong absolute right-0 top-full z-50 mt-1.5 min-w-[160px] overflow-hidden rounded-xl border border-line shadow-glass"
          >
            <li className="border-b border-line/40 px-3 py-2 text-[10px] uppercase tracking-widest text-ink-mute">
              {t("lang.switcher.label")}
            </li>
            {SUPPORTED_LANGS.map((lang) => {
              const active = lang === current;
              return (
                <li key={lang} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => pick(lang)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-bg-subtle text-ink"
                        : "text-ink-dim hover:bg-bg-subtle hover:text-ink",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                        {SHORT[lang]}
                      </span>
                      <span>{t(`lang.${lang}`)}</span>
                    </span>
                    {active && <Check className="h-3.5 w-3.5 text-leaf" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
