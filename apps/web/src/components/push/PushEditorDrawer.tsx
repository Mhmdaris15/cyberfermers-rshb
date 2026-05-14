import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, BellRing, CalendarClock, Check, ExternalLink,
  Flame, Image as ImageIcon, Loader2, Smartphone, Tablet, X,
} from "lucide-react";

import { ContentLifecycleBar } from "@/components/action-card/ContentLifecycleBar";
import { updateContent } from "@/lib/content";
import {
  createFarmerPush, getPush, pushBodyText, pushDispatchStatus,
  pushDispatchSentAt, pushHeadline, pushIconEmoji, pushScheduledFor,
  pushSegments, pushUrgency, PUSH_LIMITS, SEGMENTS, URGENCY_META,
  type PushBody, type Urgency,
} from "@/lib/push";
import type { GeneratedContent } from "@/lib/types";

// =====================================================================
//  PushEditorDrawer — short structured form + device-style preview.
//
//  Left pane: title (internal), emoji + headline + body with LIVE
//  iOS/Android visible-char meters, deep link, urgency picker,
//  segment chips, scheduled_for, preview image URL.
//
//  Right pane: lock-screen previews with iOS / Android tabs. The
//  iOS preview renders a real notification card (app icon left,
//  headline+body right, timestamp top-right, dismiss handle). The
//  Android preview uses the heads-up shade style.
// =====================================================================

interface Props {
  pushID: string | null | "new";
  farmerID: string;
  onClose: () => void;
}

