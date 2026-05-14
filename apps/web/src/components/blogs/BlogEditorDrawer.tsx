import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, BookText, Check, Clock, Hash, Image as ImageIcon,
  Loader2, Quote, Sparkles, Users, X,
} from "lucide-react";

import { ContentLifecycleBar } from "@/components/action-card/ContentLifecycleBar";
import { updateContent } from "@/lib/content";
import {
  blogTitle, createFarmerBlog, getBlog, readingMinutes, type BlogBody,
} from "@/lib/blogs";
import type { GeneratedContent } from "@/lib/types";

// =====================================================================
//  BlogEditorDrawer — long-form writer's view. Wider drawer (max-w-6xl)
//  with 50/50 split: editor left, magazine-spread preview right. SEO
//  fields live in a collapsed accordion below the body. Reading-time
//  chip live-updates as the body changes.
//
//  storyID === "new" → create flow (POST /blogs)
//  storyID === id    → edit flow (PATCH /content/:id) + lifecycle bar
// =====================================================================

interface Props {
  blogID: string | null | "new";
  farmerID: string;
  onClose: () => void;
}

export function BlogEditorDrawer({ blogID, farmerID, onClose }: Props) {
  return (
    <AnimatePresence>
      {blogID && (
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
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-6xl flex-col border-l border-line bg-bg shadow-glass"
          >
            <Body blogID={blogID} farmerID={farmerID} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Body({ blogID, farmerID, onClose }: { blogID: string | "new"; farmerID: string; onClose: () => void }) {
  return blogID === "new"
    ? <CreateFlow farmerID={farmerID} onClose={onClose} />
    : <EditFlow blogID={blogID} farmerID={farmerID} onClose={onClose} />;
}

// ─── create flow ────────────────────────────────────────────────────────

function CreateFlow({ farmerID, onClose }: { farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const form = useBlogForm();

  const m = useMutation({
    mutationFn: () =>
      createFarmerBlog(farmerID, {
        title: form.title.trim(),
        lede: form.lede.trim() || undefined,
        body: form.body.trim(),
        cover_image_url: form.cover.trim() || undefined,
        seo_keywords: csv(form.seoKeywords),
        meta_description: form.metaDescription.trim() || undefined,
        audience_tags: csv(form.audience),
        hashtags: csv(form.tags),
        create_plan_card: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blogs", farmerID] });
      qc.invalidateQueries({ queryKey: ["plan", farmerID] });
      qc.invalidateQueries({ queryKey: ["boards", farmerID] });
      onClose();
    },
  });

  return (
    <Shell onClose={onClose} title={form.title.trim() || "Новая статья"} eyebrow="новый блог">
      <SplitWriter {...form} />
      <Footer>
        {m.isError && (
          <span className="inline-flex items-center gap-1 text-xs text-rust">
            <AlertTriangle className="h-3.5 w-3.5" /> ошибка
          </span>
        )}
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !form.title.trim()}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookText className="h-4 w-4" />}
          Создать статью
        </button>
      </Footer>
    </Shell>
  );
}

// ─── edit flow ──────────────────────────────────────────────────────────

function EditFlow({ blogID, farmerID, onClose }: { blogID: string; farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["blog", blogID], queryFn: () => getBlog(blogID) });

  const form = useBlogForm();

  // Hydrate form from upstream content whenever it changes (incl. revision restore).
  useEffect(() => {
    if (!q.data) return;
    const b = (q.data.body as BlogBody | undefined) ?? {};
    form.setTitle(b.title ?? "");
    form.setLede(b.lede ?? "");
    form.setBody(b.body ?? "");
    form.setCover(b.cover_image_url ?? "");
    form.setSeoKeywords((b.seo_keywords ?? []).join(", "));
    form.setMetaDescription(b.meta_description ?? "");
    form.setAudience((b.audience_tags ?? []).join(", "));
    form.setTags((b.hashtags ?? []).join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const m = useMutation({
    mutationFn: () =>
      updateContent(blogID, {
        body: {
          title: form.title.trim(),
          lede: form.lede.trim(),
          body: form.body.trim(),
          cover_image_url: form.cover.trim() || undefined,
          seo_keywords: csv(form.seoKeywords),
          meta_description: form.metaDescription.trim(),
          audience_tags: csv(form.audience),
          hashtags: csv(form.tags),
        },
        note: "правка статьи",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog", blogID] });
      qc.invalidateQueries({ queryKey: ["blogs", farmerID] });
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
      title={blogTitle(q.data)}
      eyebrow={q.data.is_user_edited ? "статья · автор" : "статья · AI"}
    >
      <SplitWriter {...form} />

      <div className="border-t border-line bg-bg-elevated/30 px-6 pb-2 pt-1">
        <ContentLifecycleBar
          content={q.data}
          onChange={() => {
            qc.invalidateQueries({ queryKey: ["blog", blogID] });
            qc.invalidateQueries({ queryKey: ["blogs", farmerID] });
          }}
        />
      </div>

      <Footer>
        {m.isSuccess && (
          <span className="inline-flex items-center gap-1 text-xs text-leaf">
            <Check className="h-3.5 w-3.5" /> сохранено как новая версия
          </span>
        )}
        {m.isError && (
          <span className="inline-flex items-center gap-1 text-xs text-rust">
            <AlertTriangle className="h-3.5 w-3.5" /> ошибка
          </span>
        )}
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !form.title.trim()}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Сохранить
        </button>
      </Footer>
    </Shell>
  );
}

// ─── shared form state hook ────────────────────────────────────────────

function useBlogForm() {
  const [title, setTitle] = useState("");
  const [lede, setLede] = useState("");
  const [body, setBody] = useState("");
  const [cover, setCover] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [tags, setTags] = useState("");
  return {
    title, setTitle, lede, setLede, body, setBody, cover, setCover,
    seoKeywords, setSeoKeywords, metaDescription, setMetaDescription,
    audience, setAudience, tags, setTags,
  };
}

type FormState = ReturnType<typeof useBlogForm>;

// ─── split-pane writer + preview ───────────────────────────────────────

function SplitWriter(f: FormState) {
  const previewBlog: GeneratedContent = {
    id: "preview",
    suggestion_id: "",
    channel: "blog",
    variant: 0,
    body: { body: f.body, title: f.title, lede: f.lede },
  };
  const mins = readingMinutes(previewBlog);

  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
      {/* editor column */}
      <div className="space-y-4">
        <Field label="Заголовок">
          <input
            value={f.title}
            onChange={(e) => f.setTitle(e.target.value)}
            placeholder="Как выбрать честный мёд: краткое руководство"
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2.5 font-display text-xl focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>

        <Field label="Лид" hint="1–2 предложения, которые читатель видит первыми">
          <textarea
            value={f.lede}
            onChange={(e) => f.setLede(e.target.value)}
            rows={2}
            placeholder="Подзаголовок, который продаёт статью с первого взгляда."
            className="w-full resize-y rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm italic leading-relaxed focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>

        <Field label="URL обложки" icon={<ImageIcon className="h-3 w-3" />}>
          <input
            value={f.cover}
            onChange={(e) => f.setCover(e.target.value)}
            placeholder="https://example.com/cover.jpg"
            spellCheck={false}
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 font-mono text-xs focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>

        <Field
          label={
            <span className="inline-flex items-center gap-2">
              Тело статьи
              <span className="inline-flex items-center gap-1 rounded-full bg-bg-subtle px-1.5 py-0.5 text-[9px] text-ink-mute">
                <Clock className="h-2.5 w-2.5" />
                ~{mins} мин чтения
              </span>
            </span>
          }
        >
          <textarea
            value={f.body}
            onChange={(e) => f.setBody(e.target.value)}
            rows={18}
            placeholder={"Первый абзац — стартует с буквицы.\n\nДальше абзацы через пустую строку. Простые переносы — это мягкие переводы строк."}
            className="w-full resize-y rounded-md border border-line bg-bg-elevated px-3 py-2.5 text-sm leading-relaxed focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>

        <details className="rounded-md border border-line/60 bg-bg-subtle/40 p-3">
          <summary className="cursor-pointer select-none text-xs font-medium text-ink-dim hover:text-ink">
            SEO и метаданные
          </summary>
          <div className="mt-3 space-y-3">
            <Field label="Ключевые слова" icon={<Hash className="h-3 w-3" />} hint="3–7 слов через запятую">
              <input
                value={f.seoKeywords}
                onChange={(e) => f.setSeoKeywords(e.target.value)}
                placeholder="мёд, ферма, как выбрать"
                className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
              />
            </Field>
            <Field label="Meta description" hint="≈155 символов для сниппетов в поиске">
              <textarea
                value={f.metaDescription}
                onChange={(e) => f.setMetaDescription(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="Краткое описание для Google/Yandex."
                className="w-full resize-y rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
              />
              <div className="mt-1 text-right text-[10px] text-ink-mute">
                {f.metaDescription.length} / 200
              </div>
            </Field>
          </div>
        </details>

        <Field label="Аудитория" icon={<Users className="h-3 w-3" />} hint="Через запятую">
          <input
            value={f.audience}
            onChange={(e) => f.setAudience(e.target.value)}
            placeholder="zozh, gourmets, parents"
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>

        <Field label="Хэштеги" icon={<Hash className="h-3 w-3" />} hint="Через запятую">
          <input
            value={f.tags}
            onChange={(e) => f.setTags(e.target.value)}
            placeholder="мёд, ферма, спас"
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>
      </div>

      {/* preview column */}
      <aside className="sticky top-4 flex h-fit flex-col gap-3 self-start">
        <div className="smallcaps flex items-center gap-1 text-[10px] text-ink-mute">
          <Quote className="h-2.5 w-2.5" />
          предпросмотр статьи
        </div>
        <article className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
          {f.cover ? (
            <img src={f.cover} alt="" className="aspect-[16/8] w-full object-cover" />
          ) : (
            <div
              className="aspect-[16/8] w-full"
              style={{
                background: `radial-gradient(60% 60% at 25% 25%, hsl(var(--sky) / 0.40) 0%, transparent 60%),
                             radial-gradient(50% 60% at 80% 75%, hsl(var(--amber) / 0.25) 0%, transparent 60%),
                             linear-gradient(140deg, hsl(var(--bg-elevated)), hsl(var(--bg)))`,
              }}
            />
          )}
          <div className="space-y-4 p-7">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-ink-mute">
              <Sparkles className="h-2.5 w-2.5 text-amber" />
              <span>статья · превью</span>
              <span className="ml-auto inline-flex items-center gap-1 text-ink-dim">
                <Clock className="h-2.5 w-2.5" />
                {mins} мин чтения
              </span>
            </div>
            <h1 className="font-display text-3xl leading-tight tracking-tight">
              {f.title.trim() || "Заголовок статьи появится здесь"}
            </h1>
            {f.lede.trim() && (
              <p className="text-base italic leading-relaxed text-ink-dim">
                {f.lede.trim()}
              </p>
            )}
            <PreviewBody body={f.body} />
            {(csv(f.seoKeywords).length + csv(f.audience).length + csv(f.tags).length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-line/40 pt-3">
                {csv(f.seoKeywords).map((k) => (
                  <span key={`s-${k}`} className="inline-flex items-center gap-1 rounded-full border border-sky/30 bg-sky/10 px-2 py-0.5 text-[10px] text-sky">
                    <Hash className="h-2.5 w-2.5" />
                    {k}
                  </span>
                ))}
                {csv(f.audience).map((a) => (
                  <span key={`a-${a}`} className="inline-flex items-center gap-1 rounded-full border border-plum/30 bg-plum/10 px-2 py-0.5 text-[10px] text-plum">
                    <Users className="h-2.5 w-2.5" />
                    {a}
                  </span>
                ))}
                {csv(f.tags).map((h) => (
                  <span key={`t-${h}`} className="inline-flex items-center rounded-full border border-leaf/30 bg-leaf/10 px-2 py-0.5 text-[10px] text-leaf">
                    <Hash className="h-2.5 w-2.5" />
                    {h.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>
      </aside>
    </div>
  );
}

// PreviewBody — magazine-style render. First paragraph gets a Fraunces
// dropcap, paragraphs split on blank lines, soft newlines preserved.
function PreviewBody({ body }: { body: string }) {
  const text = body.trim();
  if (!text) {
    return (
      <p className="text-sm italic text-ink-mute">
        Текст статьи появится здесь. Первый абзац начнётся с&nbsp;буквицы.
      </p>
    );
  }
  const paras = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[15px] leading-[1.75] text-ink">
      {paras.map((p, i) => {
        const lines = p.split("\n");
        if (i === 0 && lines[0].length > 0) {
          const first = lines[0];
          return (
            <p key={i}>
              <span className="float-left mr-1.5 mt-1 font-display text-5xl leading-[0.85] text-amber">
                {first[0]}
              </span>
              <span>{first.slice(1)}</span>
              {lines.slice(1).map((l, j) => (
                <span key={j}>
                  <br />
                  {l}
                </span>
              ))}
            </p>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {l}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

// ─── shell + helpers ───────────────────────────────────────────────────

function Shell({
  onClose, title, eyebrow, children,
}: {
  onClose: () => void; title: string; eyebrow: string;
  children: React.ReactNode;
}) {
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

function csv(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
