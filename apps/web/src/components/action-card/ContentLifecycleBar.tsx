import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Check,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Undo2,
  User as UserIcon,
  X,
} from "lucide-react";

import type { ContentRevision, GeneratedContent } from "@/lib/types";
import {
  archiveContent,
  listContentRevisions,
  publishContent,
  restoreContentRevision,
  unarchiveContent,
  updateContent,
} from "@/lib/content";

// =====================================================================
//  ContentLifecycleBar — sits below each rendered variant's content
//  card. Surfaces status, edit/publish/archive verbs, and a history
//  dropdown. Designed to be unobtrusive: when the content is in its
//  AI-fresh draft state, only "Опубликовать" + "Редактировать" + the
//  small history icon are visible.
//
//  The "edit" mode is an inline JSON-aware textarea — channel-specific
//  rich editors will land in their own module phases (Stories, Recipes
//  etc. each get a dedicated form). This bar provides the universal
//  "tweak the AI output and save as a new revision" fallback that
//  works for every channel regardless of shape.
// =====================================================================

interface Props {
  content: GeneratedContent;
  /** Called after any successful mutation so parent React Query caches
   *  can refresh. The parent is responsible for re-fetching the content
   *  list; we don't invalidate cross-component here. */
  onChange?: (next: GeneratedContent) => void;
}

