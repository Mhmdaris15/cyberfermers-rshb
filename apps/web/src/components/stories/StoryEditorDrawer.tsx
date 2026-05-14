import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, Check, Hash, Image as ImageIcon, Loader2,
  Quote, Sparkles, Users, X,
} from "lucide-react";

import { ContentLifecycleBar } from "@/components/action-card/ContentLifecycleBar";
import { updateContent } from "@/lib/content";
import { createFarmerStory, getStory, storyBody, storyHeroImage, storyTitle, type StoryBody } from "@/lib/stories";
import type { GeneratedContent } from "@/lib/types";

// =====================================================================
//  StoryEditorDrawer — split editor on the left, magazine preview on
//  the right. Lifecycle bar (publish/archive/history) docks at the
//  bottom and reuses the Phase-2 ContentLifecycleBar so all story
//  status transitions live in one place.
//
//  When `cardID == "new"` we render the create flow (POST /stories);
//  otherwise we hydrate via GET /api/stories/:id and PATCH on save.
// =====================================================================

interface Props {
  /** "new" for the create-from-scratch flow, or a content id, or null to hide. */
  storyID: string | null | "new";
  farmerID: string;
  onClose: () => void;
}

export function StoryEditorDrawer({ storyID, farmerID, onClose }: Props) {
  return (
    <AnimatePresence>
      {storyID && (
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
            <Body storyID={storyID} farmerID={farmerID} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Body({ storyID, farmerID, onClose }: { storyID: string | "new"; farmerID: string; onClose: () => void }) {
  const isNew = storyID === "new";

  if (isNew) {
    return <CreateFlow farmerID={farmerID} onClose={onClose} />;
  }
  return <EditFlow storyID={storyID} farmerID={farmerID} onClose={onClose} />;
}

// ─── create flow (POST /stories) ───────────────────────────────────────

function CreateFlow({ farmerID, onClose }: { farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hero, setHero] = useState("");
  const [audience, setAudience] = useState("");
  const [tags, setTags] = useState("");

  const m = useMutation({
    mutationFn: () =>
      createFarmerStory(farmerID, {
        title: title.trim(),
        body: body.trim(),
        hero_image_url: hero.trim() || undefined,
        audience_tags: csv(audience),
        hashtags: csv(tags),
        create_plan_card: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories", farmerID] });
      qc.invalidateQueries({ queryKey: ["plan", farmerID] });
      qc.invalidateQueries({ queryKey: ["boards", farmerID] });
      onClose();
    },
  });

  return (
    <Shell
      onClose={onClose}
      title={title.trim() || "Новая история"}
      eyebrow="новая история"
      headerExtra={null}
    >
      <SplitEditor
        title={title} setTitle={setTitle}
        body={body} setBody={setBody}
        hero={hero} setHero={setHero}
        audience={audience} setAudience={setAudience}
        tags={tags} setTags={setTags}
        readonlyMeta="После создания история появится в&nbsp;Plan-board → доска «Сторителлинг»."
      />

      <Footer>
        {m.isError && (
          <span className="inline-flex items-center gap-1 text-xs text-rust">
            <AlertTriangle className="h-3.5 w-3.5" /> ошибка
          </span>
        )}
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !title.trim()}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Создать историю
        </button>
      </Footer>
    </Shell>
  );
}

// ─── edit flow (GET hydrate + PATCH save + lifecycle bar) ──────────────

function EditFlow({ storyID, farmerID, onClose }: { storyID: string; farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["story", storyID], queryFn: () => getStory(storyID) });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hero, setHero] = useState("");
  const [audience, setAudience] = useState("");
  const [tags, setTags] = useState("");

  // Hydrate the form whenever the upstream story changes (e.g. after a
  // revision restore from the lifecycle bar). The local state mirrors
  // the loaded body so user keystrokes don't fight the cache.
  useEffect(() => {
    if (!q.data) return;
    const b = (q.data.body as StoryBody | undefined) ?? {};
    setTitle(b.title ?? b.caption?.split("\n")[0] ?? "");
    setBody(b.body ?? b.caption ?? "");
    setHero(b.hero_image_url ?? "");
    setAudience((b.audience_tags ?? []).join(", "));
    setTags((b.hashtags ?? []).join(", "));
  }, [q.data]);

  const m = useMutation({
    mutationFn: () =>
      updateContent(storyID, {
        body: {
          title: title.trim(),
          body: body.trim(),
          hero_image_url: hero.trim() || undefined,
          audience_tags: csv(audience),
          hashtags: csv(tags),
        },
        note: "правка истории",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["story", storyID] });
      qc.invalidateQueries({ queryKey: ["stories", farmerID] });
    },
  });

  if (q.isLoading || !q.data) {
    return (
      <Shell onClose={onClose} title="..." eyebrow="загружаю" headerExtra={null}>
        <div className="grid h-full place-items-center p-10 text-sm text-ink-mute">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      onClose={onClose}
      title={storyTitle(q.data)}
      eyebrow={q.data.is_user_edited ? "история · автор" : "история · AI"}
      headerExtra={null}
    >
      <SplitEditor
        title={title} setTitle={setTitle}
        body={body} setBody={setBody}
        hero={hero} setHero={setHero}
        audience={audience} setAudience={setAudience}
        tags={tags} setTags={setTags}
      />

      {/* Lifecycle bar inherits all the Phase-2 verbs: publish, archive,
          history with restore. Wraps the existing component without a
          channel-specific re-implementation. */}
      <div className="border-t border-line bg-bg-elevated/30 px-6 pb-2 pt-1">
        <ContentLifecycleBar
          content={q.data}
          onChange={() => {
            qc.invalidateQueries({ queryKey: ["story", storyID] });
            qc.invalidateQueries({ queryKey: ["stories", farmerID] });
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
          disabled={m.isPending || !title.trim()}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Сохранить
        </button>
      </Footer>
    </Shell>
  );
}

// ─── shared shell + form pieces ────────────────────────────────────────

function Shell({
  onClose, title, eyebrow, children, headerExtra,
}: {
  onClose: () => void; title: string; eyebrow: string;
  headerExtra: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-line bg-bg/85 px-6 py-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="smallcaps text-[10px] text-plum">{eyebrow}</div>
          <h2 className="mt-1 truncate font-display text-2xl leading-tight">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {headerExtra}
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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

// SplitEditor — left column: form fields. Right column: live preview
// styled like a magazine spread.
function SplitEditor(props: {
  title: string; setTitle: (s: string) => void;
  body: string; setBody: (s: string) => void;
  hero: string; setHero: (s: string) => void;
  audience: string; setAudience: (s: string) => void;
  tags: string; setTags: (s: string) => void;
  readonlyMeta?: string;
}) {
  const { title, body, hero, audience, tags } = props;

  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
      {/* ───── editor column ───── */}
      <div className="space-y-4">
        <Field label="Заголовок">
          <input
            value={title}
            onChange={(e) => props.setTitle(e.target.value)}
            placeholder="История одной банки мёда"
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2.5 font-display text-lg focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>

        <Field label="URL обложки" icon={<ImageIcon className="h-3 w-3" />}>
          <input
            value={hero}
            onChange={(e) => props.setHero(e.target.value)}
            placeholder="https://example.com/honey.jpg"
            spellCheck={false}
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 font-mono text-xs focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>

        <Field label="Текст истории">
          <textarea
            value={body}
            onChange={(e) => props.setBody(e.target.value)}
            rows={12}
            placeholder={"Расскажите своими словами. Первый абзац — крючок;\nдалее — обстоятельства, детали, эмоция.\n\nПустые строки = новый абзац."}
            className="w-full resize-y rounded-md border border-line bg-bg-elevated px-3 py-2.5 text-sm leading-relaxed focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>

        <Field label="Аудитория" icon={<Users className="h-3 w-3" />} hint="Через запятую">
          <input
            value={audience}
            onChange={(e) => props.setAudience(e.target.value)}
            placeholder="zozh, parents, gourmets"
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>

        <Field label="Хэштеги" icon={<Hash className="h-3 w-3" />} hint="Через запятую">
          <input
            value={tags}
            onChange={(e) => props.setTags(e.target.value)}
            placeholder="мёд, спас, ферма"
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          />
        </Field>

        {props.readonlyMeta && (
          <p
            className="rounded-md border border-line/60 bg-bg-subtle px-3 py-2 text-[11px] leading-relaxed text-ink-mute"
            dangerouslySetInnerHTML={{ __html: props.readonlyMeta }}
          />
        )}
      </div>

      {/* ───── live preview column ───── */}
      <aside className="sticky top-4 flex h-fit flex-col gap-3 self-start">
        <div className="smallcaps flex items-center gap-1 text-[10px] text-ink-mute">
          <Quote className="h-2.5 w-2.5" />
          предпросмотр
        </div>
        <article className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
          {hero ? (
            <img
              src={hero}
              alt=""
              className="aspect-[16/9] w-full object-cover"
            />
          ) : (
            <div className="aspect-[16/9] w-full"
                 style={{
                   background: `radial-gradient(60% 60% at 20% 30%, hsl(var(--plum) / 0.45) 0%, transparent 60%),
                                radial-gradient(50% 60% at 80% 70%, hsl(var(--amber) / 0.30) 0%, transparent 60%),
                                linear-gradient(140deg, hsl(var(--bg-elevated)), hsl(var(--bg)))`,
                 }}
            />
          )}
          <div className="space-y-3 p-6">
            <h1 className="font-display text-2xl leading-tight tracking-tight">
              {title.trim() || "Заголовок появится здесь"}
            </h1>
            <PreviewBody body={body} />
            {(csv(audience).length + csv(tags).length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-line/40 pt-3">
                {csv(audience).map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 rounded-full border border-plum/30 bg-plum/10 px-2 py-0.5 text-[10px] text-plum">
                    <Users className="h-2.5 w-2.5" />
                    {a}
                  </span>
                ))}
                {csv(tags).map((h) => (
                  <span key={h} className="inline-flex items-center rounded-full border border-leaf/30 bg-leaf/10 px-2 py-0.5 text-[10px] text-leaf">
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

// PreviewBody — magazine-style render: first paragraph gets a Fraunces
// dropcap, paragraphs are split on blank lines, single newlines become
// soft breaks. Deliberately no markdown parser — keeps the preview
// honest about what the saved body will contain.
function PreviewBody({ body }: { body: string }) {
  const text = body.trim();
  if (!text) {
    return (
      <p className="text-sm italic text-ink-mute">
        Здесь появится текст истории. Первый абзац стартует с&nbsp;буквицы.
      </p>
    );
  }
  const paras = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink">
      {paras.map((p, i) => {
        const lines = p.split("\n");
        if (i === 0 && lines[0].length > 0) {
          const first = lines[0];
          return (
            <p key={i} className="text-ink">
              <span className="float-left mr-1.5 mt-1 font-display text-4xl leading-[0.85] text-amber">
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

function Field({
  label, hint, icon, children,
}: { label: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
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
