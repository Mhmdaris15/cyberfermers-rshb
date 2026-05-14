# Authentication System — Design Spec

> Status: draft for review · 2026-05-14
> Scope: protect Gemini-billed endpoints (and the rest of the app) behind real user accounts; admin-managed user creation; production-grade UI.

---

## 1 · Why

Two `/api` endpoints hit Gemini and cost real money per call:

- `POST /api/suggestions/:id/generate` — content generation
- `POST /api/farmers/:id/chat` — multi-turn chat with 5 tools

Both are currently open to the internet. Anyone who finds the URL can burn API budget. We're adding authentication to gate the whole app, with an admin role that can create users from a dashboard.

This is **not** a marketing landing page anymore — it's a logged-in product that judges receive credentials for.

---

## 2 · Architecture

```
                                              ┌──── POST /api/auth/login    (public)
                                              │     POST /api/auth/logout
                                              │     GET  /api/auth/me
   ┌─────────────┐  Bearer <token>  ┌────────▼─────────────┐
   │  React FE   │ ────────────────►│ Gin auth middleware  │
   │  (Vite TS)  │                  │ token → session →    │
   └──┬──────────┘                  │ user → context       │
      │                             └──┬───────────────────┘
      │  axios interceptors            │
      │  • attach Bearer on req        ├─ /api/farmers/*       (any logged-in)
      │  • on 401 → redirect /login    ├─ /api/suggestions/*
      │  • on 403 → toast              ├─ /api/plan/*
      │  • refresh user via /me        ├─ /api/farmers/:id/chat
      │                                ├─ /api/suggestions/:id/generate
      │                                │
      │                                └─ /api/admin/*         (role=admin)
      │                                    ├── users CRUD
      │                                    └── sessions list/revoke
```

**Trust boundaries:**

- **Public:** `POST /api/auth/login`, `GET /health` (Docker probe), `HEAD /health`.
- **Authenticated:** everything else under `/api/*`.
- **Admin-only:** `/api/admin/*`.

**Component placement:**

| Package | New file | Purpose |
|---|---|---|
| `apps/api/internal/auth/` | `password.go` | bcrypt hash + verify |
| `apps/api/internal/auth/` | `token.go` | crypto/rand 32-byte token + SHA-256 hash |
| `apps/api/internal/auth/` | `bootstrap.go` | first-admin seeding from env |
| `apps/api/internal/middleware/` | `auth.go` | `RequireAuth`, `RequireAdmin` |
| `apps/api/internal/handlers/` | `auth.go` | login, logout, me handlers |
| `apps/api/internal/handlers/` | `admin.go` | user + session CRUD handlers |
| `apps/api/internal/db/` | `auth_repo.go` | `app_user` and `session` queries |
| `apps/api/internal/models/` | `auth.go` | `User`, `UserPublic`, `Session` structs |
| `apps/web/src/pages/` | `Login.tsx` | public login page |
| `apps/web/src/pages/` | `AdminUsers.tsx` | admin user management |
| `apps/web/src/pages/` | `AdminSessions.tsx` | admin session monitor |
| `apps/web/src/lib/` | `auth.ts` | token storage, interceptors, `useAuth` hook |
| `apps/web/src/components/` | `RequireAuth.tsx` | route guard component |
| `apps/web/src/components/` | `RequireAdmin.tsx` | role guard component |

---

## 3 · Data model

Two new tables appended to `infrastructure/surrealdb/schema.surql`. The API auto-applies the schema on boot, so deploy = migration.

### 3.1 · `app_user`

```surql
DEFINE TABLE app_user SCHEMAFULL;
DEFINE FIELD username      ON app_user TYPE string ASSERT $value != NONE
                                       VALUE string::lowercase(string::trim($value));
DEFINE FIELD password_hash ON app_user TYPE string ASSERT $value != NONE;
DEFINE FIELD role          ON app_user TYPE string
                                       ASSERT $value IN ['admin','user'] DEFAULT 'user';
DEFINE FIELD display_name  ON app_user TYPE option<string>;
DEFINE FIELD disabled      ON app_user TYPE bool DEFAULT false;
DEFINE FIELD created_at    ON app_user TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at    ON app_user TYPE datetime DEFAULT time::now();
DEFINE FIELD created_by    ON app_user TYPE option<record<app_user>>;

DEFINE INDEX app_user_username_unique ON app_user FIELDS username UNIQUE;
```

