import { forwardRef, FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslate } from "@tolgee/react";
import { Eye, EyeOff, KeyRound, Loader2, User } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

// =====================================================================
//  Login — "Sowing, a ritual entrance"
//
//  Aesthetic intent: this is the first impression every judge gets, so
//  the page is treated as a small editorial spread, not a form-shoved-
//  into-the-middle-of-the-screen template. Three deliberate moves:
//
//    1. Asymmetric split: 56/44 on desktop. Left half is an SVG seed
//       painting itself into a stem-and-leaf on first load, then idling
//       with a gentle sway. Right half is the glass form.
//    2. Fraunces variable axis at high opsz for the headline italic.
//    3. Editorial small-caps labels and a status footer pull the
//       composition together as one page, not "form + decoration".
//
//  Russian first because judges are Russian; English would feel false.
// =====================================================================

export function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const reduce = useReducedMotion();
  const { t } = useTranslate();

  // Where to return after login. `?next=` is set by RequireAuth.
  const params = new URLSearchParams(loc.search);
  const nextPath = params.get("next") || "/farmers";

  // Already authenticated? Bounce. (Catches direct visits to /login.)
  useEffect(() => {
    if (!authLoading && isAuthenticated) nav(nextPath, { replace: true });
  }, [authLoading, isAuthenticated, nav, nextPath]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      nav(nextPath, { replace: true });
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { code?: string; error?: string } } };
      const code = ax?.response?.data?.code;
      // Map server error codes → localized messages. Server's free-form
      // `error` text is used only as a last-resort fallback because it's
      // currently Russian-only.
      let msg = ax?.response?.data?.error ?? t("errors.login.generic");
      if (code === "invalid_credentials") msg = t("errors.login.invalidCredentials");
      if (code === "account_disabled") msg = t("errors.login.accountDisabled");
      if (code === "rate_limited") msg = t("errors.login.rateLimited");
      setError(msg);
      setShake((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative grid min-h-screen grid-cols-1 overflow-hidden lg:grid-cols-[1.27fr_1fr]">
      {/* atmospheric layers — visible on both halves */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{
          backgroundImage: `
            radial-gradient(60rem 40rem at 20% 30%, hsl(var(--leaf) / 0.12), transparent 60%),
            radial-gradient(50rem 30rem at 90% 80%, hsl(var(--amber) / 0.10), transparent 60%),
            radial-gradient(40rem 30rem at 10% 95%, hsl(var(--plum) / 0.08), transparent 60%)`,
        }}
      />
      <div
        aria-hidden
        className="grain absolute inset-0 -z-10 opacity-40"
        style={{ filter: "blur(0.5px)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 grid-bg [mask-image:radial-gradient(80rem_50rem_at_30%_40%,#000_30%,transparent_75%)] opacity-50"
      />

      {/* ────── LEFT — sowing visual ─────────────────────────────── */}
      <aside className="relative hidden flex-col justify-between p-10 lg:flex xl:p-14">
        <header className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-leaf to-amber text-bg shadow-glow">
            <span className="font-display text-lg font-bold leading-none">С</span>
          </div>
          <div className="font-display text-sm font-semibold tracking-tight">
            {t("common.brand.name")}
            <span className="ml-2 text-ink-mute font-sans font-normal smallcaps text-[10px]">
              {t("common.brand.short")}
            </span>
          </div>
        </header>

        {/* Centerpiece: the seed-stem SVG */}
        <div className="flex flex-1 items-center justify-center py-10">
          <SowingArt animate={!reduce} />
        </div>

        {/* Editorial caption — italic Fraunces flourish */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.7, ease: [0.2, 0.65, 0.2, 1] }}
          className="max-w-md"
        >
          <p className="smallcaps text-[11px] text-ink-mute">{t("auth.login.season")}</p>
          <h2 className="mt-2 font-display text-3xl leading-[1.05] tracking-tight">
            {t("auth.login.poem.before")}{" "}
            <span className="gradient-text italic">{t("auth.login.poem.after")}</span>.
          </h2>
          <p className="mt-3 text-sm text-ink-dim">
            {t("auth.login.poem.body")}
          </p>
        </motion.div>
      </aside>

      {/* ────── RIGHT — form column ─────────────────────────────── */}
      <main className="relative flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
        {/* Mobile-only hero strip above the form */}
        <div className="absolute left-0 right-0 top-0 h-32 overflow-hidden lg:hidden">
          <div className="absolute inset-0 grid-bg opacity-50" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-bg" />
          <div className="absolute left-6 top-6 flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-leaf to-amber text-bg shadow-glow">
              <span className="font-display text-base font-bold leading-none">С</span>
            </div>
            <div className="font-display text-sm font-semibold">КиберФермеры</div>
          </div>
        </div>

        <motion.div
          key={shake} /* re-mounting the wrapper on shake re-fires the animation */
          initial={{ opacity: 0, y: 12 }}
          animate={
            shake > 0
              ? { opacity: 1, y: 0, x: [0, -8, 8, -6, 6, -3, 3, 0] }
              : { opacity: 1, y: 0 }
          }
          transition={
            shake > 0
              ? { duration: 0.45, ease: "easeOut" }
              : { duration: 0.45, ease: [0.2, 0.65, 0.2, 1] }
          }
          className="glass-strong relative w-full max-w-md rounded-2xl px-8 py-10 shadow-glass sm:px-10"
        >
          {/* corner ornament: hairline cross */}
          <span
            aria-hidden
            className="pointer-events-none absolute right-5 top-5 h-3 w-3 text-ink-mute/40"
          >
            <svg viewBox="0 0 12 12" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="0.6">
              <path d="M6 0v12M0 6h12" />
            </svg>
          </span>

          <div className="absolute right-5 top-12 hidden sm:block">
            <LanguageSwitcher variant="compact" />
          </div>

          <div className="smallcaps text-[11px] text-leaf">{t("auth.login.eyebrow")}</div>
          <h1 className="mt-2 font-display text-[2.1rem] leading-[1.05] tracking-tight">
            {t("auth.login.title.before")}{" "}
            <span className="italic gradient-text">{t("auth.login.title.brand")}</span>
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            {t("auth.login.subtitle")}
          </p>

          <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
            <Field
              ref={usernameRef}
              id="username"
              label={t("auth.login.field.username")}
              icon={<User className="h-4 w-4" />}
              value={username}
              onChange={(v) => setUsername(v)}
              autoComplete="username"
              disabled={submitting}
            />
            <Field
              id="password"
              label={t("auth.login.field.password")}
              icon={<KeyRound className="h-4 w-4" />}
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(v) => setPassword(v)}
              autoComplete="current-password"
              disabled={submitting}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="grid h-7 w-7 place-items-center rounded text-ink-mute transition-colors hover:bg-bg-subtle hover:text-ink-dim focus-ring"
                  aria-label={showPw ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-md border border-rust/30 bg-rust/10 px-3 py-2 text-sm text-rust">
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="group relative flex w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 py-3 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none focus-ring"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t("auth.login.submitting")}</span>
                </>
              ) : (
                <>
                  <span>{t("auth.login.submit")}</span>
                  <span
                    aria-hidden
                    className="rounded border border-bg/30 px-1.5 py-0 font-mono text-[10px] leading-4 text-bg/80 transition-transform group-hover:translate-x-0.5"
                  >
                    ↵
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Admin-managed reminder — replaces "forgot password" */}
          <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-ink-mute">
            <span className="smallcaps mr-1.5 text-ink-dim">{t("auth.login.adminNote.prefix")}</span>
            {t("auth.login.adminNote.body")}{" "}
            <span className="italic text-ink-dim">{t("auth.login.adminNote.suffix")}</span>.
          </p>
        </motion.div>

        {/* Bottom status strip */}
        <footer className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-1 text-[11px] text-ink-mute">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-leaf opacity-60" />
              <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-leaf" />
            </span>
            <span className="smallcaps">{t("common.status.online")}</span>
          </div>
          <Link to="/" className="transition-colors hover:text-ink-dim">
            {t("common.cta.backToHome")}
          </Link>
        </footer>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  <Field> — floating-label input that we use for username + password.
//  The label nestles inside the input while empty, lifts on focus/value.
// ──────────────────────────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  autoComplete?: string;
  disabled?: boolean;
}

