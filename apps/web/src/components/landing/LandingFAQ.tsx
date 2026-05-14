import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircleQuestion, Minus, Plus } from "lucide-react";

// =====================================================================
//  LandingFAQ — investor-ready Q&A. Custom accordion (no Radix) keeps
//  the dep footprint flat, gives full control over the editorial chrome
//  (numbered eyebrows, tone-tinted underlines, smallcaps section
//  header), and stays accessible via aria-expanded / aria-controls.
//  All 7 questions match the buckets the user spec'd.
// =====================================================================

interface QA {
  q: string;
  a: string;
  tone: "leaf" | "amber" | "plum" | "sky" | "rust";
}

const QAS: QA[] = [
  {
    q: "Как ИИ выбирает рекомендации?",
    a:
      "Четырёхслойный pipeline: пересечение тегов SKU и события → fallback по категории → " +
      "KNN по эмбеддингам (768-d, COSINE) → boost от ai-памяти (что фермер раньше принимал). " +
      "Никакой магии — каждое решение объясняется четырьмя числами, и их видно прямо в карточке.",
    tone: "leaf",
  },
  {
    q: "Что с приватностью данных?",
    a:
      "Каталоги SKU не покидают вашу инстанцию. Gemini получает только канонизированный текст " +
      "(«яблочный мёд 250 г, луговая пасека Подмосковье»), без цен, остатков и имён покупателей. " +
      "SurrealDB живёт на вашем сервере, эмбеддинги хранятся локально.",
    tone: "amber",
  },
  {
    q: "Откуда события и тренды?",
    a:
      "40+ событий курируются вручную: государственные, православные, сезонные, тематические. " +
      "Тренды подтягиваются из YAML-сидов и расширяются без рестарта. У каждого события есть " +
      "окно подготовки, целевые каналы и силы влияния на рекомендатор.",
    tone: "plum",
  },
  {
    q: "Можно ли редактировать AI-планы?",
    a:
      "Каждый AI-черновик — это draft. Редактируйте текст вручную, сохраняйте как новую версию " +
      "(история ревизий встроена), публикуйте или архивируйте. ИИ — стартовая точка, не финал. " +
      "Команда всегда остаётся в курсе через журнал активности на каждой карточке плана.",
    tone: "sky",
  },
  {
    q: "Как генерация соцсетей, блогов и историй работает?",
    a:
      "Один контентный движок, пять каналов с собственными промптами и формами тела: stories, " +
      "blogs, recipes, social, push. Каждый со своим редактором и предпросмотром — магазинная " +
      "вёрстка для блога, IG-tile с каруселью, lock-screen для push.",
    tone: "rust",
  },
  {
    q: "Как рекомендации адаптируются сезонно?",
    a:
      "12 сезонных окон и 5 трендов хранятся в графе как влияющие рёбра (`influences`, `covers`). " +
      "При построении календаря рекомендатель смотрит активные окна и применяет boost к подходящим " +
      "событиям. Сезон закончился — boost снят, без ручных правок.",
    tone: "leaf",
  },
  {
    q: "Подходит ли это маленьким фермам и локальным рынкам?",
    a:
      "Да, и это первичный кейс. Маленькому фермеру с 24 SKU система даёт то, на что у крупных " +
      "брендов уходит целый отдел: календарь, контент, каналы, ROI. Архитектурно — multi-tenant; " +
      "локально — один docker-compose up и сервис в эфире.",
    tone: "amber",
  },
];

export function LandingFAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative mx-auto max-w-4xl px-6 py-24">
      <header className="mb-10 text-center">
        <span className="smallcaps text-[11px] text-plum">
          <MessageCircleQuestion className="mr-1 inline h-3 w-3" />
          частые вопросы
        </span>
        <h2 className="mx-auto mt-2 max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
          Семь&nbsp;вопросов, которые мы слышим<br />
          <span className="gradient-text italic">— и&nbsp;прямые ответы</span>
        </h2>
      </header>

      <ul className="space-y-2">
        {QAS.map((qa, i) => {
          const isOpen = open === i;
          return (
            <motion.li
              key={qa.q}
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
                  {qa.q}
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
                      {qa.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ul>

      <p className="mt-10 text-center text-xs text-ink-mute">
        Ещё вопрос?{" "}
        <a
          href="mailto:hello@svoe-rodnoe.local"
          className="text-leaf underline-offset-4 hover:underline"
        >
          напишите команде
        </a>{" "}
        — отвечаем в течение дня.
      </p>
    </section>
  );
}
