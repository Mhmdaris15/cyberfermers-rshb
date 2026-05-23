import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Hourglass,
  Radio,
  Wrench,
} from "lucide-react";

import { LANG_STORAGE_KEY, type Lang } from "@/lib/i18n";
import { type SystemStatus } from "@/lib/api";

// =====================================================================
//  MaintenanceScreen — the global gate.
//
//  Design direction: status console at the blue hour. A vast dusk
//  field with a tiny telemetry card floating in it. Fraunces serif
//  headline anchors the emotion; IBM Plex Mono carries the data;
//  a single amber heartbeat dot signals "we're still here."
//
//  This component is SELF-CONTAINED — it reads language from
//  localStorage rather than the Tolgee tree so it can render at the
//  very root of the app (and even outside the React Query tree).
//
//  Use it inside a wrapper that branches on useMaintenance().
// =====================================================================

// ── language plumbing ─────────────────────────────────────────────────
// Read once at mount; the gate is short-lived so we don't subscribe.
function readLang(): Lang {
  if (typeof window === "undefined") return "ru";
  const raw = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (raw === "en" || raw === "ru") return raw;
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "ru";
}

// ── preset metadata (RU + EN copy bundled inline) ────────────────────

type PresetMeta = {
  icon: React.ComponentType<{ className?: string }>;
  tone: "amber" | "leaf" | "sky" | "rust" | "plum";
  label: { ru: string; en: string };
  message: { ru: string; en: string };
};

const PRESETS: Record<string, PresetMeta> = {
  "": {
    icon: Wrench,
    tone: "amber",
    label: { ru: "обслуживание", en: "maintenance" },
    message: {
      ru: "Мы временно недоступны. Скоро всё заработает.",
      en: "We're briefly offline. The system will be back shortly.",
    },
  },
  scheduled: {
    icon: Wrench,
    tone: "amber",
    label: { ru: "плановое обслуживание", en: "scheduled maintenance" },
    message: {
      ru: "Мы проводим плановое обслуживание системы. Каталоги, календарь и AI-инструменты вернутся к работе в указанное время.",
      en: "We're performing scheduled maintenance. Catalogs, calendar and AI tools will be back at the listed time.",
    },
  },
  deploy: {
    icon: Activity,
    tone: "leaf",
    label: { ru: "обновление системы", en: "deploying update" },
    message: {
      ru: "Раскатываем свежую версию. Это занимает несколько минут — спасибо за терпение.",
      en: "Rolling out a fresh build. This takes a few minutes — thanks for your patience.",
    },
  },
  migration: {
    icon: Database,
    tone: "sky",
    label: { ru: "миграция данных", en: "database migration" },
    message: {
      ru: "Переносим данные на новую инфраструктуру. Записи в безопасности; интерфейс вернётся, как только миграция завершится.",
      en: "Migrating data to new infrastructure. Records are safe; the interface returns the moment migration completes.",
    },
  },
  incident: {
    icon: AlertTriangle,
    tone: "rust",
    label: { ru: "технический инцидент", en: "incident response" },
    message: {
      ru: "Решаем технический инцидент. Команда уже работает над восстановлением — следите за обновлениями.",
      en: "We're investigating a technical incident. The team is on it — watch this page for updates.",
    },
  },
};

const STRINGS = {
  eyebrow: {
    ru: "система временно недоступна",
    en: "system temporarily unavailable",
  },
  title: {
    ru: "В обслуживании",
    en: "Under maintenance",
  },
  fields: {
    status: { ru: "СТАТУС", en: "STATUS" },
    reason: { ru: "ПРИЧИНА", en: "REASON" },
    started: { ru: "С", en: "SINCE" },
    eta: { ru: "ДО", en: "ETA" },
  },
  statusValue: {
    ru: "офлайн",
    en: "offline",
  },
  refresh: {
    ru: "Обновлять автоматически",
    en: "Auto-refreshing",
  },
  adminCta: {
    ru: "Войти как администратор",
    en: "Sign in as admin",
  },
  signature: {
    ru: "Свое Родное · Календарь",
    en: "Svoe Rodnoe · Calendar",
  },
  noEta: {
    ru: "не указано",
    en: "not specified",
  },
};