// React reserves `ref` as a special prop name — it can't be passed
// through a regular function-component-typed-as-FC. We use forwardRef so
// the parent's <Field ref={usernameRef} ...> hooks the DOM <input>
// without triggering the "ref is not a prop" warning in production builds.
const Field = forwardRef<HTMLInputElement, FieldProps>((props, ref) => {
  const {
    id, label, value, onChange, type = "text",
    icon, suffix, autoComplete, disabled,
  } = props;
  return (
    <div className="group relative">
      {icon && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute transition-colors group-focus-within:text-leaf">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder=" "
        className={`peer w-full rounded-md border border-line bg-bg-elevated/60 px-3 py-3.5 pl-10 ${
          suffix ? "pr-11" : ""
        } text-sm text-ink placeholder-transparent transition-colors focus:border-leaf focus:bg-bg-elevated focus:outline-none focus:ring-2 focus:ring-leaf/30 disabled:opacity-60`}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-10 top-3.5 origin-left text-sm text-ink-mute transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-ink-mute peer-focus:-top-2 peer-focus:left-3 peer-focus:bg-bg-elevated peer-focus:px-1.5 peer-focus:text-[11px] peer-focus:text-leaf peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:bg-bg-elevated peer-[:not(:placeholder-shown)]:px-1.5 peer-[:not(:placeholder-shown)]:text-[11px]"
      >
        {label}
      </label>
      {suffix && (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">{suffix}</div>
      )}
    </div>
  );
});
Field.displayName = "Field";

// ──────────────────────────────────────────────────────────────────────────
//  <SowingArt> — custom SVG: a seed grows into a stem and leaf via
//  stroke-dasharray paint-on. After the paint completes, a gentle
//  perpetual sway loops via Framer Motion. No third-party graphics.
// ──────────────────────────────────────────────────────────────────────────

function SowingArt({ animate }: { animate: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative aspect-square w-full max-w-[460px]"
    >
      {/* concentric horizon rings — the "field" the seed sits in */}
      <svg
        viewBox="0 0 400 400"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="stem" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="hsl(var(--amber))" stopOpacity="0.0" />
            <stop offset="35%" stopColor="hsl(var(--leaf))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(var(--leaf))" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="leaf-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--leaf))" stopOpacity="0.85" />
            <stop offset="100%" stopColor="hsl(var(--amber))" stopOpacity="0.6" />
          </linearGradient>
          <radialGradient id="seed" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--amber))" />
            <stop offset="100%" stopColor="hsl(var(--rust))" />
          </radialGradient>
        </defs>

        {/* horizon rings */}
        {[170, 130, 90, 50].map((r, i) => (
          <motion.circle
            key={r}
            cx="200"
            cy="260"
            r={r}
            fill="none"
            stroke="hsl(var(--line))"
            strokeOpacity={0.35 - i * 0.06}
            strokeDasharray="2 6"
            initial={animate ? { pathLength: 0, opacity: 0 } : false}
            animate={animate ? { pathLength: 1, opacity: 1 } : undefined}
            transition={{ duration: 1.2, delay: 0.1 + i * 0.12, ease: "easeOut" }}
          />
        ))}

        {/* ground line */}
        <motion.line
          x1="40"
          y1="260"
          x2="360"
          y2="260"
          stroke="hsl(var(--line))"
          strokeOpacity="0.55"
          initial={animate ? { pathLength: 0 } : false}
          animate={animate ? { pathLength: 1 } : undefined}
          transition={{ duration: 0.9, delay: 0.05 }}
        />

        {/* the seed */}
        <motion.ellipse
          cx="200"
          cy="262"
          rx="6.5"
          ry="9"
          fill="url(#seed)"
          initial={animate ? { scale: 0, opacity: 0 } : false}
          animate={animate ? { scale: 1, opacity: 1 } : undefined}
          transition={{ duration: 0.5, delay: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ transformOrigin: "200px 262px" }}
        />

        {/* swaying stem + leaf group */}
        <motion.g
          style={{ originX: "200px", originY: "260px" }}
          animate={
            animate
              ? { rotate: [0, 1.4, -1.0, 0.8, 0] }
              : undefined
          }
          transition={
            animate
              ? {
                  duration: 7,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: 2.4,
                }
              : undefined
          }
        >
          {/* stem — curves from seed upward, paints on */}
          <motion.path
            d="M200 260 C 200 220, 188 188, 196 140 S 212 90, 200 60"
            fill="none"
            stroke="url(#stem)"
            strokeWidth="2.4"
            strokeLinecap="round"
            initial={animate ? { pathLength: 0 } : false}
            animate={animate ? { pathLength: 1 } : undefined}
            transition={{ duration: 1.6, delay: 1.1, ease: "easeInOut" }}
          />

          {/* left leaf — opens like a teardrop */}
          <motion.path
            d="M196 168 C 168 158, 142 174, 138 198 C 168 200, 192 188, 196 168 Z"
            fill="url(#leaf-fill)"
            opacity="0.9"
            initial={animate ? { scale: 0, opacity: 0 } : false}
            animate={animate ? { scale: 1, opacity: 0.95 } : undefined}
            transition={{ duration: 0.65, delay: 2.0, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ transformOrigin: "196px 184px" }}
          />
          <path
            d="M196 168 C 178 174, 162 184, 148 196"
            fill="none"
            stroke="hsl(var(--leaf))"
            strokeOpacity="0.6"
            strokeWidth="1"
          />

          {/* right leaf — higher, smaller */}
          <motion.path
            d="M202 112 C 222 104, 244 114, 246 134 C 224 138, 206 130, 202 112 Z"
            fill="url(#leaf-fill)"
            opacity="0.85"
            initial={animate ? { scale: 0, opacity: 0 } : false}
            animate={animate ? { scale: 1, opacity: 0.9 } : undefined}
            transition={{ duration: 0.6, delay: 2.25, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ transformOrigin: "202px 124px" }}
          />

          {/* terminal bud — a small amber gleam at the very top */}
          <motion.circle
            cx="200"
            cy="60"
            r="3.2"
            fill="hsl(var(--amber))"
            initial={animate ? { scale: 0, opacity: 0 } : false}
            animate={
              animate
                ? {
                    scale: [0, 1.15, 1],
                    opacity: 1,
                  }
                : undefined
            }
            transition={{ duration: 0.7, delay: 2.5, ease: [0.2, 0.8, 0.2, 1] }}
          />
          <motion.circle
            cx="200"
            cy="60"
            r="3.2"
            fill="hsl(var(--amber))"
            initial={animate ? { opacity: 0 } : false}
            animate={animate ? { scale: [1, 2.3, 1], opacity: [0.5, 0, 0.5] } : undefined}
            transition={{ duration: 2.6, delay: 3.2, repeat: Infinity, ease: "easeOut" }}
            style={{ transformOrigin: "200px 60px" }}
          />
        </motion.g>

        {/* compass tick marks on the outer ring */}
        {[0, 90, 180, 270].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 200 + Math.cos(rad) * 168;
          const y1 = 260 + Math.sin(rad) * 168;
          const x2 = 200 + Math.cos(rad) * 174;
          const y2 = 260 + Math.sin(rad) * 174;
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="hsl(var(--ink-mute))"
              strokeOpacity="0.5"
              strokeWidth="1"
            />
          );
        })}

        {/* tiny atmospheric particles drifting up */}
        {animate &&
          [0, 1, 2, 3, 4].map((i) => (
            <motion.circle
              key={i}
              cx={180 + i * 12}
              cy={260}
              r="1.1"
              fill="hsl(var(--amber))"
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: -200 - i * 20, opacity: [0, 0.7, 0] }}
              transition={{
                duration: 5 + i * 0.8,
                delay: 3 + i * 0.4,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}
      </svg>

      {/* meta label on the bottom-left of the art */}
      <div className="pointer-events-none absolute bottom-1 left-1 font-mono text-[10px] uppercase tracking-widest text-ink-mute/60">
        fig.&nbsp;1&nbsp;·&nbsp;ferma&nbsp;rosta
      </div>
    </motion.div>
  );
}
