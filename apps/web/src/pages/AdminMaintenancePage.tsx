import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  Power,
  Radio,
  RotateCcw,
  Wrench,
} from "lucide-react";

import {
  getMaintenance,
  setMaintenance,
  type MaintenanceConfig,
  type ReasonPreset,
} from "@/lib/api";
import { applyMaintenanceState } from "@/lib/maintenance";

// =====================================================================
//  AdminMaintenancePage — the kill-switch surface.
//
//  Lives at /admin/maintenance. The maintenance middleware whitelists
//  this path so an admin can disable the gate even when it's on.
//
//  Layout: a single tall card with three regions, each visually quiet
//  except the BIG state toggle at the top. Editorial-dusk aesthetic,
//  but with the same rust accent used in AdminLayout to signal
//  "privileged area." Reads close to AdminUsers in style.
// =====================================================================

type PresetDef = {
  value: ReasonPreset;
  ru: string;
  en: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PRESETS: PresetDef[] = [
  { value: "scheduled", ru: "Плановое обслуживание", en: "Scheduled maintenance", icon: Wrench },
  { value: "deploy", ru: "Обновление системы", en: "Deploying update", icon: Activity },
  { value: "migration", ru: "Миграция данных", en: "Database migration", icon: Database },
  { value: "incident", ru: "Инцидент", en: "Incident response", icon: AlertTriangle },
];

// ── helpers ─────────────────────────────────────────────────────────

// Format an absolute ISO timestamp into a `datetime-local` value (local
// timezone). Returns "" if input is missing — used as the form default.
function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Inverse — local input back to RFC3339 UTC string for the API. The
// browser already gives us a local-time string with no zone info, so
// `new Date(s)` interprets it as local correctly.
function localInputToISO(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

// ── component ──────────────────────────────────────────────────────

export function AdminMaintenancePage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-maintenance"],
    queryFn: getMaintenance,
    refetchInterval: 30_000,
  });

  // local form state — populated when the query lands. We don't bind
  // straight to q.data because the admin may be editing a draft.
  const [enabled, setEnabled] = useState(false);
  const [preset, setPreset] = useState<ReasonPreset>("scheduled");
  const [etaLocal, setEtaLocal] = useState("");
  const [messageRu, setMessageRu] = useState("");
  const [messageEn, setMessageEn] = useState("");

  // hydrate once when the query first resolves
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!q.data || hydrated) return;
    setEnabled(q.data.maintenance);
    setPreset((q.data.reason_preset ?? "scheduled") as ReasonPreset);
    setEtaLocal(isoToLocalInput(q.data.eta));
    setMessageRu(q.data.message_ru ?? "");
    setMessageEn(q.data.message_en ?? "");
    setHydrated(true);
  }, [q.data, hydrated]);

  const save = useMutation({
    mutationFn: () =>
      setMaintenance({
        enabled,
        reason_preset: preset,
        eta: etaLocal ? localInputToISO(etaLocal) : "",
        message_ru: messageRu,
        message_en: messageEn,
      }),
    onSuccess: (saved: MaintenanceConfig) => {
      qc.setQueryData(["admin-maintenance"], saved);
      // Stamp the new state into the global maintenance store so the
      // admin's OWN browser sees the result immediately — without this,
      // a freshly-enabled gate would only show after the next poll.
      applyMaintenanceState({
        maintenance: saved.maintenance,
        reason_preset: saved.reason_preset,
        eta: saved.eta,
        message_ru: saved.message_ru,
        message_en: saved.message_en,
      });
    },
  });

  // One-click "disable everything" — flips off without modifying preset/eta.
  const disable = useMutation({
    mutationFn: () => setMaintenance({ enabled: false }),
    onSuccess: (saved: MaintenanceConfig) => {
      qc.setQueryData(["admin-maintenance"], saved);
      setEnabled(false);
      applyMaintenanceState({
        maintenance: saved.maintenance,
        reason_preset: saved.reason_preset,
        eta: saved.eta,
        message_ru: saved.message_ru,
        message_en: saved.message_en,
      });
    },
  });

  // Diff vs server — drives the "save" button enabled state.
  const isDirty = useMemo(() => {
    if (!q.data) return false;
    return (
      enabled !== q.data.maintenance ||
      preset !== (q.data.reason_preset ?? "") ||
      etaLocal !== isoToLocalInput(q.data.eta) ||
      messageRu !== (q.data.message_ru ?? "") ||
      messageEn !== (q.data.message_en ?? "")
    );
  }, [q.data, enabled, preset, etaLocal, messageRu, messageEn]);

  const live = q.data?.maintenance === true;

  return (
    <div className="relative pb-16">
      {/* page header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="smallcaps text-[11px] text-ink-mute">
            аварийный переключатель
          </div>
          <h1 className="font-display text-3xl leading-tight">
            Режим обслуживания
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-dim">
            Включает экран «в&nbsp;обслуживании» для&nbsp;всех пользователей,
            включая администратора. Войти и&nbsp;выключить режим можно по&nbsp;
            <span className="font-mono text-xs text-amber">/admin/maintenance</span> —
            этот&nbsp;путь всегда открыт.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusPill live={live} />
        </div>
      </div>

      {/* primary control card */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-strong mt-8 rounded-2xl"
      >
        {/* top — the big switch */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/70 px-6 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setEnabled((v) => !v)}
              role="switch"
              aria-checked={enabled}
              className={`relative h-9 w-16 rounded-full border transition-colors focus-ring ${
                enabled
                  ? "border-rust/50 bg-rust/20"
                  : "border-line bg-bg-elevated/70"
              }`}
            >
              <span
                className={`absolute top-1 grid h-7 w-7 place-items-center rounded-full transition-all ${
                  enabled
                    ? "left-8 bg-rust text-bg shadow-glow"
                    : "left-1 bg-bg text-ink-mute"
                }`}
              >
                <Power className="h-3.5 w-3.5" />
              </span>
            </button>
            <div>
              <div className="smallcaps text-[10px] tracking-[0.18em] text-ink-mute">
                режим
              </div>
              <div className="font-display text-xl leading-tight">
                {enabled ? "Включён" : "Выключен"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => q.refetch()}
              disabled={q.isFetching}
              className="flex items-center gap-1.5 rounded-md border border-line bg-bg-elevated/60 px-3 py-2 text-xs text-ink-dim transition-colors hover:bg-bg-subtle disabled:opacity-50"
            >
              {q.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              <span>Обновить</span>
            </button>
            {live && (
              <button
                onClick={() => disable.mutate()}
                disabled={disable.isPending}
                className="flex items-center gap-1.5 rounded-md border border-leaf/40 bg-leaf/15 px-3 py-2 text-xs font-medium text-leaf transition-colors hover:bg-leaf/25"
              >
                {disable.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>Снять блокировку</span>
              </button>
            )}
          </div>
        </div>

        {/* preset picker */}
        <Section
          eyebrow="01 · причина"
          title="Шаблон сообщения"
          hint="Каждый пресет содержит готовый текст на&nbsp;двух языках. Текст можно переопределить ниже."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PRESETS.map((p) => (
              <PresetChip
                key={p.value}
                preset={p}
                active={preset === p.value}
                onClick={() => setPreset(p.value)}
              />
            ))}
          </div>
        </Section>

        {/* ETA */}
        <Section
          eyebrow="02 · возвращение"
          title="Ожидаемое время восстановления"
          hint="Локальное время. Отображается посетителям с&nbsp;живым обратным отсчётом. Оставьте пустым, если время неизвестно."
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="datetime-local"
              value={etaLocal}
              onChange={(e) => setEtaLocal(e.target.value)}
              className="rounded-md border border-line bg-bg-elevated/70 px-3 py-2 font-mono text-sm text-ink focus-ring"
            />
            {etaLocal && (
              <button
                onClick={() => setEtaLocal("")}
                className="text-xs text-ink-mute underline-offset-2 hover:text-ink hover:underline"
              >
                очистить
              </button>
            )}
          </div>
        </Section>

        {/* message overrides */}
        <Section
          eyebrow="03 · сообщение (необязательно)"
          title="Свой текст для пользователей"
          hint="Если поле пустое, используется стандартный текст пресета. Заполняйте отдельно RU и&nbsp;EN — каждый пользователь увидит свой язык."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MessageField
              flag="RU"
              value={messageRu}
              onChange={setMessageRu}
              placeholder="Например: возвращаемся в 16:30 МСК."
            />
            <MessageField
              flag="EN"
              value={messageEn}
              onChange={setMessageEn}
              placeholder="e.g. Back online by 16:30 MSK."
            />
          </div>
        </Section>

        {/* save bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-6 py-4">
          <div className="font-mono text-[10px] tracking-[0.18em] text-ink-mute">
            {q.data?.updated_at && (
              <span>
                ОБНОВЛЕНО{" "}
                {new Date(q.data.updated_at).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {q.data.updated_by_name ? ` · ${q.data.updated_by_name}` : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {save.isError && (
              <span className="text-xs text-rust">не удалось сохранить</span>
            )}
            <button
              onClick={() => save.mutate()}
              disabled={!isDirty || save.isPending}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                isDirty
                  ? "bg-leaf text-bg shadow-glow hover:brightness-110"
                  : "border border-line bg-bg-elevated/60 text-ink-mute"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Radio className="h-4 w-4" />
              )}
              <span>{enabled ? "Применить и включить" : "Сохранить"}</span>
            </button>
          </div>
        </div>
      </motion.section>

      {/* danger-zone note */}
      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-ink-mute">
        <span className="smallcaps text-rust">внимание</span> · после включения
        режима все запросы к&nbsp;API возвращают 503&nbsp;до&nbsp;тех пор, пока
        переключатель не&nbsp;будет выключен. Сессия администратора остаётся
        активной — этот раздел и&nbsp;логин всегда доступны.
      </p>
    </div>
  );
}

// ── primitives ──────────────────────────────────────────────────────

function Section({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line/60 px-6 py-6 last:border-b-0">
      <div className="smallcaps text-[10px] tracking-[0.22em] text-ink-mute">
        {eyebrow}
      </div>
      <div className="mt-1 font-display text-lg leading-tight">{title}</div>
      {hint && (
        <p
          className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-dim"
          dangerouslySetInnerHTML={{ __html: hint }}
        />
      )}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function PresetChip({
  preset,
  active,
  onClick,
}: {
  preset: PresetDef;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = preset.icon;
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all ${
        active
          ? "border-amber/60 bg-amber/10"
          : "border-line bg-bg-elevated/50 hover:border-ink-mute hover:bg-bg-elevated"
      }`}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-md transition-colors ${
          active
            ? "bg-amber/25 text-amber"
            : "bg-bg/70 text-ink-mute group-hover:text-ink-dim"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="text-sm font-medium leading-tight text-ink">
          {preset.ru}
        </div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          {preset.value}
        </div>
      </div>
      {active && (
        <span className="absolute right-2.5 top-2.5 inline-block h-1.5 w-1.5 rounded-full bg-amber shadow-[0_0_0_4px_hsl(var(--amber)/0.2)]" />
      )}
    </button>
  );
}

function MessageField({
  flag,
  value,
  onChange,
  placeholder,
}: {
  flag: string;
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded border border-line bg-bg-elevated/60 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.14em] text-ink-mute">
          {flag}
        </span>
        <span className="text-[11px] text-ink-mute tnum">
          {value.length}/280
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 280))}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-md border border-line bg-bg-elevated/60 px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus-ring"
      />
    </label>
  );
}

function StatusPill({ live }: { live: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
        live
          ? "border-rust/50 bg-rust/10 text-rust"
          : "border-leaf/40 bg-leaf/10 text-leaf"
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          live ? "animate-pulse bg-rust" : "bg-leaf"
        }`}
      />
      <span className="smallcaps tracking-[0.18em]">
        {live ? "режим активен" : "система в строю"}
      </span>
    </div>
  );
}
