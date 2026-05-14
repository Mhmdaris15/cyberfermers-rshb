import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowDown, ArrowUp, CalendarClock, ChevronLeft, ChevronRight,
  Check, Hash, Image as ImageIcon, Instagram, Loader2, MessageCircle,
  Plus, Send, Share2, Trash2, Users2, X,
} from "lucide-react";

import { ContentLifecycleBar } from "@/components/action-card/ContentLifecycleBar";
import { updateContent } from "@/lib/content";
import {
  createFarmerSocialPost, getSocialPost, PLATFORMS, platformMeta,
  platformOverflow, socialCaption, socialPlatforms, socialScheduledFor,
  socialSlides, socialTitle, type SocialBody, type SocialPlatform,
  type Slide,
} from "@/lib/social";
import type { GeneratedContent } from "@/lib/types";

// =====================================================================
//  SocialPostEditorDrawer — structured editor + IG-style preview.
//
//  Left pane: platforms multi-select, caption textarea with LIVE
//  per-platform char counters, slide rows (URL + alt), CTA, hashtags,
//  audience, scheduled_for.
//
//  Right pane: Instagram-tile preview with carousel arrows. Shows
//  exactly what the post looks like in the IG feed — square image,
//  caption below, hashtag tail, slide indicator dots.
// =====================================================================

const PLATFORM_ICON: Record<SocialPlatform, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  telegram:  Send,
  vk:        MessageCircle,
};

interface Props {
  postID: string | null | "new";
  farmerID: string;
  onClose: () => void;
}

