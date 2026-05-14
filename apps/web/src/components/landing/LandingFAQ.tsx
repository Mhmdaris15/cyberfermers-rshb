import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslate } from "@tolgee/react";
import { MessageCircleQuestion, Minus, Plus } from "lucide-react";

// =====================================================================
//  LandingFAQ — investor-ready Q&A. Custom accordion (no Radix) keeps
//  the dep footprint flat, gives full control over the editorial chrome
//  (numbered eyebrows, tone-tinted underlines, smallcaps section
//  header), and stays accessible via aria-expanded / aria-controls.
//  All 7 questions match the buckets the user spec'd.
// =====================================================================

interface QA {
  qKey: string;
  aKey: string;
  tone: "leaf" | "amber" | "plum" | "sky" | "rust";
}

const QAS: QA[] = [
  { qKey: "faq.q1.q", aKey: "faq.q1.a", tone: "leaf" },
  { qKey: "faq.q2.q", aKey: "faq.q2.a", tone: "amber" },
  { qKey: "faq.q3.q", aKey: "faq.q3.a", tone: "plum" },
  { qKey: "faq.q4.q", aKey: "faq.q4.a", tone: "sky" },
  { qKey: "faq.q5.q", aKey: "faq.q5.a", tone: "rust" },
  { qKey: "faq.q6.q", aKey: "faq.q6.a", tone: "leaf" },
  { qKey: "faq.q7.q", aKey: "faq.q7.a", tone: "amber" },
];

export function LandingFAQ() {
  const { t } = useTranslate();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative mx-auto max-w-4xl px-6 py-24">
      <header className="mb-10 text-center">
        <span className="smallcaps text-[11px] text-plum">
          <MessageCircleQuestion className="mr-1 inline h-3 w-3" />
          {t("faq.eyebrow")}
        </span>
        <h2 className="mx-auto mt-2 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
          {t("faq.title.line1")}<br />
          <span className="gradient-text italic">{t("faq.title.line2")}</span>
        </h2>
      </header>

      <ul className="space-y-2">
        {QAS.map((qa, i) => {
          const isOpen = open === i;
          return (
            <motion.li
              key={qa.qKey}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className={`glass overflow-hidden rounded-2xl border transition-colors ${
                isOpen ? "border-leaf/40" : "border-line/60 hover:border-ink-mute/40"
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="group flex w-full items-center gap-4 px-5 py-4 text-left focus-ring"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md font-mono text-[11px] tabular-nums"
                  style={{
                    background: isOpen
                      ? `hsl(var(--${qa.tone}) / 0.15)`
                      : "hsl(var(--bg-subtle))",
                    color: isOpen ? `hsl(var(--${qa.tone}))` : "hsl(var(--ink-mute))",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-display text-lg font-semibold leading-snug text-ink">
                  {t(qa.qKey)}
                </span>
                <motion.span
                  initial={false}
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.18 }}
                  className="shrink-0 text-ink-mute group-hover:text-ink"
                >
                  {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`faq-panel-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.2, 0.65, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pl-[4.5rem] text-sm leading-relaxed text-ink-dim">
                      <div
                        className="mb-3 h-px w-12"
                        style={{ background: `hsl(var(--${qa.tone}))` }}
                      />
                      {t(qa.aKey)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ul>

      <p className="mt-10 text-center text-xs text-ink-mute">
        {t("faq.contact")}{" "}
        <a
          href="mailto:hello@svoe-rodnoe.local"
          className="text-leaf underline-offset-4 hover:underline"
        >
          {t("faq.contact.link")}
        </a>{" "}
        {t("faq.contact.suffix")}
      </p>
    </section>
  );
}
