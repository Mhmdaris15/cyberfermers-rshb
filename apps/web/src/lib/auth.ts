import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

// ============================================================
//   Auth client — token storage + axios wiring + useAuth hook
//
//   Storage choice: localStorage under a namespaced key. FE and API
//   live on different subdomains (cyberfermers... vs api-cyberfermers...)
//   so an httpOnly cookie would need SameSite=None+Secure plus careful
//   CORS — the Bearer header pattern is simpler and works today.
//
//   Token leakage surface: XSS. Mitigations rely on the existing CSP,
//   no innerHTML usage in this codebase, and no third-party scripts.
// ============================================================

const TOKEN_KEY = "svoe.auth.token";
const USER_KEY = "svoe.auth.user";

export interface AuthUser {
  id: string;
  username: string;
  role: "admin" | "user";
  display_name?: string | null;
  disabled?: boolean;
}

export interface LoginPayload {
  token: string;
  expires_at: string;
  user: AuthUser;
}

// ───── token plumbing ────────────────────────────────────────────────────

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* localStorage disabled / quota — login will fail on next refresh */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* noop */
  }
}

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(u: AuthUser | null): void {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* noop */
  }
}

// ───── axios interceptors ───────────────────────────────────────────────
// Module-side effect: attach interceptors exactly once when this file is
// first imported. The api instance is the singleton from ./api.

let interceptorsInstalled = false;
function installInterceptorsOnce() {
  if (interceptorsInstalled) return;
  interceptorsInstalled = true;

  api.interceptors.request.use((cfg) => {
    const token = getToken();
    if (token) {
      cfg.headers = cfg.headers ?? {};
      // axios v1 — headers is AxiosHeaders, supports set()
      // but plain assignment still works for compatibility.
      (cfg.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return cfg;
  });

  api.interceptors.response.use(
    (r) => r,
    (err) => {
      const status = err?.response?.status;
      if (status === 401) {
        clearToken();
        // Bounce to /login from anywhere except /login itself.
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          const next = encodeURIComponent(
            window.location.pathname + window.location.search,
          );
          window.location.assign(`/login?next=${next}`);
        }
      }
      return Promise.reject(err);
    },
  );
}
installInterceptorsOnce();

// ───── auth API ──────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<LoginPayload> {
  const { data } = await api.post<LoginPayload>("/api/auth/login", {
    username: username.trim(),
    password,
  });
  setToken(data.token);
  writeCachedUser(data.user);
  return data;
}

export async function logout(): Promise<void> {
  try {
    // Best-effort server-side revoke. We clear local state regardless.
    await api.post("/api/auth/logout");
  } catch {
    /* noop — token may already be invalid */
  }
  clearToken();
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<{ user: AuthUser }>("/api/auth/me");
  writeCachedUser(data.user);
  return data.user;
}

// ───── useAuth hook ──────────────────────────────────────────────────────
// Lightweight — no global context provider. Each component that needs
// auth state calls useAuth and gets a fresh snapshot. Mutations broadcast
// via a tiny event bus so all consumers stay in sync without re-rendering
// the whole app.

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  for (const l of listeners) l();
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => readCachedUser());
  const [loading, setLoading] = useState<boolean>(() => Boolean(getToken()) && !readCachedUser());

  // Subscribe to broadcast updates.
  useEffect(() => {
    const l: Listener = () => setUser(readCachedUser());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  // First mount: if we have a token but no cached user, hydrate from /me.
  useEffect(() => {
    if (!getToken() || readCachedUser()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const u = await fetchMe();
        if (!cancelled) {
          setUser(u);
          notify();
        }
      } catch {
        if (!cancelled) {
          clearToken();
          setUser(null);
          notify();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const doLogin = useCallback(async (username: string, password: string) => {
    const payload = await login(username, password);
    setUser(payload.user);
    notify();
    return payload.user;
  }, []);

  const doLogout = useCallback(async () => {
    await logout();
    setUser(null);
    notify();
  }, []);

  const refresh = useCallback(async () => {
    const u = await fetchMe();
    setUser(u);
    notify();
    return u;
  }, []);

  return {
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === "admin",
    login: doLogin,
    logout: doLogout,
    refresh,
  };
}