export function PushEditorDrawer({ pushID, farmerID, onClose }: Props) {
  return (
    <AnimatePresence>
      {pushID && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl flex-col border-l border-line bg-bg shadow-glass"
          >
            {pushID === "new"
              ? <CreateFlow farmerID={farmerID} onClose={onClose} />
              : <EditFlow pushID={pushID} farmerID={farmerID} onClose={onClose} />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── form state ────────────────────────────────────────────────────────

function usePushForm() {
  const [title, setTitle] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [icon, setIcon] = useState("🐝");
  const [deepLink, setDeepLink] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const [segments, setSegments] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  return {
    title, setTitle, headline, setHeadline, body, setBody, icon, setIcon,
    deepLink, setDeepLink, urgency, setUrgency, segments, setSegments,
    scheduledFor, setScheduledFor, previewImage, setPreviewImage,
  };
}
type FormState = ReturnType<typeof usePushForm>;

function buildBody(f: FormState): Record<string, unknown> {
  const out: Record<string, unknown> = {
    title: f.title.trim(),
    headline: f.headline.trim(),
    body: f.body.trim(),
    icon_emoji: f.icon.trim() || undefined,
    deep_link: f.deepLink.trim() || undefined,
    urgency: f.urgency,
    segments: f.segments,
    preview_image_url: f.previewImage.trim() || undefined,
  };
  if (f.scheduledFor) {
    const d = new Date(f.scheduledFor);
    if (!Number.isNaN(d.getTime())) out.scheduled_for = d.toISOString();
  }
  return out;
}

// ─── create flow ───────────────────────────────────────────────────────

function CreateFlow({ farmerID, onClose }: { farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const f = usePushForm();

  const m = useMutation({
    mutationFn: () => {
      const body = buildBody(f);
      return createFarmerPush(farmerID, {
        title: body.title as string,
        headline: body.headline as string,
        body: body.body as string,
        icon_emoji: body.icon_emoji as string | undefined,
        deep_link: body.deep_link as string | undefined,
        urgency: body.urgency as Urgency,
        segments: body.segments as string[],
        preview_image_url: body.preview_image_url as string | undefined,
        scheduled_for: body.scheduled_for as string | undefined,
        create_plan_card: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["push", farmerID] });
      qc.invalidateQueries({ queryKey: ["plan", farmerID] });
      qc.invalidateQueries({ queryKey: ["boards", farmerID] });
      onClose();
    },
  });

  return (
    <Shell onClose={onClose} title={f.headline.trim() || "Новый push"} eyebrow="новое уведомление">
      <SplitEditor f={f} />
      <Footer>
        {m.isError && <FootMsg tone="rust">ошибка</FootMsg>}
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !f.title.trim() || !f.headline.trim() || !f.body.trim()}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          Создать push
        </button>
      </Footer>
    </Shell>
  );
}

// ─── edit flow ─────────────────────────────────────────────────────────

function EditFlow({ pushID, farmerID, onClose }: { pushID: string; farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["push-row", pushID], queryFn: () => getPush(pushID) });
  const f = usePushForm();

  useEffect(() => {
    if (!q.data) return;
    const b = (q.data.body as PushBody | undefined) ?? {};
    f.setTitle(b.title ?? pushHeadline(q.data));
    f.setHeadline(pushHeadline(q.data));
    f.setBody(pushBodyText(q.data));
    f.setIcon(pushIconEmoji(q.data));
    f.setDeepLink(b.deep_link ?? "");
    f.setUrgency(pushUrgency(q.data));
    f.setSegments(pushSegments(q.data));
    const sched = pushScheduledFor(q.data);
    f.setScheduledFor(sched ? toLocalISO(sched) : "");
    f.setPreviewImage(b.preview_image_url ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const m = useMutation({
    mutationFn: () => updateContent(pushID, { body: buildBody(f), note: "правка push" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["push-row", pushID] });
      qc.invalidateQueries({ queryKey: ["push", farmerID] });
    },
  });

  if (q.isLoading || !q.data) {
    return (
      <Shell onClose={onClose} title="..." eyebrow="загружаю">
        <div className="grid h-full place-items-center p-10 text-sm text-ink-mute">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      onClose={onClose}
      title={pushHeadline(q.data)}
      eyebrow={q.data.is_user_edited ? "push · автор" : "push · AI"}
    >
      <DispatchBanner content={q.data} />
      <SplitEditor f={f} />

      <div className="border-t border-line bg-bg-elevated/30 px-6 pb-2 pt-1">
        <ContentLifecycleBar
          content={q.data}
          onChange={() => {
            qc.invalidateQueries({ queryKey: ["push-row", pushID] });
            qc.invalidateQueries({ queryKey: ["push", farmerID] });
          }}
        />
      </div>

      <Footer>
        {m.isSuccess && <FootMsg tone="leaf">сохранено как новая версия</FootMsg>}
        {m.isError && <FootMsg tone="rust">ошибка</FootMsg>}
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !f.headline.trim() || !f.body.trim()}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Сохранить
        </button>
      </Footer>
    </Shell>
  );
}

// Banner that surfaces the dispatch state at the top of the edit drawer
// so the operator knows whether a push has already been "sent" by the
// scheduler (in which case editing the headline doesn't unsend it).
function DispatchBanner({ content }: { content: GeneratedContent }) {
  const status = pushDispatchStatus(content);
  const sentAt = pushDispatchSentAt(content);
  if (status === "queued") return null;
  if (status === "sent" && sentAt) {
    return (
      <div className="border-b border-leaf/30 bg-leaf/10 px-6 py-2 text-xs text-leaf">
        <Check className="mr-1 inline h-3 w-3" />
        Push отправлен {sentAt.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.
        Изменения текста не отзовут уже отправленное уведомление.
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="border-b border-rust/30 bg-rust/10 px-6 py-2 text-xs text-rust">
        <AlertTriangle className="mr-1 inline h-3 w-3" />
        Отправка не удалась. Сохраните изменения и&nbsp;запланируйте повтор.
      </div>
    );
  }
  return null;
}

// ─── split editor ──────────────────────────────────────────────────────

function SplitEditor({ f }: { f: FormState }) {
  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
      <FormColumn f={f} />
      <PreviewColumn f={f} />
    </div>
  );
}

function FormColumn({ f }: { f: FormState }) {
  const iosHeadOver = Math.max(0, f.headline.length - PUSH_LIMITS.ios.headline);
  const iosBodyOver = Math.max(0, f.body.length - PUSH_LIMITS.ios.body);
  const andHeadOver = Math.max(0, f.headline.length - PUSH_LIMITS.android.headline);
  const andBodyOver = Math.max(0, f.body.length - PUSH_LIMITS.android.body);

  function toggleSegment(slug: string) {
    f.setSegments(
      f.segments.includes(slug)
        ? f.segments.filter((s) => s !== slug)
        : [...f.segments, slug],
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Название (внутреннее)" hint="Не показывается пользователю">
        <input
          value={f.title}
          onChange={(e) => f.setTitle(e.target.value)}
          placeholder="Анонс акции к&nbsp;Медовому Спасу"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-end gap-2">
        <Field label="Иконка">
          <input
            value={f.icon}
            onChange={(e) => f.setIcon(e.target.value.slice(0, 2))}
            placeholder="🐝"
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-center text-base focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>
        <Field
          label={
            <span className="inline-flex items-center gap-2">
              Заголовок
              <CharBudget over={iosHeadOver} limit={PUSH_LIMITS.ios.headline} platform="iOS" len={f.headline.length} />
              <CharBudget over={andHeadOver} limit={PUSH_LIMITS.android.headline} platform="Android" len={f.headline.length} />
            </span>
          }
        >
          <input
            value={f.headline}
            onChange={(e) => f.setHeadline(e.target.value)}
            placeholder="Свежий мёд приехал!"
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm font-semibold focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>
      </div>

      <Field
        label={
          <span className="inline-flex items-center gap-2">
            Текст
            <CharBudget over={iosBodyOver} limit={PUSH_LIMITS.ios.body} platform="iOS" len={f.body.length} />
            <CharBudget over={andBodyOver} limit={PUSH_LIMITS.android.body} platform="Android" len={f.body.length} />
          </span>
        }
      >
        <textarea
          value={f.body}
          onChange={(e) => f.setBody(e.target.value)}
          rows={3}
          placeholder="Партия лугового мёда уже&nbsp;в&nbsp;магазине. Первым&nbsp;— скидка 15%."
          className="w-full resize-y rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm leading-relaxed focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      <Field label="Deep link" icon={<ExternalLink className="h-3 w-3" />}>
        <input
          value={f.deepLink}
          onChange={(e) => f.setDeepLink(e.target.value)}
          placeholder="svoerodnoe://catalog/honey/luge-2026"
          spellCheck={false}
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 font-mono text-xs focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      {/* urgency picker */}
      <div>
        <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-ink-mute">
          Срочность
        </label>
        <div className="flex gap-1">
          {(["normal", "high", "critical"] as Urgency[]).map((u) => {
            const meta = URGENCY_META[u];
            const active = f.urgency === u;
            return (
              <button
                key={u}
                type="button"
                onClick={() => f.setUrgency(u)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] transition-colors ${
                  active ? meta.tone : "border-line text-ink-mute hover:bg-bg-subtle"
                }`}
              >
                {u === "critical" ? <Flame className="h-3 w-3" /> : <BellRing className="h-3 w-3" />}
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* segments multi-select */}
      <div>
        <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-ink-mute">
          Сегменты
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SEGMENTS.map((s) => {
            const active = f.segments.includes(s.slug);
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => toggleSegment(s.slug)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? "border-plum/60 bg-plum/15 text-plum"
                    : "border-line bg-bg-elevated text-ink-mute hover:bg-bg-subtle"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {f.segments.length === 0 && (
          <p className="mt-1 text-[10px] text-ink-mute">
            Без сегментов = широковещательно по всей базе.
          </p>
        )}
      </div>

      <Field label="Запланировать на" icon={<CalendarClock className="h-3 w-3" />} hint="Пусто = опубликовать вручную. Планировщик ищет cron-задачи каждые 30&nbsp;сек.">
        <input
          type="datetime-local"
          value={f.scheduledFor}
          onChange={(e) => f.setScheduledFor(e.target.value)}
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      <Field label="URL обложки (rich push)" icon={<ImageIcon className="h-3 w-3" />}>
        <input
          value={f.previewImage}
          onChange={(e) => f.setPreviewImage(e.target.value)}
          placeholder="https://example.com/honey.jpg"
          spellCheck={false}
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 font-mono text-xs focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>
    </div>
  );
}

// ─── preview column — iOS / Android tabs ──────────────────────────────

function PreviewColumn({ f }: { f: FormState }) {
  const [tab, setTab] = useState<"ios" | "android">("ios");
  return (
    <aside className="sticky top-4 flex h-fit flex-col gap-3 self-start">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setTab("ios")}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition-colors ${
            tab === "ios"
              ? "border-leaf/60 bg-leaf/10 text-leaf"
              : "border-line bg-bg-elevated text-ink-mute hover:bg-bg-subtle"
          }`}
        >
          <Smartphone className="h-3 w-3" />
          iOS lock screen
        </button>
        <button
          onClick={() => setTab("android")}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition-colors ${
            tab === "android"
              ? "border-leaf/60 bg-leaf/10 text-leaf"
              : "border-line bg-bg-elevated text-ink-mute hover:bg-bg-subtle"
          }`}
        >
          <Tablet className="h-3 w-3" />
          Android
        </button>
      </div>

      {tab === "ios" ? <IosPreview f={f} /> : <AndroidPreview f={f} />}

      {f.scheduledFor && (
        <div className="rounded-md border border-sky/30 bg-sky/10 px-3 py-2 text-[11px] text-sky">
          <CalendarClock className="mr-1 inline h-3 w-3" />
          Будет отправлено{" "}
          {new Date(f.scheduledFor).toLocaleString("ru-RU", {
            day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
          })}.
        </div>
      )}
    </aside>
  );
}

function IosPreview({ f }: { f: FormState }) {
  // iOS-style notification card. Status-bar area + notification with
  // app icon, headline, body, timestamp.
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-bg-subtle to-bg p-4 shadow-glass">
      {/* status bar */}
      <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-medium text-ink">
        <span>9:41</span>
        <span className="flex items-center gap-1 text-[9px] text-ink-mute">
          <span>• • •</span>
          <span>5G</span>
          <span className="ml-1 inline-block h-2 w-3 rounded-sm bg-ink/40" />
        </span>
      </div>

      {/* notification card */}
      <div className="rounded-2xl bg-bg/90 p-3 shadow backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-br from-leaf to-amber text-base text-bg">
            {f.icon.trim() || "С"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold text-ink">
                СВОЕ РОДНОЕ
              </span>
              <span className="ml-auto text-[10px] text-ink-mute">сейчас</span>
            </div>
            <div className="mt-0.5 text-sm font-semibold text-ink">
              {f.headline.trim() || "Заголовок"}
            </div>
            <div className="text-xs leading-relaxed text-ink-dim">
              {f.body.trim() || "Текст уведомления появится здесь."}
            </div>
          </div>
        </div>
        {f.previewImage && (
          <img
            src={f.previewImage}
            alt=""
            className="mt-2 aspect-[16/9] w-full rounded-md object-cover"
          />
        )}
      </div>
    </div>
  );
}

function AndroidPreview({ f }: { f: FormState }) {
  // Android heads-up shade style — flatter, smaller icon, app label at top.
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-bg-subtle p-4 shadow-glass">
      <div className="rounded-xl border border-line/60 bg-bg p-3">
        <div className="mb-1 flex items-center gap-2 text-[10px] text-ink-mute">
          <div className="grid h-4 w-4 place-items-center rounded-sm bg-gradient-to-br from-leaf to-amber text-[8px] text-bg">
            {f.icon.trim() || "С"}
          </div>
          <span className="font-medium">Свое Родное</span>
          <span>• сейчас</span>
        </div>
        <div className="text-sm font-semibold text-ink">
          {f.headline.trim() || "Заголовок"}
        </div>
        <div className="text-xs leading-relaxed text-ink-dim">
          {f.body.trim() || "Текст уведомления появится здесь."}
        </div>
        {f.previewImage && (
          <img
            src={f.previewImage}
            alt=""
            className="mt-2 aspect-[16/9] w-full rounded-md object-cover"
          />
        )}
      </div>
    </div>
  );
}

// ─── small reusable bits ──────────────────────────────────────────────

function Shell({
  onClose, title, eyebrow, children,
}: { onClose: () => void; title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-line bg-bg/85 px-6 py-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="smallcaps text-[10px] text-rust">{eyebrow}</div>
          <h2 className="mt-1 truncate font-display text-2xl leading-tight">{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-line bg-bg/95 px-6 py-3 backdrop-blur">
      {children}
    </div>
  );
}

function FootMsg({ tone, children }: { tone: "leaf" | "rust"; children: React.ReactNode }) {
  const Icon = tone === "leaf" ? Check : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function Field({
  label, hint, icon, children,
}: { label: React.ReactNode; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-ink-mute">
        {icon}
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-ink-mute">{hint}</p>}
    </div>
  );
}

function CharBudget({
  over, limit, platform, len,
}: { over: number; limit: number; platform: string; len: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0 font-mono text-[9px] tabular-nums ${
        over > 0 ? "bg-rust/15 text-rust" : "bg-bg-subtle text-ink-mute"
      }`}
      title={`Лимит на лок-скрине: ${platform}`}
    >
      {platform}: {len}/{limit}
      {over > 0 && <span>+{over}</span>}
    </span>
  );
}

function toLocalISO(d: Date): string {
  const off = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - off);
  return local.toISOString().slice(0, 16);
}
