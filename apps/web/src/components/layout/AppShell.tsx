import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BellRing,
  BookOpen,
  BookText,
  Calendar,
  ChefHat,
  LayoutDashboard,
  ListChecks,
  Share2,
  Sparkles,
  Store,
  Settings,
  Menu,
  X,
  ArrowLeftRight,
} from "lucide-react";
import { useTranslate } from "@tolgee/react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getFarmer } from "@/lib/api";
import { ChatLauncher, ChatSheet } from "@/components/chat/ChatSheet";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { UserMenu } from "@/components/auth/UserMenu";

// Nav items are static (icons + route slugs); the visible label is resolved
// at render time so language switches re-render the labels in place.
const items = [
  { to: "dashboard", labelKey: "nav.dashboard", Icon: LayoutDashboard },
  { to: "calendar",  labelKey: "nav.calendar",  Icon: Calendar },
  { to: "plan",      labelKey: "nav.plan",      Icon: ListChecks },
  { to: "stories",   labelKey: "nav.stories",   Icon: BookOpen },
  { to: "blogs",     labelKey: "nav.blogs",     Icon: BookText },
  { to: "recipes",   labelKey: "nav.recipes",   Icon: ChefHat },
  { to: "social",    labelKey: "nav.social",    Icon: Share2 },
  { to: "push",      labelKey: "nav.push",      Icon: BellRing },
  { to: "products",  labelKey: "nav.products",  Icon: Store },
  { to: "ai",        labelKey: "nav.ai",        Icon: Sparkles },
  { to: "settings",  labelKey: "nav.settings",  Icon: Settings },
] as const;

export function AppShell() {
  const { farmerId = "10060" } = useParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const location = useLocation();
  const { t } = useTranslate();

  // Close drawer on every route change.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const farmer = useQuery({
    queryKey: ["farmer", farmerId],
    queryFn: () => getFarmer(farmerId),
  });

  return (
    <div className="min-h-screen bg-bg text-ink lg:grid lg:grid-cols-[260px,1fr]">
      {/* ===== Desktop sidebar ===== */}
      <Sidebar farmerId={farmerId} />

      {/* ===== Mobile drawer ===== */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          >
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-line"
            >
              <SidebarBody
                farmerId={farmerId}
                onLinkClick={() => setMobileOpen(false)}
                variant="mobile"
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-h-screen flex-col">
        {/* ===== Top bar ===== */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-bg-elevated text-ink lg:hidden"
              aria-label={t("nav.openMenu")}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex flex-col leading-tight">
              <div className="smallcaps text-[10px] text-ink-mute">{t("nav.farmer.label")}</div>
              <div className="truncate text-sm font-semibold">
                {farmer.data?.shop_name ?? `#${farmerId}`}
              </div>
            </div>
            <Link
              to="/farmers"
              className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-bg-elevated/60 px-2.5 py-1.5 text-xs text-ink-dim transition hover:border-leaf/40 hover:text-leaf focus-ring"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("nav.farmer.switch")}</span>
              <span className="sm:hidden">{t("nav.farmer.switchShort")}</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-mute">
            <span className="hidden items-center gap-1.5 md:inline-flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-leaf" />
              <span>{t("common.status.apiLive")}</span>
            </span>
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Floating AI chat launcher + drawer */}
      <ChatLauncher onClick={() => setChatOpen(true)} />
      <ChatSheet open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}

function Sidebar({
  farmerId,
  onLinkClick,
}: {
  farmerId: string;
  onLinkClick?: () => void;
}) {
  return (
    <aside className="relative hidden h-full min-h-screen flex-col gap-2 border-r border-line bg-bg-subtle/50 backdrop-blur lg:flex">
      <SidebarBody farmerId={farmerId} onLinkClick={onLinkClick} variant="desktop" />
    </aside>
  );
}

// Body factored out so it works both inside the persistent desktop aside AND
// the mobile drawer overlay.
function SidebarBody({
  farmerId,
  onLinkClick,
  variant,
}: {
  farmerId: string;
  onLinkClick?: () => void;
  variant: "desktop" | "mobile";
}) {
  const { t } = useTranslate();
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-leaf to-amber text-bg shadow-glow">
            <span className="font-display text-lg font-bold">С</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm font-semibold tracking-tight">{t("common.brand.name")}</span>
            <span className="text-[11px] uppercase tracking-widest text-ink-mute">
              {t("common.brand.tagline")}
            </span>
          </div>
        </div>
        {variant === "mobile" && (
          <button
            onClick={onLinkClick}
            aria-label={t("common.cta.close")}
            className="text-ink-mute hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {items.map(({ to, labelKey, Icon }) => (
          <NavLink
            key={to}
            to={`/farmer/${farmerId}/${to}`}
            onClick={onLinkClick}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-bg-elevated text-ink shadow-inner"
                  : "text-ink-dim hover:bg-bg-elevated hover:text-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId={`nav-pill-${variant}`}
                    className="absolute inset-y-1 left-1 w-1 rounded-full bg-leaf"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className="h-4 w-4" />
                <span>{t(labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-3 py-4">
        <div className="glass rounded-xl p-3 text-xs text-ink-dim">
          <div className="mb-1 flex items-center gap-1 text-ink">
            <Sparkles className="h-3.5 w-3.5 text-amber" />
            <span className="font-medium">{t("nav.geminiConnected")}</span>
          </div>
          {t("nav.geminiBlurb")}
        </div>
      </div>
    </>
  );
}

