import { Sparkles } from "lucide-react";
import type { CalendarEvent } from "@/lib/types";
import { eventTypeMeta } from "@/lib/events";
import { plural } from "@/lib/utils";

interface EventExplainProps {
  event: CalendarEvent;
}

// =================================================================
//  EventExplain — "Why this matters" paragraph rendered above the
//  matched SKUs in the ActionSheet. Generated deterministically
//  from event metadata; no LLM call needed.
//
//  Choosing template-over-LLM here matters: every event in our KB
//  has structured `themes` + `audience` + `type_detail`, so the
//  paragraph is always grounded and never hallucinated.
// =================================================================
export function EventExplain({ event }: EventExplainProps) {
  const meta = eventTypeMeta[event.type];
  const audCopy = audienceCopy(event.audience ?? []);
  const themeCopy = (event.themes ?? []).slice(0, 2).join(" · ");
  const prep = event.prep_window_days ?? 7;

  return (
    <div className="glass relative overflow-hidden rounded-xl px-4 py-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl"
        style={{ background: event.color ?? `hsl(var(--${meta.color}))` }}
      />
      <div className="relative flex flex-col gap-2">
        <div className="flex items-center gap-2 smallcaps text-[10px] text-leaf">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Почему это важно</span>
        </div>
        <p className="text-sm leading-relaxed text-ink">{narrative(event, prep)}</p>
        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-ink-mute">
          <Fact label="Тип события" value={meta.label} />
          {event.type_detail && <Fact label="Деталь" value={prettyDetail(event.type_detail)} />}
          <Fact
            label="Окно прогрева"
            value={`${prep} ${plural(prep, ["день", "дня", "дней"])}`}
          />
          {audCopy && <Fact label="Целевая аудитория" value={audCopy} />}
          {themeCopy && <Fact label="Темы" value={themeCopy} />}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="smallcaps text-[9px] text-ink-mute">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

// --- narrative templates --------------------------------------------

function narrative(event: CalendarEvent, prep: number): string {
  const audPart = audPhrase(event.audience ?? []);
  const themePart = (event.themes ?? []).slice(0, 2).join(", ");

  switch (event.type) {
    case "holiday":
      if (event.type_detail === "religious_orthodox") {
        return `«${event.title}» — крупный православный праздник. Целевая аудитория ${audPart} закупается заранее, поэтому продвижение стоит начинать за ${prep} ${plural(prep, ["день", "дня", "дней"])}. Сильные темы: ${themePart || "праздничный стол, подарки"}.`;
      }
      return `«${event.title}» — традиционно сильный праздничный пик. ${audPart} активно покупает за ${prep} ${plural(prep, ["день", "дня", "дней"])} до даты. Сезонные темы: ${themePart || "праздничный стол, подарки"}.`;

    case "season":
      if (event.type_detail === "fasting") {
        return `Пост: спрос смещается на постные продукты. Мясо, молочные и яйца под жёстким запретом. Сосредоточьтесь на бобовых, грибах, овощах, орехах. Окно прогрева: ${prep} ${plural(prep, ["день", "дня", "дней"])}.`;
      }
      return `Сезонное окно «${event.title}» открывает новую категорию продуктов. ${audPart} ищет свежие, локальные ингредиенты. Темы для постов: ${themePart || "сезонные рецепты, свежий урожай"}.`;

    case "themed_week":
      return `Тематическая неделя «${event.title}» — отличный повод собрать кросс-сейл подборку. Аудитория: ${audPart}. Используйте бандлы и связки товаров; ${themePart ? `темы: ${themePart}.` : "темы подбирайте под подборку."}`;

    case "trend":
      return `Тренд маркетплейса «${event.title}». Это управляемое событие — пушим витрину и push-уведомления синхронно с маркетингом площадки. Прогрев: ${prep} ${plural(prep, ["день", "дня", "дней"])}.`;

    case "professional":
      return `Профессиональный/тематический день «${event.title}». Хорошо отрабатывают премиальные SKU и подарочные наборы. Аудитория: ${audPart}.`;
  }
  return event.title;
}

function audPhrase(aud: string[]): string {
  if (aud.length === 0) return "наша основная аудитория";
  return audienceCopy(aud);
}

function audienceCopy(aud: string[]): string {
  const map: Record<string, string> = {
    healthy: "ЗОЖ-аудитория",
    parents: "осознанные родители",
    gourmets: "гурманы",
    gift_buyers: "покупатели подарков",
    students: "студенты",
  };
  const labels = aud.map((a) => map[a] ?? a).slice(0, 3);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} и ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} и ${labels[labels.length - 1]}`;
}

function prettyDetail(d: string): string {
  return ({
    secular_state: "Государственный",
    religious_orthodox: "Православный",
    cultural: "Культурный",
    traditional: "Традиционный",
    fasting: "Пост",
    spring: "Весна",
    summer: "Лето",
    autumn: "Осень",
    winter: "Зима",
  } as Record<string, string>)[d] ?? d;
}
