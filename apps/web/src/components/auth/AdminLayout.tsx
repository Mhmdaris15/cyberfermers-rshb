import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, ShieldAlert, Users2, Network } from "lucide-react";
import { useAuth } from "@/lib/auth";

// AdminLayout — chrome shared by /admin/users and /admin/sessions.
// Editorial console feel: minimal hairlines, smallcaps section labels,
// and a top-right "kill switch" red treatment to signal privileged area.
export function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  async function onLogout() {
    await logout();
    nav("/login", { replace: true });
  }

  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(50rem 30rem at 100% -20%, hsl(var(--rust) / 0.10), transparent 60%),
            radial-gradient(40rem 25rem at -10% 110%, hsl(var(--amber) / 0.07), transparent 60%)`,
        }}
      />

      <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => nav("/farmers")}
              className="flex items-center gap-1.5 rounded-md p-1.5 text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink"
              aria-label="Назад в приложение"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-rust/15 text-rust">
                <ShieldAlert className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="smallcaps text-[10px] leading-none text-rust">
                  привилегированная область
                </div>
                <div className="font-display text-sm font-semibold">
                  Администрирование
                </div>
              </div>
            </div>
          </div>

          {/* sub-nav */}
          <nav className="flex items-center gap-1 rounded-md border border-line bg-bg-elevated/60 p-1 text-sm">
            <SubNav to="/admin/users" icon={<Users2 className="h-3.5 w-3.5" />} label="Пользователи" />
            <SubNav to="/admin/sessions" icon={<Network className="h-3.5 w-3.5" />} label="Сессии" />
          </nav>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden items-center gap-2 rounded-full border border-line bg-bg-elevated px-3 py-1 text-xs sm:flex">
                <span className="smallcaps text-amber">admin</span>
                <span className="text-ink-mute">·</span>
                <span className="font-mono">{user.username}</span>
              </div>
            )}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-md border border-line bg-bg-elevated px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:bg-bg-subtle"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function SubNav({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors ${
          isActive
            ? "bg-bg text-ink shadow-sm"
            : "text-ink-mute hover:bg-bg-subtle hover:text-ink-dim"
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