// ── small helpers ─────────────────────────────────────────────────────

function pickMessage(preset: string, lang: Lang, override?: string): string {
  const o = override?.trim();
  if (o) return o;
  return PRESETS[preset]?.message[lang] ?? PRESETS[""].message[lang];
}

function formatDateLine(d: Date, lang: Lang): string {
  // Tight, monospace-friendly "DD MMM · HH:MM" format. Locale-aware month
  // abbreviations but no comma noise so it sits well next to keys in
  // the telemetry strip.
  const fmt = new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(d).replace(",", " ·").toUpperCase();
}

// Compact countdown like "02:14:09" for ETA within 24h, else "3d 04h".
function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  if (days >= 1) {
    const hours = Math.floor((totalSec % 86400) / 3600);
    return `${days}d ${String(hours).padStart(2, "0")}h`;
  }
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

// ── component ─────────────────────────────────────────────────────────

export function MaintenanceScreen({ state }: { state: SystemStatus }) {
  const [lang] = useState<Lang>(() => readLang());
  const preset = (state.reason_preset ?? "") as keyof typeof PRESETS;
  const meta = PRESETS[preset] ?? PRESETS[""];
  const Icon = meta.icon;

  // Started-at heuristic: we don't actually persist a "started_at" field
  // (the toggle row only stores updated_at), so we mount-stamp on first
  // render. Visually accurate for "began some time ago" — within a few
  // seconds of when the user first hit the gate. Avoids leaking the real
  // toggle moment to anonymous visitors.
  const [startedAt] = useState(() => new Date());
  const eta = useMemo(() => (state.eta ? new Date(state.eta) : null), [state.eta]);

  // Live countdown ticker. Cheap — 1s setInterval, no React Query, no
  // Date.now() recomputation cascades. We only re-render this one node.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = eta ? eta.getTime() - now : null;

  // Tone → CSS HSL var name. Single source for the accent color used
  // throughout the card (heartbeat, divider, hairline rule).
  const toneVar = `--${meta.tone}`;

  return (
    <div className="relative min-h-screen overflow-hidden text-ink">
      {/* layered backdrop — dusk gradients + a faint grid floor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(60rem 40rem at 18% -10%, hsl(var(${toneVar}) / 0.18), transparent 60%),
            radial-gradient(55rem 38rem at 100% 110%, hsl(var(--plum) / 0.10), transparent 60%),
            radial-gradient(40rem 30rem at -10% 80%, hsl(var(--sky) / 0.06), transparent 60%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] mix-blend-overlay"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--line) / 0.45) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--line) / 0.45) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(60rem 40rem at 50% 60%, rgba(0,0,0,0.8), transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(60rem 40rem at 50% 60%, rgba(0,0,0,0.8), transparent 70%)",
        }}
      />

      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-6 w-6 place-items-center rounded-md border border-line bg-bg-elevated/60"
            style={{ color: `hsl(var(${toneVar}))` }}
          >
            <Radio className="h-3 w-3" />
          </span>
          <span className="smallcaps text-[10px] tracking-[0.18em] text-ink-mute">
            {STRINGS.signature[lang]}
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-line bg-bg-elevated/60 px-3 py-1 text-[10px] text-ink-mute tnum">
          <Hourglass className="h-3 w-3" />
          <span className="smallcaps tracking-[0.18em]">
            {STRINGS.refresh[lang]}
          </span>
        </div>
      </header>

      {/* main composition */}
      <main className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-16 pt-10 sm:px-10 sm:pt-16">
        {/* eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="smallcaps text-[11px] tracking-[0.32em] text-ink-mute"
        >
          {STRINGS.eyebrow[lang]}
        </motion.div>

        {/* hero headline — Fraunces, dramatically optical-sized */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="font-display mt-5 text-balance text-center text-[clamp(2.75rem,8vw,5.5rem)] font-medium leading-[1.02] tracking-tight"
          style={{
            fontVariationSettings: '"opsz" 144, "SOFT" 80, "WONK" 1',
          }}
        >
          {STRINGS.title[lang]}
          <span
            aria-hidden
            className="ml-3 inline-block h-[0.55em] w-[0.55em] translate-y-[-0.08em] rounded-full"
            style={{
              background: `hsl(var(${toneVar}))`,
              boxShadow: `0 0 0 6px hsl(var(${toneVar}) / 0.18), 0 0 24px hsl(var(${toneVar}) / 0.55)`,
              animation: "maint-heart 1.6s ease-in-out infinite",
            }}
          />
        </motion.h1>

        {/* message paragraph */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mx-auto mt-7 max-w-xl text-balance text-center text-base leading-relaxed text-ink-dim sm:text-[17px]"
        >
          {pickMessage(preset, lang, lang === "ru" ? state.message_ru : state.message_en)}
        </motion.p>

        {/* telemetry card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="glass-strong relative mt-12 w-full max-w-3xl overflow-hidden rounded-2xl"
        >
          {/* scan line — sweeps once every 8s */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, hsl(var(${toneVar}) / 0.7), transparent)`,
              animation: "maint-scan 8s linear infinite",
            }}
          />

          {/* header strip */}
          <div className="flex items-center justify-between border-b border-line/70 bg-bg/30 px-5 py-3">
            <div className="flex items-center gap-2">
              <span
                className="grid h-7 w-7 place-items-center rounded-md"
                style={{
                  background: `hsl(var(${toneVar}) / 0.14)`,
                  color: `hsl(var(${toneVar}))`,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="smallcaps text-[10px] tracking-[0.22em] text-ink-mute">
                telemetry
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-ink-mute">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: `hsl(var(${toneVar}))`,
                  animation: "maint-heart 1.6s ease-in-out infinite",
                }}
              />
              <span>live · v1</span>
            </div>
          </div>

          {/* fields grid */}
          <dl className="grid grid-cols-1 divide-y divide-line/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {/* status */}
            <Cell
              label={STRINGS.fields.status[lang]}
              value={STRINGS.statusValue[lang].toUpperCase()}
              accent={toneVar}
            />
            {/* reason */}
            <Cell
              label={STRINGS.fields.reason[lang]}
              value={meta.label[lang].toUpperCase()}
            />
            {/* started */}
            <Cell
              label={STRINGS.fields.started[lang]}
              value={formatDateLine(startedAt, lang)}
            />
            {/* eta */}
            <Cell
              label={STRINGS.fields.eta[lang]}
              value={
                eta
                  ? `${formatDateLine(eta, lang)}  ·  −${formatCountdown(remaining ?? 0)}`
                  : STRINGS.noEta[lang].toUpperCase()
              }
              accent={eta && remaining !== null && remaining > 0 ? toneVar : undefined}
            />
          </dl>

          {/* indeterminate progress hairline at the bottom */}
          <div className="relative h-[3px] overflow-hidden bg-bg/40">
            <div
              className="absolute inset-y-0 w-1/3"
              style={{
                background: `linear-gradient(90deg, transparent, hsl(var(${toneVar})), transparent)`,
                animation: "maint-progress 3.2s ease-in-out infinite",
              }}
            />
          </div>
        </motion.section>

        {/* footer actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm"
        >
          <a
            href="/admin/maintenance"
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-bg-elevated/60 px-4 py-2 text-ink-dim transition-colors hover:border-ink-mute hover:text-ink"
          >
            <span>{STRINGS.adminCta[lang]}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </motion.div>
      </main>

      {/* local keyframes — kept inside the component so the page is fully
          self-contained and doesn't pollute globals.css with one-off names. */}
      <style>{`
        @keyframes maint-heart {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(0.78); opacity: 0.55; }
        }
        @keyframes maint-scan {
          0%   { transform: translateY(0); opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(420px); opacity: 0; }
        }
        @keyframes maint-progress {
          0%   { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

// ── primitive ────────────────────────────────────────────────────────

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-5 sm:py-6">
      <dt className="font-mono text-[10px] tracking-[0.22em] text-ink-mute">
        {label}
      </dt>
      <dd
        className="font-mono text-sm tracking-[0.04em] tnum"
        style={accent ? { color: `hsl(var(${accent}))` } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
