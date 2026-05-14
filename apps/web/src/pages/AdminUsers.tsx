import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  ShieldOff,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import {
  AdminUser,
  CreateUserBody,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { Sheet } from "@/components/ui/sheet";

// =====================================================================
//  AdminUsers — editorial console for managing team accounts.
//  Linear-row compactness + Notion-style typography. The "createdness"
//  of accounts is the foregrounded data; passwords are hidden until
//  reset is explicitly invoked.
// =====================================================================

export function AdminUsers() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [openCreate, setOpenCreate] = useState(false);
  const [actionMenuFor, setActionMenuFor] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const q = useQuery({ queryKey: ["admin-users"], queryFn: listUsers });

  const m = {
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateUser>[1] }) =>
        updateUser(id, patch),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteUser(id),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    }),
  };

  const users = q.data ?? [];

  return (
    <div className="relative">
      {/* page header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="smallcaps text-[11px] text-ink-mute">учётные записи</div>
          <h1 className="font-display text-3xl leading-tight">Пользователи</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Создавайте и&nbsp;управляйте доступом к&nbsp;платформе. Только{" "}
            <span className="text-amber">администратор</span> может видеть этот раздел.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Counter label="всего" value={users.length} />
          <Counter
            label="активные"
            value={users.filter((u) => !u.disabled).length}
            accent="leaf"
          />
          <button
            onClick={() => setOpenCreate(true)}
            className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 focus-ring"
          >
            <UserPlus className="h-4 w-4" />
            Создать пользователя
          </button>
        </div>
      </div>

      {/* loading / empty / table */}
      {q.isLoading ? (
        <TableSkeleton />
      ) : users.length === 0 ? (
        <EmptyState onCreate={() => setOpenCreate(true)} />
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-bg-elevated/40">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-left text-[11px] text-ink-mute">
              <tr>
                <th className="smallcaps px-5 py-3 font-normal">Пользователь</th>
                <th className="smallcaps px-3 py-3 font-normal">Роль</th>
                <th className="smallcaps px-3 py-3 font-normal">Статус</th>
                <th className="smallcaps px-3 py-3 font-normal">Создан</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`group border-t border-line/60 transition-colors hover:bg-bg-subtle/40 ${
                    u.disabled ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Monogram name={u.display_name || u.username} role={u.role} />
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <div className="truncate font-mono text-sm">
                            {u.username}
                          </div>
                          {u.id === me?.id && (
                            <span className="smallcaps rounded bg-amber/15 px-1.5 py-0.5 text-[9px] text-amber">
                              это&nbsp;вы
                            </span>
                          )}
                        </div>
                        {u.display_name ? (
                          <div className="truncate text-xs text-ink-mute">
                            {u.display_name}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-3 py-3.5">
                    <StatusPill disabled={u.disabled} />
                  </td>
                  <td className="px-3 py-3.5 font-mono text-xs text-ink-mute tnum">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() =>
                          setActionMenuFor(actionMenuFor === u.id ? null : u.id)
                        }
                        className="grid h-7 w-7 place-items-center rounded text-ink-mute opacity-0 transition-all hover:bg-bg-subtle hover:text-ink group-hover:opacity-100 data-[open=true]:opacity-100"
                        data-open={actionMenuFor === u.id}
                        aria-label="Действия"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      <AnimatePresence>
                        {actionMenuFor === u.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute right-0 top-9 z-10 w-56 rounded-md border border-line bg-bg-elevated p-1 text-left text-sm shadow-glass"
                          >
                            <ActionItem
                              icon={<KeyRound className="h-3.5 w-3.5" />}
                              label="Сбросить пароль"
                              onClick={() => {
                                setResetFor(u);
                                setActionMenuFor(null);
                              }}
                            />
                            <ActionItem
                              icon={<ShieldOff className="h-3.5 w-3.5" />}
                              label={u.disabled ? "Включить аккаунт" : "Отключить аккаунт"}
                              disabled={u.id === me?.id}
                              onClick={() => {
                                m.update.mutate({
                                  id: u.id,
                                  patch: { disabled: !u.disabled },
                                });
                                setActionMenuFor(null);
                              }}
                            />
                            <ActionItem
                              icon={u.role === "admin" ? <ShieldOff className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              label={u.role === "admin" ? "Снять admin" : "Сделать admin"}
                              disabled={u.id === me?.id}
                              onClick={() => {
                                m.update.mutate({
                                  id: u.id,
                                  patch: { role: u.role === "admin" ? "user" : "admin" },
                                });
                                setActionMenuFor(null);
                              }}
                            />
                            <div className="my-1 h-px bg-line" />
                            <ActionItem
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              label="Удалить пользователя"
                              destructive
                              disabled={u.id === me?.id}
                              onClick={() => {
                                setConfirmDelete(u);
                                setActionMenuFor(null);
                              }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── create user side sheet ────────────────────────────── */}
      <Sheet open={openCreate} onOpenChange={setOpenCreate}>
        <CreateUserForm
          onClose={() => setOpenCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["admin-users"] });
            setOpenCreate(false);
          }}
        />
      </Sheet>

      {/* ── reset password modal ─────────────────────────────── */}
      <Sheet open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        {resetFor && (
          <ResetPasswordForm
            user={resetFor}
            onClose={() => setResetFor(null)}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["admin-users"] });
              setResetFor(null);
            }}
          />
        )}
      </Sheet>

      {/* ── delete confirmation ──────────────────────────────── */}
      <Sheet open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        {confirmDelete && (
          <DeleteConfirm
            user={confirmDelete}
            pending={m.remove.isPending}
            onClose={() => setConfirmDelete(null)}
            onConfirm={() => {
              m.remove.mutate(confirmDelete.id, {
                onSuccess: () => setConfirmDelete(null),
              });
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

// ─── pieces ───────────────────────────────────────────────────────────────

function Counter({ label, value, accent }: { label: string; value: number; accent?: "leaf" }) {
  return (
    <div className="flex items-baseline gap-2 rounded-md border border-line bg-bg-elevated px-3 py-2">
      <span className="font-display text-xl tabular-nums">{value}</span>
      <span className={`smallcaps text-[10px] ${accent === "leaf" ? "text-leaf" : "text-ink-mute"}`}>
        {label}
      </span>
    </div>
  );
}

function Monogram({ name, role }: { name: string; role: AdminUser["role"] }) {
  const initials = name
    .replace(/[^a-zа-я0-9]/gi, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";
  const tone =
    role === "admin"
      ? "from-amber/30 to-rust/20 text-amber border-amber/40"
      : "from-leaf/25 to-leaf/10 text-leaf border-leaf/40";

  // Hexagonal "stamp" frame — a quiet reference to a farmer's wax seal.
  return (
    <div className="relative h-9 w-9 shrink-0">
      <svg viewBox="0 0 100 100" className={`absolute inset-0 h-full w-full text-ink-mute/30`} aria-hidden>
        <polygon
          points="50,4 92,28 92,72 50,96 8,72 8,28"
          fill="hsl(var(--bg-subtle))"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <div
        className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${tone} font-mono text-[11px] font-semibold`}
        style={{
          clipPath:
            "polygon(50% 4%, 92% 28%, 92% 72%, 50% 96%, 8% 72%, 8% 28%)",
        }}
      >
        {initials}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: AdminUser["role"] }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-[11px] text-amber">
        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
        admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-leaf/30 bg-leaf/10 px-2 py-0.5 text-[11px] text-leaf">
      <span className="h-1.5 w-1.5 rounded-full bg-leaf" />
      user
    </span>
  );
}

