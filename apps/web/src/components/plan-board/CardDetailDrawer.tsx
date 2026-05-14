import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertTriangle, ArchiveX, Check, Hash, Loader2,
  MessageSquare, Pencil, Plus, Send, Sparkles, Trash2, Users, X,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ContentTabs } from "@/components/action-card/ContentTabs";
import { listContent } from "@/lib/api";
import {
  addPlanCardComment, deletePlanCard, getPlanCard,
  listPlanCardActivity, listPlanCardComments, updatePlanCard,
} from "@/lib/plan";
import { BOARDS } from "@/lib/plan";
import type {
  BoardType, CardPriority, PlanCard, PlanCardActivity,
} from "@/lib/types";

// =====================================================================
//  CardDetailDrawer — right-side sheet with 4 tabs:
//    Детали      — editable form (title/description/due/priority/chips)
//    Контент     — reuses ContentTabs (Phase 2 lifecycle bar inherited)
//    Комментарии — list + compose
//    Лента активности — read-only audit timeline
//
//  Composition: own backdrop + slide-in panel (we don't reuse the
//  existing <Sheet> because it animates exit via AnimatePresence on the
//  whole subtree — we want the Tabs state to persist through internal
//  mutations without re-mounting).
// =====================================================================

interface Props {
  cardID: string | null;
  farmerID: string;
  onClose: () => void;
}

