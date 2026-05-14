import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LogOut, MonitorSmartphone, ShieldOff, X } from "lucide-react";

import { AdminSession, listSessions, revokeSession } from "@/lib/admin";
import { Sheet } from "@/components/ui/sheet";

// =====================================================================
//  AdminSessions — operational view of every active session in the
//  system. Grouped by user so the admin can see "who's signed in where"
//  at a glance, with one-click revoke per session and a "kick user"
//  composite action that revokes all of a user's sessions.
//
//  Editorial: each user is a small card; sessions are dense rows
//  with parsed UA, relative time, and a quiet "live" indicator for
//  sessions touched in the last minute.
// =====================================================================

export function AdminSessions() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: () => listSessions(),
    refetchInterval: 15_000, // 15s — operational view, freshness matters
  });

  const [kickTarget, setKickTarget] = useState<{ user_id: string; username: string; sessions: AdminSession[] } | null>(null);

  const revoke = useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onMutate: async (id) => {
      // Optimistic: mark the row as revoked locally so the click feels instant.
      await qc.cancelQueries({ queryKey: ["admin-sessions"] });
      const prev = qc.getQueryData<AdminSession[]>(["admin-sessions"]);
      qc.setQueryData<AdminSession[]>(["admin-sessions"], (old) =>
        (old ?? []).map((s) => (s.id === id ? { ...s, revoked: true } : s)),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin-sessions"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-sessions"] }),
  });

  const grouped = useMemo(() => groupByUser(q.data ?? []), [q.data]);
  const totalActive = (q.data ?? []).filter((s) => !s.revoked).length;

  return (
    <div className="relative">
      {/* page header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="smallcaps text-[11px] text-ink-mute">оперативный мониторинг</div>
          <h1 className="font-display text-3xl leading-tight">Активные сессии</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Кто сейчас в&nbsp;системе и&nbsp;откуда. Обновляется каждые
            15&nbsp;секунд.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-2 rounded-md border border-line bg-bg-elevated px-3 py-2">
            <span className="font-display text-xl tabular-nums">{totalActive}</span>
            <span className="smallcaps text-[10px] text-leaf">в&nbsp;сети</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-bg-elevated/60 px-3 py-1.5 text-[11px] text-ink-mute">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-leaf opacity-60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-leaf" />
            </span>
            <span>авто-обновление</span>
          </div>
        </div>
      </div>

      {/* content */}
      {q.isLoading ? (
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-line bg-bg-elevated/30" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 space-y-4">
          {grouped.map((g) => (
            <UserGroup
              key={g.user_id}
              group={g}
              onRevoke={(id) => revoke.mutate(id)}
              onKickAll={() => setKickTarget(g)}
            />
          ))}
        </div>
      )}

      {/* kick user confirmation */}
      <Sheet open={!!kickTarget} onOpenChange={(o) => !o && setKickTarget(null)}>
        {kickTarget && (
          <KickConfirm
            username={kickTarget.username}
            sessions={kickTarget.sessions}
            pending={revoke.isPending}
            onClose={() => setKickTarget(null)}
            onConfirm={async () => {
              // Revoke each session in serial — small N, no rate concerns.
              for (const s of kickTarget.sessions) {
                if (!s.revoked) {
                  // eslint-disable-next-line no-await-in-loop
                  await revoke.mutateAsync(s.id);
                }
              }
              setKickTarget(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

// ─── pieces ───────────────────────────────────────────────────────────────

interface Grouped {
  user_id: string;
  username: string;
  sessions: AdminSession[];
}

function groupByUser(sessions: AdminSession[]): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const s of sessions) {
    const g = map.get(s.user_id) ?? { user_id: s.user_id, username: s.username, sessions: [] };
    g.sessions.push(s);
    map.set(s.user_id, g);
  }
  return [...map.values()].sort((a, b) => a.username.localeCompare(b.username));
}

function UserGroup({
  group, onRevoke, onKickAll,
}: { group: Grouped; onRevoke: (id: string) => void; onKickAll: () => void }) {
  const active = group.sessions.filter((s) => !s.revoked);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden rounded-xl border border-line bg-bg-elevated/40"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line/60 bg-bg-subtle/60 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-leaf/15 text-leaf">
            <span className="font-mono text-[11px] font-semibold">
              {group.username.slice(0, 2).toUpperCase()}
            </span>
          </span>
          <div className="font-mono text-sm">{group.username}</div>
          <span className="smallcaps text-[10px] text-ink-mute">
            {active.length} активн{active.length === 1 ? "ая" : "ых"} сесси{active.length === 1 ? "я" : "й"}
          </span>
        </div>
        {active.length > 0 && (
          <button
            onClick={onKickAll}
            className="flex items-center gap-1.5 rounded-md border border-rust/30 bg-rust/10 px-2.5 py-1 text-xs text-rust transition-colors hover:bg-rust/20"
          >
            <LogOut className="h-3.5 w-3.5" />
            Отозвать все
          </button>
        )}
      </header>

      <ul className="divide-y divide-line/40">
        <AnimatePresence initial={false}>
          {group.sessions.map((s) => (
            <SessionRow key={s.id} s={s} onRevoke={() => onRevoke(s.id)} />
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}

function SessionRow({ s, onRevoke }: { s: AdminSession; onRevoke: () => void }) {
  const ua = parseUserAgent(s.user_agent);
  const live = isLive(s.last_used_at);
  const expired = new Date(s.expires_at).getTime() < Date.now();

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: s.revoked ? 0.4 : 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-4 px-5 py-3"
    >
      <span className="grid h-9 w-9 place-items-center rounded-md bg-bg-subtle text-ink-mute">
        <MonitorSmartphone className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="truncate">{ua}</span>
          {live && !s.revoked && (
            <span className="inline-flex items-center gap-1 text-[10px] text-leaf">
              <span className="relative h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-leaf opacity-60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-leaf" />
              </span>
              <span className="smallcaps">сейчас активен</span>
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-mute">
          {s.ip && <span className="font-mono">{s.ip}</span>}
          <span>•</span>
          <span>заходил {relativeTime(s.last_used_at)}</span>
          <span>•</span>
          <span className={expired ? "text-rust" : ""}>
            до {formatDateTime(s.expires_at)}
          </span>
        </div>
      </div>

      {s.revoked ? (
        <span className="rounded-full border border-line bg-bg-subtle px-2 py-0.5 text-[11px] text-ink-mute">
          отозвана
        </span>
      ) : (
        <button
          onClick={onRevoke}
          className="flex items-center gap-1.5 rounded-md border border-line bg-bg-subtle px-2.5 py-1 text-xs text-ink-dim transition-colors hover:border-rust/40 hover:bg-rust/10 hover:text-rust"
        >
          <ShieldOff className="h-3.5 w-3.5" />
          Отозвать
        </button>
      )}
    </motion.li>
  );
}

function KickConfirm({
  username, sessions, pending, onClose, onConfirm,
}: {
  username: string; sessions: AdminSession[]; pending: boolean;
  onClose: () => void; onConfirm: () => void;
}) {
  const active = sessions.filter((s) => !s.revoked).length;
  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-bg p-6 shadow-glass">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="smallcaps text-[11px] text-rust">отозвать все сессии</div>
          <h2 className="mt-1 font-display text-2xl tracking-tight">
            Отключить <span className="font-mono">{username}</span>
          </h2>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm leading-relaxed text-ink-dim">
        Все <span className="text-ink">{active}</span> активные сессии этого
        пользователя будут немедленно отозваны. На следующем запросе любой
        его клиент получит <span className="font-mono text-amber">401</span>{" "}
        и&nbsp;вернётся на&nbsp;экран входа.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-dim">
        Сам аккаунт не&nbsp;удаляется и&nbsp;не&nbsp;отключается — пользователь
        сможет войти снова, если знает пароль.
      </p>
      <div className="mt-auto flex items-center justify-end gap-2 border-t border-line pt-4">
        <button
          onClick={onClose}
          className="rounded-md px-3 py-2 text-sm text-ink-dim transition-colors hover:bg-bg-subtle"
        >
          Отмена
        </button>
        <button
          onClick={onConfirm}
          disabled={pending}
          className="flex items-center gap-2 rounded-md bg-rust px-3.5 py-2 text-sm font-medium text-bg transition-all hover:brightness-110 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Отозвать {active}
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <div className="relative h-24 w-24 opacity-50">
        <svg viewBox="0 0 100 100" className="h-full w-full text-ink-mute" fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="50" cy="50" r="38" strokeDasharray="2 4" />
          <circle cx="50" cy="50" r="3" fill="currentColor" />
        </svg>
      </div>
      <h2 className="mt-6 font-display text-xl">Никого в&nbsp;сети</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-dim">
        Активных сессий нет. Когда пользователи войдут — они появятся здесь
        автоматически.
      </p>
    </div>
  );
}

// ─── parsing helpers ─────────────────────────────────────────────────────

function parseUserAgent(ua?: string | null): string {
  if (!ua) return "Неизвестный клиент";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : /OPR\//.test(ua) ? "Opera"
    : "Браузер";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return os ? `${browser} · ${os}` : browser;
}

function isLive(lastUsedAt: string): boolean {
  const d = new Date(lastUsedAt).getTime();
  return !Number.isNaN(d) && Date.now() - d < 90_000; // 90s window (touch debounce is 60s)
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
  return formatDateTime(iso);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