- `username` is lowercased + trimmed by the DB before storage and compare. Prevents duplicate-case accounts.
- `password_hash` is **bcrypt cost 12**. Plain password is never logged, never stored, dropped from memory after hashing.
- `disabled` lets admins suspend accounts (login refused with `account_disabled`) without losing audit history.
- `created_by` is `option<record<app_user>>` so the env-bootstrapped first admin has `NONE`.

### 3.2 · `session`

```surql
DEFINE TABLE session SCHEMAFULL;
DEFINE FIELD user         ON session TYPE record<app_user> ASSERT $value != NONE;
DEFINE FIELD token_hash   ON session TYPE string ASSERT $value != NONE;
DEFINE FIELD created_at   ON session TYPE datetime DEFAULT time::now();
DEFINE FIELD expires_at   ON session TYPE datetime ASSERT $value != NONE;
DEFINE FIELD last_used_at ON session TYPE datetime DEFAULT time::now();
DEFINE FIELD ip           ON session TYPE option<string>;
DEFINE FIELD user_agent   ON session TYPE option<string>;
DEFINE FIELD revoked      ON session TYPE bool DEFAULT false;

DEFINE INDEX session_token_unique ON session FIELDS token_hash UNIQUE;
DEFINE INDEX session_user         ON session FIELDS user;
DEFINE INDEX session_expires      ON session FIELDS expires_at;
```

- **We store `token_hash`, never the raw token.** Server flow: generate 32 random bytes (`crypto/rand.Read`) → 64-char hex → return to client. Hash with SHA-256 before DB insert. Validate by hashing the incoming Bearer and looking up by `token_hash`. DB compromise leaks zero replayable tokens.
- **Bcrypt would be wrong here.** Bcrypt's slow-on-purpose property is to defeat brute-force against low-entropy human passwords. Tokens are already 256-bit random; SHA-256 is the correct primitive (fast, collision-resistant within the token space).
- **Fixed 7-day expiry.** No sliding window. Predictable, no edge cases around clock skew or session "stickiness". After 7 days the user re-logs in.
- **Multi-device.** Login does *not* invalidate prior sessions for the same user. Phone + laptop sessions coexist.
- **`last_used_at`** is updated on protected requests **with debounce**: only write if `now() - last_used_at > 60s`. Prevents one-write-per-request on chatty endpoints (e.g., SSE polling).

### 3.3 · Cleanup goroutine

On API boot, after schema apply, a 1-hour-tick goroutine runs:

```surql
DELETE session WHERE expires_at < time::now();
DELETE session WHERE revoked = true AND created_at < time::now() - 1d;
```

Keeps the table small without affecting the hot path.

---