export function CardDetailDrawer({ cardID, farmerID, onClose }: Props) {
  return (
    <AnimatePresence>
      {cardID && (
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
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-line bg-bg shadow-glass"
          >
            <DrawerBody cardID={cardID} farmerID={farmerID} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerBody({ cardID, farmerID, onClose }: { cardID: string; farmerID: string; onClose: () => void }) {
  const qc = useQueryClient();
  const cardQ = useQuery({ queryKey: ["plan-card", cardID], queryFn: () => getPlanCard(cardID) });

  // Listen for any successful mutation in the drawer and broadcast a
  // single board-level invalidation. Saves a round of plumbing every
  // place the card might change.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["plan-card", cardID] });
    qc.invalidateQueries({ queryKey: ["plan", farmerID] });
    qc.invalidateQueries({ queryKey: ["boards", farmerID] });
  };

  return (
    <>
      <DrawerHeader card={cardQ.data ?? null} loading={cardQ.isLoading} onClose={onClose} onArchived={() => { refresh(); onClose(); }} />

      <div className="flex-1 overflow-y-auto">
        {cardQ.isLoading ? (
          <div className="space-y-3 p-6">
            <div className="h-5 w-40 animate-pulse rounded bg-bg-subtle" />
            <div className="h-24 animate-pulse rounded bg-bg-subtle" />
            <div className="h-32 animate-pulse rounded bg-bg-subtle" />
          </div>
        ) : cardQ.data ? (
          <Tabs defaultValue="details" className="px-6 py-4">
            <TabsList className="overflow-x-auto">
              <TabsTrigger value="details">
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Детали
              </TabsTrigger>
              <TabsTrigger value="content">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Контент
              </TabsTrigger>
              <TabsTrigger value="comments">
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                Комментарии
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Activity className="mr-1.5 h-3.5 w-3.5" />
                Активность
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="pt-4">
              <DetailsTab card={cardQ.data} onSaved={refresh} />
            </TabsContent>
            <TabsContent value="content" className="pt-4">
              <ContentTab suggestionID={cardQ.data.suggestion_id} />
            </TabsContent>
            <TabsContent value="comments" className="pt-4">
              <CommentsTab cardID={cardID} />
            </TabsContent>
            <TabsContent value="activity" className="pt-4">
              <ActivityTab cardID={cardID} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-mute">
            Карточка не найдена
          </div>
        )}
      </div>
    </>
  );
}

// ─── header ────────────────────────────────────────────────────────────

function DrawerHeader({
  card, loading, onClose, onArchived,
}: { card: PlanCard | null; loading: boolean; onClose: () => void; onArchived: () => void }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const del = useMutation({
    mutationFn: () => deletePlanCard(card!.id!),
    onSuccess: onArchived,
  });

  const boardLabel = useMemo(() => {
    if (!card?.board_type) return "Кампания";
    return BOARDS.find((b) => b.type === card.board_type)?.label ?? card.board_type;
  }, [card?.board_type]);

  return (
    <header className="flex items-start justify-between gap-4 border-b border-line bg-bg/85 p-6 backdrop-blur">
      <div className="min-w-0 flex-1">
        <div className="smallcaps text-[10px] text-leaf">{boardLabel}</div>
        <h2 className="mt-1 truncate font-display text-2xl leading-tight">
          {loading ? "..." : card?.title || card?.suggestion?.event?.title || "Карточка"}
        </h2>
        {card?.column && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-line bg-bg-elevated px-2 py-0.5 text-[10px] text-ink-dim">
            <span className="font-mono">{card.column}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {card && (
          <>
            {confirmingDelete ? (
              <button
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="flex items-center gap-1.5 rounded-md border border-rust/40 bg-rust/10 px-2 py-1.5 text-xs text-rust transition-colors hover:bg-rust/20"
              >
                {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Точно удалить?
              </button>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="grid h-8 w-8 place-items-center rounded-md text-ink-mute transition-colors hover:bg-rust/10 hover:text-rust"
                title="Архивировать карточку"
              >
                <ArchiveX className="h-4 w-4" />
              </button>
            )}
          </>
        )}
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

// ─── Details tab (edit form) ───────────────────────────────────────────

function DetailsTab({ card, onSaved }: { card: PlanCard; onSaved: () => void }) {
  // Local form state mirrors the loaded card. We only fire the PATCH
  // for fields that actually differ from the loaded baseline, so an
  // accidental "Save" without changes is a no-op on the server.
  const [title, setTitle] = useState(card.title ?? "");
  const [description, setDescription] = useState(card.description ?? "");
  const [priority, setPriority] = useState<CardPriority>(card.priority ?? "normal");
  const [board, setBoard] = useState<BoardType>(card.board_type ?? "campaign");
  const [dueDate, setDueDate] = useState(card.due_date ? card.due_date.slice(0, 10) : "");
  const [audience, setAudience] = useState((card.audience_tags ?? []).join(", "));
  const [channels, setChannels] = useState((card.channels ?? []).join(", "));
  const [hashtags, setHashtags] = useState((card.hashtags ?? []).join(", "));
  const [cta, setCta] = useState(card.cta ?? "");
  const [note, setNote] = useState(card.note ?? "");

  const m = useMutation({
    mutationFn: (patch: Parameters<typeof updatePlanCard>[1]) => updatePlanCard(card.id!, patch),
    onSuccess: onSaved,
  });

  function csv(s: string): string[] {
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }

  function save() {
    const patch: Parameters<typeof updatePlanCard>[1] = {};
    if (title !== (card.title ?? "")) patch.title = title;
    if (description !== (card.description ?? "")) patch.description = description;
    if (priority !== (card.priority ?? "normal")) patch.priority = priority;
    if (board !== (card.board_type ?? "campaign")) patch.board_type = board;
    if (cta !== (card.cta ?? "")) patch.cta = cta;
    if (note !== (card.note ?? "")) patch.note = note;

    const newDue = dueDate ? new Date(dueDate).toISOString() : null;
    const oldDue = card.due_date ?? null;
    if (newDue !== oldDue) patch.due_date = newDue;

    const newAud = csv(audience);
    if (JSON.stringify(newAud) !== JSON.stringify(card.audience_tags ?? [])) patch.audience_tags = newAud;
    const newCh = csv(channels);
    if (JSON.stringify(newCh) !== JSON.stringify(card.channels ?? [])) patch.channels = newCh;
    const newTag = csv(hashtags);
    if (JSON.stringify(newTag) !== JSON.stringify(card.hashtags ?? [])) patch.hashtags = newTag;

    if (Object.keys(patch).length === 0) return; // nothing to save
    m.mutate(patch);
  }

  return (
    <div className="space-y-4">
      <FieldRow label="Название">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Короткое название карточки"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </FieldRow>

      <FieldRow label="Описание">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Контекст, гипотеза, что хотите проверить"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </FieldRow>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Доска">
          <select
            value={board}
            onChange={(e) => setBoard(e.target.value as BoardType)}
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
          >
            {BOARDS.map((b) => (
              <option key={b.type} value={b.type}>{b.label}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Приоритет">
          <PriorityPicker value={priority} onChange={setPriority} />
        </FieldRow>
      </div>

      <FieldRow label="Дедлайн" hint="ISO дата. Пусто = без дедлайна.">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </FieldRow>

      <ChipsField
        label="Аудитория"
        icon={<Users className="h-3 w-3" />}
        value={audience}
        onChange={setAudience}
        placeholder="zozh, parents, gift_buyers"
      />
      <ChipsField
        label="Каналы"
        value={channels}
        onChange={setChannels}
        placeholder="push, story, blog, recipe"
      />
      <ChipsField
        label="Хэштеги"
        icon={<Hash className="h-3 w-3" />}
        value={hashtags}
        onChange={setHashtags}
        placeholder="мёд, спас, ферма"
      />

      <FieldRow label="CTA">
        <input
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          placeholder="«Купить со скидкой 15%»"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </FieldRow>

      <FieldRow label="Заметка для команды">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Внутренний комментарий, не публикуется"
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
        />
      </FieldRow>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-2 border-t border-line bg-bg/95 px-6 py-3 backdrop-blur">
        {m.isSuccess && (
          <span className="inline-flex items-center gap-1 text-xs text-leaf">
            <Check className="h-3.5 w-3.5" /> сохранено
          </span>
        )}
        {m.isError && (
          <span className="inline-flex items-center gap-1 text-xs text-rust">
            <AlertTriangle className="h-3.5 w-3.5" /> ошибка
          </span>
        )}
        <button
          onClick={save}
          disabled={m.isPending}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50"
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Сохранить
        </button>
      </div>
    </div>
  );
}

function FieldRow({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="smallcaps mb-1 block text-[10px] text-ink-mute">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-ink-mute">{hint}</p>}
    </div>
  );
}

function ChipsField({
  label, value, onChange, placeholder, icon,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon?: React.ReactNode;
}) {
  return (
    <FieldRow label={label} hint="Через запятую">
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mute">
            {icon}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30 ${icon ? "pl-8" : ""}`}
        />
      </div>
    </FieldRow>
  );
}

function PriorityPicker({ value, onChange }: { value: CardPriority; onChange: (p: CardPriority) => void }) {
  const items: { v: CardPriority; label: string; cls: string }[] = [
    { v: "low",    label: "low",    cls: "border-line bg-bg-subtle text-ink-mute" },
    { v: "normal", label: "normal", cls: "border-line bg-bg-elevated text-ink-dim" },
    { v: "high",   label: "high",   cls: "border-amber/40 bg-amber/10 text-amber" },
    { v: "urgent", label: "urgent", cls: "border-rust/40 bg-rust/10 text-rust" },
  ];
  return (
    <div className="flex gap-1">
      {items.map((it) => (
        <button
          key={it.v}
          type="button"
          onClick={() => onChange(it.v)}
          className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] transition-colors ${
            value === it.v ? it.cls : "border-line text-ink-mute hover:bg-bg-subtle"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ─── Content tab ───────────────────────────────────────────────────────

function ContentTab({ suggestionID }: { suggestionID: string }) {
  const q = useQuery({
    queryKey: ["suggestion-content", suggestionID],
    queryFn: () => listContent(suggestionID),
    enabled: !!suggestionID,
  });
  return <ContentTabs content={q.data ?? []} loading={q.isLoading} />;
}

// ─── Comments tab ──────────────────────────────────────────────────────

function CommentsTab({ cardID }: { cardID: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["card-comments", cardID],
    queryFn: () => listPlanCardComments(cardID),
  });
  const [body, setBody] = useState("");
  const m = useMutation({
    mutationFn: () => addPlanCardComment(cardID, body),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["card-comments", cardID] });
      qc.invalidateQueries({ queryKey: ["card-activity", cardID] });
    },
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) m.mutate();
        }}
        className="space-y-2 rounded-lg border border-line bg-bg-subtle/40 p-3"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Оставьте заметку для команды…"
          className="w-full resize-none bg-transparent text-sm placeholder:text-ink-mute focus:outline-none"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={!body.trim() || m.isPending}
            className="flex items-center gap-1.5 rounded-md bg-leaf px-3 py-1.5 text-xs font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
          >
            {m.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Отправить
          </button>
        </div>
      </form>

      {q.isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-bg-elevated" />
          ))}
        </div>
      ) : (q.data?.length ?? 0) === 0 ? (
        <div className="rounded-md border border-dashed border-line py-6 text-center text-xs text-ink-mute">
          Пока без комментариев
        </div>
      ) : (
        <ul className="space-y-2">
          {q.data!.map((c) => (
            <li key={c.id} className="rounded-md border border-line bg-bg-elevated/60 p-3">
              <div className="mb-1 flex items-baseline justify-between text-[11px] text-ink-mute">
                <span className="font-mono">{c.author_username ?? "пользователь"}</span>
                <span>{relTime(c.created_at)}</span>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Activity tab ──────────────────────────────────────────────────────

function ActivityTab({ cardID }: { cardID: string }) {
  const q = useQuery({
    queryKey: ["card-activity", cardID],
    queryFn: () => listPlanCardActivity(cardID),
  });

  if (q.isLoading) {
    return <div className="h-32 animate-pulse rounded-md bg-bg-elevated" />;
  }
  if ((q.data?.length ?? 0) === 0) {
    return (
      <div className="rounded-md border border-dashed border-line py-6 text-center text-xs text-ink-mute">
        События пока не зафиксированы
      </div>
    );
  }

  return (
    <ul className="relative space-y-3 border-l border-line pl-4">
      {q.data!.map((a) => (
        <ActivityRow key={a.id} a={a} />
      ))}
    </ul>
  );
}

function ActivityRow({ a }: { a: PlanCardActivity }) {
  const { label, dot } = activityCopy(a);
  return (
    <li className="relative">
      <span
        className="absolute -left-[19px] top-1.5 grid h-3 w-3 place-items-center rounded-full border border-bg bg-bg-subtle"
        style={{ background: `hsl(var(--${dot}))` }}
      />
      <div className="text-xs">
        <span className="text-ink">{label}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-2 text-[11px] text-ink-mute">
        <span className="font-mono">{a.author_username ?? "система"}</span>
        <span>·</span>
        <span>{relTime(a.created_at)}</span>
      </div>
    </li>
  );
}

function activityCopy(a: PlanCardActivity): { label: React.ReactNode; dot: string } {
  switch (a.kind) {
    case "created":
      return { label: <>Карточка создана</>, dot: "leaf" };
    case "moved": {
      const from = (a.payload?.from as string) || "—";
      const to   = (a.payload?.to as string)   || "—";
      return {
        label: (
          <>
            Перемещена{" "}
            <span className="font-mono text-ink-mute">{from}</span>
            {" → "}
            <span className="font-mono text-leaf">{to}</span>
          </>
        ),
        dot: "amber",
      };
    }
    case "edited": {
      const fields = (a.payload?.fields as string[]) ?? [];
      return {
        label: (
          <>
            Изменены поля{" "}
            <span className="font-mono text-ink-mute">{fields.join(", ")}</span>
          </>
        ),
        dot: "sky",
      };
    }
    case "commented":
      return {
        label: (
          <>
            Новый комментарий
            {a.payload?.preview ? (
              <span className="block text-ink-mute italic">«{String(a.payload.preview)}…»</span>
            ) : null}
          </>
        ),
        dot: "plum",
      };
    case "archived":
      return { label: <>Карточка архивирована</>, dot: "rust" };
    case "linked_content_published":
      return {
        label: (
          <>
            Опубликован контент{" "}
            <span className="font-mono text-ink-mute">{String(a.payload?.channel ?? "")}</span>
          </>
        ),
        dot: "leaf",
      };
    default:
      return { label: <>{a.kind}</>, dot: "ink-mute" };
  }
}

// ─── tiny shared helper ────────────────────────────────────────────────

function relTime(iso: string): string {
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
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

// `Plus` is imported but only used in a future iteration (attachments
// quick-add). Keep the import for the next phase rather than dropping it.
void Plus;
