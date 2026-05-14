import { api } from "./api";

// ============================================================
//   Admin API client.
//   Endpoints under /api/admin/* — all require `Authorization: Bearer`
//   (auth interceptor handles this) AND role=admin server-side.
// ============================================================

export interface AdminUser {
  id: string;
  username: string;
  role: "admin" | "user";
  display_name?: string | null;
  disabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  id: string;
  user_id: string;
  username: string;
  created_at: string;
  expires_at: string;
  last_used_at: string;
  ip?: string | null;
  user_agent?: string | null;
  revoked: boolean;
}

export interface CreateUserBody {
  username: string;
  password: string;
  role: "admin" | "user";
  display_name?: string;
}

export interface UpdateUserBody {
  password?: string;
  role?: "admin" | "user";
  display_name?: string;
  disabled?: boolean;
}

// ───── users ────────────────────────────────────────────────────────────

export const listUsers = () =>
  api.get<{ users: AdminUser[] }>("/api/admin/users").then((r) => r.data.users);

export const createUser = (body: CreateUserBody) =>
  api.post<AdminUser>("/api/admin/users", body).then((r) => r.data);

export const updateUser = (id: string, patch: UpdateUserBody) =>
  api.patch<AdminUser>(`/api/admin/users/${id}`, patch).then((r) => r.data);

export const deleteUser = (id: string) =>
  api.delete(`/api/admin/users/${id}`).then(() => undefined);

// ───── sessions ─────────────────────────────────────────────────────────

export const listSessions = (userId?: string) =>
  api
    .get<{ sessions: AdminSession[] }>("/api/admin/sessions", {
      params: userId ? { user_id: userId } : undefined,
    })
    .then((r) => r.data.sessions);

export const revokeSession = (id: string) =>
  api.delete(`/api/admin/sessions/${id}`).then(() => undefined);