function StatusPill({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rust/30 bg-rust/10 px-2 py-0.5 text-[11px] text-rust">
        отключён
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-dim">
      <span className="relative h-1.5 w-1.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-leaf opacity-50" />
        <span className="relative h-1.5 w-1.5 rounded-full bg-leaf" />
      </span>
      активен
    </span>
  );
}

function ActionItem({
  icon, label, onClick, destructive, disabled,
}: {
  icon: React.ReactNode; label: string; onClick: () => void;
  destructive?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm transition-colors ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : destructive
            ? "text-rust hover:bg-rust/10"
            : "text-ink-dim hover:bg-bg-subtle hover:text-ink"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TableSkeleton() {
  return (
    <div className="mt-6 space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-md border border-line bg-bg-elevated/30" />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <svg viewBox="0 0 200 120" className="h-24 w-40 text-ink-mute/40" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M10 100 Q 100 60 190 100" />
        <circle cx="50" cy="92" r="3" fill="currentColor" />
        <circle cx="100" cy="78" r="3" fill="currentColor" />
        <circle cx="150" cy="86" r="3" fill="currentColor" />
        <path d="M50 92 Q 50 60 70 50" />
        <path d="M100 78 Q 100 40 80 30" />
        <path d="M150 86 Q 150 50 130 40" />
      </svg>
      <h2 className="mt-6 font-display text-xl">Никого ещё не пригласили</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-dim">
        Создайте первый аккаунт для коллеги или судьи&nbsp;— приготовьте
        для&nbsp;них пароль и&nbsp;роль.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110"
      >
        <PlusCircle className="h-4 w-4" />
        Создать первого пользователя
      </button>
    </div>
  );
}

// ─── create user side-sheet content ──────────────────────────────────────

function CreateUserForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [body, setBody] = useState<CreateUserBody>({
    username: "", password: "", role: "user", display_name: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [generatedPw, setGeneratedPw] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await createUser({
        ...body,
        display_name: body.display_name?.trim() || undefined,
      });
      onCreated();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { code?: string; error?: string } } };
      const code = ax?.response?.data?.code;
      if (code === "username_exists") setErr("Это имя пользователя уже занято.");
      else if (code === "weak_password") setErr("Пароль слишком короткий (минимум 8 символов).");
      else setErr(ax?.response?.data?.error ?? "Не удалось создать пользователя.");
    } finally {
      setPending(false);
    }
  }

  function generatePassword() {
    // 12 chars, mixed — judges can paste this out
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
    let s = "";
    const buf = new Uint32Array(12);
    crypto.getRandomValues(buf);
    for (let i = 0; i < 12; i++) s += chars[buf[i] % chars.length];
    setBody((b) => ({ ...b, password: s }));
    setGeneratedPw(s);
  }

  return (
    <SheetShell
      title="Новый пользователь"
      eyebrow="создать"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <SheetField
          label="Имя пользователя"
          value={body.username}
          onChange={(v) => setBody((b) => ({ ...b, username: v }))}
          autoComplete="off"
          required
          hint="латиница, без пробелов · станет логином"
        />
        <SheetField
          label="Отображаемое имя (необязательно)"
          value={body.display_name ?? ""}
          onChange={(v) => setBody((b) => ({ ...b, display_name: v }))}
          hint="например, «Анна Иванова»"
        />

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="smallcaps text-[11px] text-ink-mute">пароль</label>
            <button
              type="button"
              onClick={generatePassword}
              className="text-[11px] text-leaf transition-colors hover:underline"
            >
              сгенерировать сильный
            </button>
          </div>
          <input
            type="text"
            value={body.password}
            onChange={(e) => setBody((b) => ({ ...b, password: e.target.value }))}
            placeholder="минимум 8 символов"
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2.5 font-mono text-sm placeholder:text-ink-mute focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
            required
            minLength={8}
          />
          {generatedPw && (
            <div className="mt-2 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-xs leading-relaxed text-amber/90">
              <strong>Скопируйте сейчас:</strong> пароль показывается один
              раз. После создания учётной записи увидеть его снова будет
              нельзя.
            </div>
          )}
        </div>

        <div>
          <label className="smallcaps mb-1.5 block text-[11px] text-ink-mute">роль</label>
          <div className="grid grid-cols-2 gap-2">
            <RoleOption
              selected={body.role === "user"}
              title="user"
              desc="полный доступ к&nbsp;продукту, без админ-панели"
              onClick={() => setBody((b) => ({ ...b, role: "user" }))}
            />
            <RoleOption
              selected={body.role === "admin"}
              title="admin"
              desc="управление пользователями и&nbsp;сессиями"
              onClick={() => setBody((b) => ({ ...b, role: "admin" }))}
              warn
            />
          </div>
        </div>

        {err && (
          <div className="rounded-md border border-rust/30 bg-rust/10 px-3 py-2 text-sm text-rust">
            {err}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-ink-dim transition-colors hover:bg-bg-subtle"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={pending || !body.username || body.password.length < 8}
            className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Создать аккаунт
          </button>
        </div>
      </form>
    </SheetShell>
  );
}

function ResetPasswordForm({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function generate() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
    let s = "";
    const buf = new Uint32Array(12);
    crypto.getRandomValues(buf);
    for (let i = 0; i < 12; i++) s += chars[buf[i] % chars.length];
    setPw(s);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await updateUser(user.id, { password: pw });
      onDone();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax?.response?.data?.error ?? "Не удалось обновить пароль.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SheetShell title={`Новый пароль для ${user.username}`} eyebrow="сбросить" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="smallcaps text-[11px] text-ink-mute">пароль</label>
            <button
              type="button"
              onClick={generate}
              className="text-[11px] text-leaf transition-colors hover:underline"
            >
              сгенерировать сильный
            </button>
          </div>
          <input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="минимум 8 символов"
            className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2.5 font-mono text-sm placeholder:text-ink-mute focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
            required
            minLength={8}
          />
          <p className="mt-2 text-xs leading-relaxed text-amber/80">
            Сразу скопируйте пароль и&nbsp;передайте пользователю. Все
            активные сессии будут отозваны.
          </p>
        </div>
        {err && (
          <div className="rounded-md border border-rust/30 bg-rust/10 px-3 py-2 text-sm text-rust">{err}</div>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-ink-dim transition-colors hover:bg-bg-subtle">
            Отмена
          </button>
          <button
            type="submit"
            disabled={pending || pw.length < 8}
            className="flex items-center gap-2 rounded-md bg-amber px-3.5 py-2 text-sm font-medium text-bg shadow-amber transition-all hover:brightness-110 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Сбросить пароль
          </button>
        </div>
      </form>
    </SheetShell>
  );
}

function DeleteConfirm({
  user, pending, onClose, onConfirm,
}: { user: AdminUser; pending: boolean; onClose: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState("");
  return (
    <SheetShell title="Удалить пользователя" eyebrow="необратимо" onClose={onClose} accent="rust">
      <p className="text-sm leading-relaxed text-ink-dim">
        Аккаунт <span className="font-mono text-ink">{user.username}</span>{" "}
        будет удалён, все его сессии — отозваны. Это действие нельзя
        отменить.
      </p>
      <div className="mt-4">
        <label className="smallcaps mb-1.5 block text-[11px] text-ink-mute">
          введите имя пользователя для подтверждения
        </label>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={user.username}
          autoFocus
          className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2.5 font-mono text-sm placeholder:text-ink-mute/50 focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/30"
        />
      </div>
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-4">
        <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-ink-dim transition-colors hover:bg-bg-subtle">
          Отмена
        </button>
        <button
          onClick={onConfirm}
          disabled={pending || typed !== user.username}
          className="flex items-center gap-2 rounded-md bg-rust px-3.5 py-2 text-sm font-medium text-bg transition-all hover:brightness-110 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Удалить навсегда
        </button>
      </div>
    </SheetShell>
  );
}

// ─── side-sheet shell shared by Create / Reset / Delete ──────────────────

function SheetShell({
  title, eyebrow, accent = "leaf", onClose, children,
}: {
  title: string; eyebrow: string;
  accent?: "leaf" | "rust";
  onClose: () => void; children: React.ReactNode;
}) {
  const accentColor = accent === "rust" ? "text-rust" : "text-leaf";
  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-bg p-6 shadow-glass">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className={`smallcaps text-[11px] ${accentColor}`}>{eyebrow}</div>
          <h2 className="mt-1 font-display text-2xl tracking-tight">{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function SheetField({
  label, value, onChange, autoComplete, required, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  autoComplete?: string; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="smallcaps mb-1.5 block text-[11px] text-ink-mute">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-md border border-line bg-bg-elevated px-3 py-2.5 text-sm placeholder:text-ink-mute focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30"
      />
      {hint && <p className="mt-1 text-[11px] text-ink-mute">{hint}</p>}
    </div>
  );
}

function RoleOption({
  selected, title, desc, warn, onClick,
}: { selected: boolean; title: string; desc: string; warn?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-md border p-3 text-left transition-all ${
        selected
          ? warn
            ? "border-amber/60 bg-amber/10 shadow-amber"
            : "border-leaf/60 bg-leaf/10 shadow-glow"
          : "border-line hover:border-ink-mute/40 hover:bg-bg-subtle"
      }`}
    >
      <div className={`font-mono text-sm ${selected ? (warn ? "text-amber" : "text-leaf") : "text-ink"}`}>
        {title}
      </div>
      <div
        className="mt-1 text-[11px] leading-snug text-ink-mute"
        dangerouslySetInnerHTML={{ __html: desc }}
      />
    </button>
  );
}

function formatDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit", month: "short", year: "2-digit",
  });
}
