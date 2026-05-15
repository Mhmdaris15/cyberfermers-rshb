import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  LogIn,
  LogOut,
  ShieldAlert,
  User as UserIcon,
} from "lucide-react";
import { useTranslate } from "@tolgee/react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

// =====================================================================
//  UserMenu — auth-aware identity pill with a popover panel.
//
//  Unauthenticated: renders a compact "Login" Link → /login.
//  Authenticated:   pill showing avatar + username; popover with
//                   Switch Farmer, Admin Panel (admin only), Logout.
//
//  Logout calls useAuth().logout() which best-effort revokes server
//  session and unconditionally clears localStorage (token + cached
//  user). After redeploys with rotated session secrets, this is the
//  one-click way to flush the stale token.
// =====================================================================

type Variant = "pill" | "compact";

interface Props {
  variant?: Variant;
  className?: string;
}

export function UserMenu({ variant = "pill", className }: Props) {
  const { t } = useTranslate();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const nav = useNavigate();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
      setOpen(false);
      nav("/login", { replace: true });
    }
  }

  // ── Unauthenticated state — quick Login link ───────────────────────
  if (!isAuthenticated || !user) {
    const isCompact = variant === "compact";
    return (
      <Link
        to="/login"
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-md border border-line bg-bg-elevated/60 text-ink-dim transition-colors hover:border-leaf/40 hover:text-leaf focus-ring",
          isCompact ? "h-8 w-8 justify-center" : "px-2.5 py-1.5 text-xs",
          className,
        )}
        aria-label={t("nav.userMenu.login")}
      >
        <LogIn className={cn("h-3.5 w-3.5", isCompact ? "" : "text-leaf")} />
        {!isCompact && (
          <span className="font-medium">{t("nav.userMenu.login")}</span>
        )}
      </Link>
    );
  }

  // ── Authenticated state — pill + dropdown ──────────────────────────
  const initials = (user.display_name || user.username || "?")
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("nav.userMenu.label")}
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-2 rounded-full border border-line bg-bg-elevated/70 px-2 py-1 text-xs text-ink-dim transition-colors hover:border-leaf/40 hover:text-ink focus-ring"
      >
        <span
          className={cn(
            "grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold",
            isAdmin
              ? "bg-rust/15 text-rust"
              : "bg-leaf/15 text-leaf",
          )}
        >
          {initials || <UserIcon className="h-3 w-3" />}
        </span>
        <span className="hidden font-mono tabular-nums sm:inline">
          {user.username}
        </span>
        {isAdmin && (
          <span className="smallcaps hidden text-[9px] text-rust sm:inline">
            admin
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.14, ease: [0.2, 0.65, 0.2, 1] }}
            className="glass-strong absolute right-0 top-full z-50 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-line shadow-glass"
          >
            <div className="border-b border-line/40 px-3 py-2.5">
              <div className="smallcaps text-[10px] text-ink-mute">
                {t("nav.userMenu.signedInAs")}
              </div>
              <div className="mt-0.5 truncate text-sm font-medium text-ink">
                {user.display_name || user.username}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-mute">
                <span className="font-mono">{user.username}</span>
                <span>·</span>
                <span
                  className={cn(
                    "smallcaps",
                    isAdmin ? "text-rust" : "text-leaf",
                  )}
                >
                  {isAdmin
                    ? t("nav.userMenu.role.admin")
                    : t("nav.userMenu.role.user")}
                </span>
              </div>
            </div>

            <MenuItem
              onClick={() => {
                setOpen(false);
                nav("/farmers");
              }}
              icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
              label={t("nav.userMenu.switchFarmer")}
            />

            {isAdmin && (
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  nav("/admin/users");
                }}
                icon={<ShieldAlert className="h-3.5 w-3.5 text-rust" />}
                label={t("nav.userMenu.adminPanel")}
                tone="rust"
              />
            )}

            <div className="border-t border-line/40" />

            <MenuItem
              onClick={onLogout}
              disabled={busy}
              icon={<LogOut className="h-3.5 w-3.5" />}
              label={t("nav.userMenu.logout")}
              tone="dim"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  label,
  tone,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone?: "rust" | "dim";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:opacity-50",
        tone === "rust"
          ? "text-rust hover:bg-rust/10"
          : tone === "dim"
            ? "text-ink-dim hover:bg-bg-subtle hover:text-ink"
            : "text-ink-dim hover:bg-bg-subtle hover:text-ink",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