export function SocialPostEditorDrawer({ postID, farmerID, onClose }: Props) {
  return (
    <AnimatePresence>
      {postID && (
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
            {postID === "new"
              ? <CreateFlow farmerID={farmerID} onClose={onClose} />
              : <EditFlow postID={postID} farmerID={farmerID} onClose={onClose} />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── form state ────────────────────────────────────────────────────────

function useSocialForm() {
  const [title, setTitle] = useState("");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(["instagram", "telegram"]);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [cta, setCta] = useState("");
  const [slides, setSlides] = useState<Slide[]>([{ image_url: "", alt: "" }]);
  const [scheduledFor, setScheduledFor] = useState(""); // ISO datetime-local string
  const [audience, setAudience] = useState("");
  return {
    title, setTitle, platforms, setPlatforms, caption, setCaption,
    hashtags, setHashtags, cta, setCta, slides, setSlides,
    scheduledFor, setScheduledFor, audience, setAudience,
  };
}
type FormState = ReturnType<typeof useSocialForm>;

function buildBody(f: FormState): Record<string, unknown> {
  const slides = f.slides
    .map((s) => ({ image_url: s.image_url.trim(), alt: s.alt?.trim() || undefined }))
    .filter((s) => s.image_url);
  const body: Record<string, unknown> = {
    title: f.title.trim(),
    platforms: f.platforms,
    caption: f.caption,
    hashtags: csv(f.hashtags),
    cta: f.cta.trim() || undefined,
    slides,
    audience_tags: csv(f.audience),
  };
  if (f.scheduledFor) {
    const d = new Date(f.scheduledFor);
    if (!Number.isNaN(d.getTime())) body.scheduled_for = d.toISOString();
  }
  return body;
}

// ─── create flow ───────────────────────────────────────────────────────

function CreateFlow({ farmerID, onClose }: { farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const f = useSocialForm();

  const m = useMutation({
    mutationFn: () => {
      const body = buildBody(f);
      return createFarmerSocialPost(farmerID, {
        title: body.title as string,
        platforms: body.platforms as SocialPlatform[],
        caption: body.caption as string,
        hashtags: body.hashtags as string[],
        cta: body.cta as string | undefined,
        slides: body.slides as Slide[],
        scheduled_for: body.scheduled_for as string | undefined,
        audience_tags: body.audience_tags as string[],
        create_plan_card: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social", farmerID] });
      qc.invalidateQueries({ queryKey: ["plan", farmerID] });
      qc.invalidateQueries({ queryKey: ["boards", farmerID] });
      onClose();
    },
  });

  return (
    <Shell onClose={onClose} title={f.title.trim() || "Новый пост"} eyebrow="новый пост">
      <SplitEditor f={f} />
      <Footer>
        {m.isError && <FootMsg tone="rust">ошибка</FootMsg>}
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !f.title.trim() || f.platforms.length === 0}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Создать пост
        </button>
      </Footer>
    </Shell>
  );
}

// ─── edit flow ─────────────────────────────────────────────────────────

function EditFlow({ postID, farmerID, onClose }: { postID: string; farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["social-post", postID], queryFn: () => getSocialPost(postID) });
  const f = useSocialForm();

  useEffect(() => {
    if (!q.data) return;
    const b = (q.data.body as SocialBody | undefined) ?? {};
    f.setTitle(socialTitle(q.data));
    const plats = socialPlatforms(q.data);
    f.setPlatforms(plats.length ? plats : ["instagram"]);
    f.setCaption(socialCaption(q.data));
    f.setHashtags((b.hashtags ?? []).join(", "));
    f.setCta(b.cta ?? "");
    const sl = socialSlides(q.data);
    f.setSlides(sl.length ? sl : [{ image_url: "", alt: "" }]);
    const sched = socialScheduledFor(q.data);
    f.setScheduledFor(sched ? toLocalISO(sched) : "");
    f.setAudience((b.audience_tags ?? []).join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const m = useMutation({
    mutationFn: () => updateContent(postID, { body: buildBody(f), note: "правка поста" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-post", postID] });
      qc.invalidateQueries({ queryKey: ["social", farmerID] });
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
    <Shell onClose={onClose} title={socialTitle(q.data)} eyebrow={q.data.is_user_edited ? "пост · автор" : "пост · AI"}>
      <SplitEditor f={f} />

      <div className="border-t border-line bg-bg-elevated/30 px-6 pb-2 pt-1">
        <ContentLifecycleBar
          content={q.data}
          onChange={() => {
            qc.invalidateQueries({ queryKey: ["social-post", postID] });
            qc.invalidateQueries({ queryKey: ["social", farmerID] });
          }}
        />
      </div>

      <Footer>
        {m.isSuccess && <FootMsg tone="leaf">сохранено как новая версия</FootMsg>}
        {m.isError && <FootMsg tone="rust">ошибка</FootMsg>}
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !f.title.trim()}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Сохранить
        </button>
      </Footer>
    </Shell>
  );
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
  function togglePlatform(p: SocialPlatform) {
    f.setPlatforms(
      f.platforms.includes(p)
        ? f.platforms.filter((x) => x !== p)
        : [...f.platforms, p],
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Название (внутреннее)">
        <input
          value={f.title}
          onChange={(e) => f.setTitle(e.target.value)}
          placeholder="Анонс акции к Медовому Спасу"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      {/* platform picker */}
      <div>
        <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-ink-mute">
          Платформы
        </label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const Icon = PLATFORM_ICON[p.id];
            const active = f.platforms.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
                  active
                    ? `bg-gradient-to-br ${p.tone} text-bg shadow-glow`
                    : "border border-line bg-bg-elevated text-ink-dim hover:bg-bg-subtle"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* caption + live char counters */}
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-widest text-ink-mute">
          Подпись
        </label>
        <textarea
          value={f.caption}
          onChange={(e) => f.setCaption(e.target.value)}
          rows={6}
          placeholder="Первая строка — крючок. Дальше — детали. Хэштеги добавятся снизу автоматически."
          className="w-full resize-y rounded-md border border-line bg-bg-elevated px-3 py-2.5 text-sm leading-relaxed focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
          {f.platforms.map((p) => {
            const meta = platformMeta(p);
            const over = platformOverflow(f.caption, p);
            return (
              <span
                key={p}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                  over > 0
                    ? "border-rust/40 bg-rust/10 text-rust"
                    : "border-line bg-bg-subtle text-ink-mute"
                }`}
              >
                {meta.label}:&nbsp;
                <span className="font-mono tabular-nums">
                  {f.caption.length} / {meta.charLimit}
                </span>
                {over > 0 && <span className="font-mono">(+{over})</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* slides */}
      <SectionHeader title="Слайды (карусель)" icon={<ImageIcon className="h-3.5 w-3.5" />} />
      <div className="space-y-1.5">
        {f.slides.map((s, i) => (
          <div key={i} className="grid grid-cols-[2rem_minmax(0,2fr)_minmax(0,1fr)_auto] items-center gap-1.5">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-bg-subtle font-mono text-[10px] text-ink-mute">
              {i + 1}
            </div>
            <input
              value={s.image_url}
              onChange={(e) => f.setSlides(replace(f.slides, i, { ...s, image_url: e.target.value }))}
              placeholder="https://example.com/slide.jpg"
              spellCheck={false}
              className="rounded-md border border-line bg-bg-elevated px-2.5 py-1.5 font-mono text-xs focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
            />
            <input
              value={s.alt ?? ""}
              onChange={(e) => f.setSlides(replace(f.slides, i, { ...s, alt: e.target.value }))}
              placeholder="alt-описание"
              className="rounded-md border border-line bg-bg-elevated px-2.5 py-1.5 text-xs text-ink-dim focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
            />
            <RowControls
              onUp={() => f.setSlides(move(f.slides, i, -1))}
              onDown={() => f.setSlides(move(f.slides, i, +1))}
              onDelete={() => f.setSlides(f.slides.filter((_, j) => j !== i))}
              canUp={i > 0}
              canDown={i < f.slides.length - 1}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => f.setSlides([...f.slides, { image_url: "", alt: "" }])}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-line bg-bg-elevated/40 px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-leaf/60 hover:bg-leaf/5 hover:text-leaf"
        >
          <Plus className="h-3 w-3" />
          слайд
        </button>
      </div>

      <Field label="CTA">
        <input
          value={f.cta}
          onChange={(e) => f.setCta(e.target.value)}
          placeholder="«Заказать на этой неделе со скидкой 15%»"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      <Field label="Хэштеги" icon={<Hash className="h-3 w-3" />} hint="Через запятую — добавятся в конец подписи в превью">
        <input
          value={f.hashtags}
          onChange={(e) => f.setHashtags(e.target.value)}
          placeholder="мёд, спас, ферма"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      <Field label="Аудитория" icon={<Users2 className="h-3 w-3" />} hint="Через запятую">
        <input
          value={f.audience}
          onChange={(e) => f.setAudience(e.target.value)}
          placeholder="zozh, parents, gourmets"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>

      <Field label="Запланировать на" icon={<CalendarClock className="h-3 w-3" />} hint="Пусто = публикация вручную. Время сохраняется, но публикация по расписанию подключается в Phase 8.">
        <input
          type="datetime-local"
          value={f.scheduledFor}
          onChange={(e) => f.setScheduledFor(e.target.value)}
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </Field>
    </div>
  );
}

// ─── preview column — Instagram-style tile ─────────────────────────────

function PreviewColumn({ f }: { f: FormState }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const slides = f.slides.filter((s) => s.image_url.trim());
  const safeIdx = Math.min(slideIdx, Math.max(0, slides.length - 1));
  const visible = slides[safeIdx];

  return (
    <aside className="sticky top-4 flex h-fit flex-col gap-3 self-start">
      <div className="smallcaps flex items-center gap-1 text-[10px] text-ink-mute">
        <Instagram className="h-2.5 w-2.5" />
        предпросмотр (Instagram-стиль)
      </div>

      <article className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        {/* header — username row */}
        <div className="flex items-center gap-2 border-b border-line/40 px-4 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber via-rust to-plum text-bg">
            <span className="text-xs font-bold">С</span>
          </div>
          <div className="flex-1 text-sm font-medium">svoe.rodnoe</div>
          <span className="text-xs text-ink-mute">···</span>
        </div>

        {/* square slide */}
        <div className="relative aspect-square w-full overflow-hidden bg-bg-subtle">
          {visible ? (
            <img src={visible.image_url} alt={visible.alt ?? ""} className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `radial-gradient(60% 60% at 30% 30%, hsl(330 60% 28%) 0%, transparent 60%),
                             radial-gradient(50% 60% at 80% 75%, hsl(30 65% 25%) 0%, transparent 60%),
                             linear-gradient(140deg, hsl(var(--bg-elevated)), hsl(var(--bg)))`,
              }}
            />
          )}

          {slides.length > 1 && (
            <>
              <button
                onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
                disabled={safeIdx === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-bg/80 text-ink backdrop-blur transition-opacity disabled:opacity-30"
                aria-label="Предыдущий слайд"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                disabled={safeIdx === slides.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-bg/80 text-ink backdrop-blur transition-opacity disabled:opacity-30"
                aria-label="Следующий слайд"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {slides.length > 0 && (
            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 font-mono text-[10px] text-ink-dim backdrop-blur">
              {safeIdx + 1}/{slides.length}
            </div>
          )}
        </div>

        {/* slide dots */}
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-1 py-2">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === safeIdx ? "bg-sky" : "bg-ink-mute/40"
                }`}
              />
            ))}
          </div>
        )}

        {/* caption block */}
        <div className="space-y-2 px-4 py-3 text-sm">
          {f.caption.trim() && (
            <p className="whitespace-pre-line leading-relaxed text-ink">
              <span className="font-semibold">svoe.rodnoe</span>{" "}
              {f.caption.trim()}
            </p>
          )}
          {f.cta.trim() && (
            <p className="text-leaf">{f.cta.trim()}</p>
          )}
          {csv(f.hashtags).length > 0 && (
            <p className="text-sky">
              {csv(f.hashtags).map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
            </p>
          )}
          <div className="flex items-center justify-between border-t border-line/40 pt-2 text-[11px] text-ink-mute">
            <span>{slides.length || 1} {pluralize(slides.length || 1, "слайд", "слайда", "слайдов")}</span>
            {f.scheduledFor && (
              <span className="inline-flex items-center gap-1 text-sky">
                <CalendarClock className="h-3 w-3" />
                {new Date(f.scheduledFor).toLocaleString("ru-RU", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
      </article>

      {/* per-platform fit summary */}
      {f.platforms.length > 0 && (
        <div className="rounded-md border border-line/60 bg-bg-subtle/40 p-3">
          <div className="smallcaps mb-1.5 text-[10px] text-ink-mute">по платформам</div>
          <div className="space-y-1">
            {f.platforms.map((p) => {
              const meta = platformMeta(p);
              const over = platformOverflow(f.caption, p);
              const Icon = PLATFORM_ICON[p];
              return (
                <div key={p} className="flex items-center gap-2 text-xs">
                  <Icon className="h-3 w-3 text-ink-mute" />
                  <span className="text-ink-dim">{meta.label}</span>
                  <span className="ml-auto font-mono tabular-nums text-ink-mute">
                    {f.caption.length} / {meta.charLimit}
                  </span>
                  {over > 0
                    ? <span className="rounded-full bg-rust/15 px-1.5 py-0.5 font-mono text-[10px] text-rust">+{over}</span>
                    : <span className="rounded-full bg-leaf/15 px-1.5 py-0.5 text-[10px] text-leaf">ок</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
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
          <div className="smallcaps text-[10px] text-sky">{eyebrow}</div>
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

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 pt-2 text-[10px] uppercase tracking-widest text-ink-mute">
      {icon}
      {title}
    </div>
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

function RowControls({
  onUp, onDown, onDelete, canUp, canDown,
}: {
  onUp: () => void; onDown: () => void; onDelete: () => void;
  canUp: boolean; canDown: boolean;
}) {
  return (
    <div className="flex items-center">
      <button
        type="button" onClick={onUp} disabled={!canUp} aria-label="Выше"
        className="grid h-7 w-7 place-items-center rounded text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink disabled:opacity-30"
      >
        <ArrowUp className="h-3 w-3" />
      </button>
      <button
        type="button" onClick={onDown} disabled={!canDown} aria-label="Ниже"
        className="grid h-7 w-7 place-items-center rounded text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink disabled:opacity-30"
      >
        <ArrowDown className="h-3 w-3" />
      </button>
      <button
        type="button" onClick={onDelete} aria-label="Удалить"
        className="grid h-7 w-7 place-items-center rounded text-ink-mute transition-colors hover:bg-rust/10 hover:text-rust"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── pure helpers ──────────────────────────────────────────────────────

function csv(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function replace<T>(arr: T[], i: number, v: T): T[] {
  const out = arr.slice();
  out[i] = v;
  return out;
}

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function toLocalISO(d: Date): string {
  // datetime-local needs YYYY-MM-DDTHH:mm in local time (no Z suffix).
  const off = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - off);
  return local.toISOString().slice(0, 16);
}