export function ContentLifecycleBar({ content, onChange }: Props) {
  const qc = useQueryClient();
  const id = content.id;
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // We allow the bar to render even for transient content (no id yet —
  // e.g. immediately after AI generation before persistence). Lifecycle
  // verbs are simply disabled until the row has a real id.
  const hasID = Boolean(id);

  const status = content.status ?? "draft";

  const refresh = (next: GeneratedContent) => {
    onChange?.(next);
    qc.invalidateQueries({ queryKey: ["suggestion-content", content.suggestion_id] });
  };

  const publish = useMutation({
    mutationFn: () => publishContent(id!),
    onSuccess: refresh,
  });
  const archive = useMutation({
    mutationFn: () => archiveContent(id!),
    onSuccess: refresh,
  });
  const unarchive = useMutation({
    mutationFn: () => unarchiveContent(id!),
    onSuccess: refresh,
  });

  const pending =
    publish.isPending || archive.isPending || unarchive.isPending;

  return (
    <div className="mt-3 space-y-2">
      {/* status pill + action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/50 pt-2.5 text-xs">
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          {content.is_user_edited && (
            <span className="inline-flex items-center gap-1 rounded-full border border-plum/30 bg-plum/10 px-2 py-0.5 text-[10px] text-plum">
              <Pencil className="h-2.5 w-2.5" />
              правлено вручную
            </span>
          )}
          {content.current_revision && content.current_revision > 1 && (
            <span className="font-mono text-[10px] text-ink-mute">
              v{content.current_revision}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {hasID && (
            <>
              <ActionBtn
                onClick={() => setEditing(true)}
                disabled={editing || pending}
                icon={<Pencil className="h-3 w-3" />}
                label="Редактировать"
              />

              {status === "draft" && (
                <ActionBtn
                  onClick={() => publish.mutate()}
                  disabled={pending}
                  icon={publish.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  label="Опубликовать"
                  primary
                />
              )}
              {status === "published" && (
                <ActionBtn
                  onClick={() => archive.mutate()}
                  disabled={pending}
                  icon={archive.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                  label="В архив"
                />
              )}
              {status === "archived" && (
                <ActionBtn
                  onClick={() => unarchive.mutate()}
                  disabled={pending}
                  icon={unarchive.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                  label="Восстановить из архива"
                />
              )}

              <button
                onClick={() => setHistoryOpen((v) => !v)}
                aria-label="История версий"
                className={`grid h-7 w-7 place-items-center rounded text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink-dim ${
                  historyOpen ? "bg-bg-subtle text-ink" : ""
                }`}
              >
                <History className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editing && hasID && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <InlineEditor
              content={content}
              onClose={() => setEditing(false)}
              onSaved={(next) => {
                setEditing(false);
                refresh(next);
              }}
            />
          </motion.div>
        )}

        {historyOpen && hasID && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <HistoryPanel
              contentID={id!}
              currentRevision={content.current_revision ?? 1}
              onRestore={(next) => refresh(next)}
              onClose={() => setHistoryOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── status pill ─────────────────────────────────────────────────────────

function StatusPill({ status }: { status: NonNullable<GeneratedContent["status"]> }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-leaf/40 bg-leaf/10 px-2 py-0.5 text-[10px] text-leaf">
        <span className="relative h-1.5 w-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-leaf opacity-60" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-leaf" />
        </span>
        опубликовано
      </span>
    );
  }
  if (status === "archived") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-subtle px-2 py-0.5 text-[10px] text-ink-mute">
        <Archive className="h-2.5 w-2.5" />
        в архиве
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] text-amber">
      <Sparkles className="h-2.5 w-2.5" />
      черновик
    </span>
  );
}

function ActionBtn({
  onClick, icon, label, disabled, primary,
}: {
  onClick: () => void; icon: React.ReactNode; label: string;
  disabled?: boolean; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors disabled:opacity-50 ${
        primary
          ? "bg-leaf/15 text-leaf hover:bg-leaf/25"
          : "text-ink-dim hover:bg-bg-subtle hover:text-ink"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── inline editor ───────────────────────────────────────────────────────

function InlineEditor({
  content, onClose, onSaved,
}: {
  content: GeneratedContent;
  onClose: () => void;
  onSaved: (next: GeneratedContent) => void;
}) {
  // The body is channel-shaped JSON. Phase-2 editor is a universal
  // textarea on the pretty-printed JSON — channel-specific rich editors
  // (Stories, Recipes, ...) replace this in their own module phases.
  const [json, setJson] = useState(() => JSON.stringify(content.body, null, 2));
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(json);
      } catch {
        throw new Error("Невалидный JSON. Проверьте кавычки и&nbsp;запятые.");
      }
      if (typeof body !== "object" || Array.isArray(body) || body === null) {
        throw new Error("Корень должен быть JSON-объектом.");
      }
      return updateContent(content.id!, { body, note: note || undefined });
    },
    onSuccess: onSaved,
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="rounded-lg border border-leaf/30 bg-leaf-soft/10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="smallcaps text-[10px] text-leaf">редактирование</div>
        <button
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
          aria-label="Отмена"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        spellCheck={false}
        rows={Math.min(20, Math.max(6, json.split("\n").length))}
        className="w-full rounded-md border border-line bg-bg/60 px-3 py-2 font-mono text-[12px] leading-relaxed text-ink focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Подпись правки (необязательно)"
        className="mt-2 w-full rounded-md border border-line bg-bg/60 px-3 py-2 text-xs placeholder:text-ink-mute focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
      />
      {err && (
        <div className="mt-2 rounded-md border border-rust/30 bg-rust/10 px-2.5 py-1.5 text-xs text-rust">
          {err}
        </div>
      )}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:bg-bg-subtle"
        >
          Отмена
        </button>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="flex items-center gap-1.5 rounded bg-leaf px-3 py-1.5 text-xs font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {m.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Сохранить как новую версию
        </button>
      </div>
    </div>
  );
}

// ─── history panel ───────────────────────────────────────────────────────

function HistoryPanel({
  contentID, currentRevision, onRestore, onClose,
}: {
  contentID: string;
  currentRevision: number;
  onRestore: (next: GeneratedContent) => void;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["content-revisions", contentID],
    queryFn: () => listContentRevisions(contentID),
    staleTime: 30_000,
  });

  const restore = useMutation({
    mutationFn: (rn: number) => restoreContentRevision(contentID, rn),
    onSuccess: onRestore,
  });

  const revs = q.data ?? [];

  return (
    <div className="rounded-lg border border-line bg-bg-subtle/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="smallcaps text-[10px] text-ink-mute">история версий</div>
        <button
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
          aria-label="Закрыть"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {q.isLoading ? (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-bg-elevated" />
          ))}
        </div>
      ) : revs.length === 0 ? (
        <div className="rounded-md border border-line bg-bg p-3 text-xs text-ink-mute">
          История пуста.
        </div>
      ) : (
        <ul className="space-y-1">
          {revs.map((r) => (
            <RevisionRow
              key={r.id}
              rev={r}
              isCurrent={r.revision_number === currentRevision}
              onRestore={() => restore.mutate(r.revision_number)}
              restorePending={restore.isPending && restore.variables === r.revision_number}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RevisionRow({
  rev, isCurrent, onRestore, restorePending,
}: {
  rev: ContentRevision;
  isCurrent: boolean;
  onRestore: () => void;
  restorePending: boolean;
}) {
  const ai = !rev.is_user_edited;
  const when = relativeTime(rev.created_at);
  return (
    <li
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors ${
        isCurrent
          ? "border-leaf/40 bg-leaf/5"
          : "border-line bg-bg-elevated hover:border-ink-mute/40"
      }`}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bg-subtle font-mono text-[9px] text-ink-dim">
        v{rev.revision_number}
      </span>
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bg-subtle text-ink-mute">
        {ai ? <Sparkles className="h-2.5 w-2.5" /> : <UserIcon className="h-2.5 w-2.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate">
          {rev.note || (ai ? "AI generation" : "правка")}
        </div>
        <div className="text-[10px] text-ink-mute">
          {ai ? (rev.model ?? "AI") : (rev.author_username ?? "пользователь")} · {when}
        </div>
      </div>

      {isCurrent ? (
        <span className="flex items-center gap-1 text-[10px] text-leaf">
          <Check className="h-3 w-3" />
          текущая
        </span>
      ) : (
        <button
          onClick={onRestore}
          disabled={restorePending}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-ink-dim transition-colors hover:bg-bg-subtle hover:text-ink disabled:opacity-50"
        >
          {restorePending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          Восстановить
        </button>
      )}
    </li>
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} дн назад`;
  const d2 = new Date(iso);
  return d2.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}