## 4 · API surface

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | public | `{username, password}` | `200 {token, expires_at, user}` · `401 invalid_credentials` · `403 account_disabled` · `429 rate_limited` |
| `POST` | `/api/auth/logout` | user | — | `204` (revokes the Bearer in use) |
| `GET`  | `/api/auth/me` | user | — | `200 {user, session: {expires_at, last_used_at}}` |
| `GET`  | `/api/admin/users` | admin | `?disabled=…` | `200 {users: [...]}` |
| `POST` | `/api/admin/users` | admin | `{username, password, role, display_name?}` | `201 {user}` · `409 username_exists` |
| `PATCH` | `/api/admin/users/:id` | admin | `{password?, role?, display_name?, disabled?}` | `200 {user}` · `403 cannot_self_modify` |
| `DELETE` | `/api/admin/users/:id` | admin | — | `204` (cascade-revokes that user's sessions) · `403 cannot_self_delete` |
| `GET`  | `/api/admin/sessions` | admin | `?user_id=…` | `200 {sessions: [...]}` (no `token_hash` ever in response) |
| `DELETE` | `/api/admin/sessions/:id` | admin | — | `204` |

Notes:

- All response bodies carrying a user object serialize through a `UserPublic` struct that **omits `password_hash` by absence**, not by tag. Defense in depth — a future refactor can't accidentally re-expose it.
- `cannot_self_modify` / `cannot_self_delete` guards prevent the only admin from accidentally locking themselves out.
- **Login rate limit:** sliding-window in-process counter, 5 failures per username per 15 min → `429`. Per-process (acceptable for hackathon; production would back this with Redis).
- **CORS:** all `/api/auth/*` and `/api/admin/*` routes inherit the existing CORS middleware (already returns `Access-Control-Allow-Credentials: true`).

---

## 5 · Middleware

```go
// RequireAuth — gate for any logged-in user. Sets c.Set("user", UserPublic),
// c.Set("session_id", recordID), c.Set("session", Session) in the gin context.
// Failure modes (all return 401 with a JSON {error, code} body):
//   missing_authorization, malformed_bearer, invalid_token,
//   session_expired, session_revoked, account_disabled
func RequireAuth(repo *db.Repo) gin.HandlerFunc

// RequireAdmin — chains AFTER RequireAuth. Returns 403 forbidden if role != "admin".
func RequireAdmin() gin.HandlerFunc
```

**Hot-path query (single round-trip, indexed):**

```surql
SELECT *, user.* FROM session
WHERE token_hash = $hash
  AND revoked = false
  AND expires_at > time::now()
  AND user.disabled = false
LIMIT 1 FETCH user;
```

**Route wiring in `handlers.Register()`:**

```go
api := r.Group("/api")
api.POST("/auth/login", d.Login)

authed := api.Group("", middleware.RequireAuth(d.Repo))
authed.POST("/auth/logout", d.Logout)
authed.GET("/auth/me", d.Me)

// Existing routes — moved INTO `authed`:
authed.GET("/farmers", d.ListFarmers)
authed.POST("/farmers/:id/chat", d.Chat)
authed.POST("/suggestions/:id/generate", d.GenerateContent)
// ... all current /api/* routes

adminOnly := authed.Group("/admin", middleware.RequireAdmin())
adminOnly.GET("/users", d.ListUsers)
adminOnly.POST("/users", d.CreateUser)
adminOnly.PATCH("/users/:id", d.UpdateUser)
adminOnly.DELETE("/users/:id", d.DeleteUser)
adminOnly.GET("/sessions", d.ListSessions)
adminOnly.DELETE("/sessions/:id", d.RevokeSession)
```

`/health` and `HEAD /health` stay **outside** `/api` — Docker healthcheck never sees auth.

---

## 6 · Frontend integration

### 6.1 · Token storage

- Token lives in `localStorage` under key `svoe.auth.token`.
- We chose localStorage over httpOnly cookies because FE and API are on **different subdomains** (`cyberfermers-rshb.permiraspb.org` vs `api-cyberfermers-rshb.permiraspb.org`); a cross-origin httpOnly cookie requires `SameSite=None; Secure` + CORS gymnastics, while a `Bearer` header just works.
- XSS mitigation: existing `Content-Security-Policy` + `X-Content-Type-Options: nosniff` headers, no `dangerouslySetInnerHTML` in the codebase, no third-party script injections.

### 6.2 · Axios interceptors (`apps/web/src/lib/auth.ts`)

```ts
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem("svoe.auth.token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("svoe.auth.token");
      if (location.pathname !== "/login") {
        location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
      }
    }
    return Promise.reject(err);
  }
);
```

### 6.3 · Route guards

```tsx
// <RequireAuth> — wraps protected route subtrees, redirects to /login if no session
// <RequireAdmin> — wraps admin-only subtree, redirects to /403 if role != "admin"
// useAuth() — returns {user, isLoading, login, logout}; backed by react-query on /api/auth/me
```

Updated `App.tsx`:

```tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/403" element={<Forbidden />} />
  <Route element={<RequireAuth><Outlet /></RequireAuth>}>
    <Route path="/" element={<Landing />} />
    <Route path="/farmers" element={<FarmersPage />} />
    <Route path="/farmer/:farmerId" element={<AppShell />}>
      {/* ... existing nested routes ... */}
    </Route>
    <Route path="/admin" element={<RequireAdmin><AdminShell /></RequireAdmin>}>
      <Route index element={<Navigate to="users" replace />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="sessions" element={<AdminSessions />} />
    </Route>
  </Route>
</Routes>
```

### 6.4 · Visual design intent

The login screen is the **first impression** every judge gets. It must look intentional and on-brand, not like a generic shadcn/ui demo.

**Login page (`/login`):**

- Split layout: left column ~55% width with a *visual* — animated SVG of the calendar wheel from the landing page, slowly rotating, with the agri-tech grain overlay. Right column ~45% with the form. On mobile, visual collapses to a top hero strip ~30vh.
- Form sits on a glass card (`backdrop-blur`, subtle border, soft inner shadow) — matches the existing dashboard's glass-card system.
- Typography: Fraunces for the heading ("Войти в КиберФермеры"), IBM Plex Sans for labels and helper text.
- Microcopy: "Доступ к ИИ-календарю продвижения" subtitle. Russian-first because the judges are Russian, but i18n-ready.
- States: idle → loading (spinner inside button, button text replaced by "Проверяем…") → error (shake animation on card, red helper text below the offending field). No layout shift.
- After success: smooth fade-out of the card, slide into the dashboard. No abrupt route swap.
- Dark theme by default (matches the rest of the app), with the same color tokens.
- No social-login buttons, no "remember me", no "forgot password" — admin-managed, those would be misleading.

**Admin shell (`/admin`):**

- Lives in the same `AppShell`-like chrome as the rest of the app, but with a distinct accent (subtle red/orange tint on the active sidebar item) so the admin knows they're in a privileged area.
- Top-right pill shows `admin · <username>` to make role obvious.
- `/admin/users` — table with avatar (auto-generated from username initials), username, role badge, last-seen, status (active/disabled), 3-dot menu (reset password, change role, disable, delete). New-user dialog as a side sheet, not a modal — fits long forms without scrolling.
- `/admin/sessions` — table grouped by user, shows IP, user-agent (parsed friendly: "Chrome on Windows"), created/last-seen, "Revoke" button per row. "Kick user" action on the user header revokes all sessions for that user in one click.
- All admin tables: keyboard-navigable, sortable, filterable. No DataGrid library — handcrafted for performance and feel.

**Session-expiring toast:**

- 5 minutes before `expires_at`, show a non-dismissible toast: "Сессия истекает через X минут — продлить?" with a "Войти повторно" button. Clicking opens a re-login modal that keeps the user on the current page.

When the spec moves to implementation, the **`frontend-design`** skill should be invoked for `Login.tsx`, `AdminUsers.tsx`, and `AdminSessions.tsx` to ensure these pages clear the "distinctive, not AI-generic" bar. Other admin sub-components can reuse the existing design tokens.

---

## 7 · Bootstrap & ops

### 7.1 · First admin

On API boot, after schema apply:

```
count := SELECT count() FROM app_user WHERE role = 'admin' AND disabled = false GROUP ALL
if count == 0:
    if ADMIN_USERNAME && ADMIN_PASSWORD set in env:
        create admin with those credentials
        log INFO "bootstrapped first admin from env"
    else:
        log FATAL "no admin exists and ADMIN_USERNAME/ADMIN_PASSWORD not set"
        exit non-zero
```

After the first admin exists, the env vars become no-ops. Changing them in Coolify after the fact does nothing — by design, so a rotating deployment doesn't accidentally create a second admin.

New env vars in `.env.production.example`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=    # required on first boot only; ignored thereafter
AUTH_SESSION_TTL_HOURS=168       # 7 days
AUTH_LOGIN_RATE_LIMIT=5          # failures per window
AUTH_LOGIN_RATE_WINDOW_MIN=15
```

### 7.2 · Logging

- **Never log:** plain passwords, password hashes, raw tokens, token hashes, Authorization headers.
- **Do log:** username (already lowercased), session record ID, full IP, user-agent, success/failure with reason code. (Full IP is fine for hackathon-grade — if GDPR scope arrives later, truncate to /24 IPv4 / /48 IPv6 at the logger.)
- Request logger middleware: explicitly skip `Authorization` header.
- `Set-Cookie` / `Cookie` headers: not used in this design but if added later, must also be skipped.

### 7.3 · Migration path

This system is **additive** — no existing endpoints are removed, only moved behind auth. Steps:

1. Apply schema changes (auto on next boot).
2. First boot creates env-bootstrapped admin.
3. Existing data (farmers, products, events, etc.) is **un-owned** by users — anyone logged in can see all of it. Multi-tenant ownership is out of scope.
4. FE update gates all routes; users who were browsing the old open site will be redirected to `/login` on first navigation after the deploy.

---

## 8 · Threat model & explicit non-goals

### 8.1 · What this design protects against

| Threat | Mitigation |
|---|---|
| Random internet hits to `/generate` burning Gemini budget | Behind `RequireAuth` |
| Admin endpoints accessed by regular users | Behind `RequireAdmin` |
| Brute-force login | Sliding-window rate limit, bcrypt cost 12 (slow-by-design) |
| DB dump leaks raw tokens | Tokens stored as SHA-256 hash |
| DB dump leaks plain passwords | Passwords stored as bcrypt hash |
| Stolen token replayed forever | 7-day fixed expiry, admin can revoke instantly |
| Compromised admin can't be removed | Self-modify guard PLUS at least 2 admins recommended via operational practice |
| Timing attack on token compare | Constant-time compare via `crypto/subtle` |
| Timing attack on username enumeration | Constant time on missing user (do a dummy bcrypt compare even on user not found) |

### 8.2 · Explicit non-goals

- **MFA / 2FA.** Easy to add later as new fields on `app_user`.
- **OAuth / SSO.** Out of scope.
- **Password reset by email.** No email infra — admin resets passwords via the dashboard.
- **Self-service password change.** Users can't change their own password; admin updates it via `PATCH /admin/users/:id`. Adding a self-service endpoint is a one-handler add later if needed.
- **Multi-tenant data ownership.** All logged-in users see all farmers. Per-user/per-org data scoping is a separate spec.
- **Account self-registration.** Admin-only seeding by deliberate choice.
- **Session storage in Redis / horizontal scaling.** Rate-limit counter is per-process, sessions are in SurrealDB. Works for the current single-API-replica deployment.
- **WebAuthn / passkeys.** Out of scope.
- **GDPR / data-portability features.** Not required for hackathon.

---

## 9 · Open questions for review

None blocking. Items below are explicit design choices made by the author; flag any you'd revisit:

1. **Token lifetime: 7 days fixed (no sliding).** Alternative: sliding window with 30-min idle timeout + 7-day absolute. Chose fixed for simplicity.
2. **`last_used_at` debounce: 60s.** Alternative: 5s for tighter admin visibility. Chose 60s for hot-path cost.
3. **Login rate limit per-username, not per-IP.** Alternative: combine both. Chose username-only because the FE judges may all sit behind the same NAT and shouldn't lock each other out.
4. **localStorage for token.** Alternative: httpOnly cookie. Chose localStorage because FE/API are on different subdomains and the Bearer pattern works cleanly with existing CORS.
5. **No "remember me" toggle.** Every login = 7 days. Alternative: shorter default + "remember me" extends. Chose simpler.

---

## 10 · Deliverables checklist (for implementation plan)

- [ ] `infrastructure/surrealdb/schema.surql` — add `app_user`, `session` tables + indexes
- [ ] `apps/api/internal/auth/{password,token,bootstrap}.go` — primitives
- [ ] `apps/api/internal/db/auth_repo.go` — queries
- [ ] `apps/api/internal/middleware/auth.go` — `RequireAuth`, `RequireAdmin`
- [ ] `apps/api/internal/handlers/{auth,admin}.go` — handlers
- [ ] `apps/api/internal/models/auth.go` — DTOs
- [ ] `apps/api/cmd/server/main.go` — wire bootstrap + cleanup goroutine
- [ ] `apps/api/internal/config/config.go` — new env vars
- [ ] `apps/api/internal/handlers/health_test.go` and new `auth_test.go` — endpoint behavior
- [ ] `apps/web/src/lib/auth.ts` — token storage + interceptors + `useAuth`
- [ ] `apps/web/src/components/{RequireAuth,RequireAdmin}.tsx` — guards
- [ ] `apps/web/src/pages/Login.tsx` — **invoke `frontend-design` skill**
- [ ] `apps/web/src/pages/AdminUsers.tsx` — **invoke `frontend-design` skill**
- [ ] `apps/web/src/pages/AdminSessions.tsx` — **invoke `frontend-design` skill**
- [ ] `apps/web/src/App.tsx` — wrap routes in guards
- [ ] `.env.production.example` — `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AUTH_*` vars
- [ ] `docs/USER_MANUAL.md` — add login + admin sections
- [ ] Smoke tests: bootstrap admin → login → access protected route → admin creates user → second user logs in → admin revokes session → second user sees 401 on next call
