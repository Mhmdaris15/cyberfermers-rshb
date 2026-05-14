package models

import "time"

// ───────────────────────────────────────────────────────────────────────────
//  Authentication DTOs.
//
//  Two principles drive the shape of these types:
//
//    1. Plain-text passwords NEVER live in a struct field that could be
//       serialised back to a response. They appear only on the way IN
//       (LoginRequest, CreateUserRequest, UpdateUserRequest) and never out.
//
//    2. Wherever a user object is returned to a caller, we use UserPublic.
//       It exists separately from User so a future refactor cannot
//       accidentally serialise password_hash by adding a new field to User —
//       UserPublic has no hash field at all.
// ───────────────────────────────────────────────────────────────────────────

// User mirrors the `app_user` row as the DB stores it. Internal to the
// repo layer — never serialised back to clients. Every response path
// projects through UserPublic via user.Public() instead.
//
// IMPORTANT: PasswordHash MUST have a real JSON tag (not `json:"-"`).
// `json:"-"` blocks unmarshal too, not just marshal, so the hash would
// be silently dropped when decoding the SurrealDB SELECT response. The
// login bcrypt verify would then run against an empty string and ALWAYS
// fail with 401 (regression triaged 2026-05-14).
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"password_hash"` // see comment above — do NOT use `json:"-"`
	Role         string    `json:"role"`
	DisplayName  *string   `json:"display_name,omitempty"`
	Disabled     bool      `json:"disabled"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	CreatedBy    *string   `json:"created_by,omitempty"`
}

// UserPublic is the API-safe projection. Returned to every caller.
// No password fields exist on this type — by absence, not by tag.
type UserPublic struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	Role        string    `json:"role"`
	DisplayName *string   `json:"display_name,omitempty"`
	Disabled    bool      `json:"disabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (u *User) Public() UserPublic {
	return UserPublic{
		ID:          u.ID,
		Username:    u.Username,
		Role:        u.Role,
		DisplayName: u.DisplayName,
		Disabled:    u.Disabled,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}

// Session mirrors the `session` row. token_hash stays internal — the raw
// token is shown to the client exactly ONCE, at login response time.
type Session struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	TokenHash  string    `json:"-"` // never marshalled
	CreatedAt  time.Time `json:"created_at"`
	ExpiresAt  time.Time `json:"expires_at"`
	LastUsedAt time.Time `json:"last_used_at"`
	IP         *string   `json:"ip,omitempty"`
	UserAgent  *string   `json:"user_agent,omitempty"`
	Revoked    bool      `json:"revoked"`
}

// SessionPublic is what admins see in the sessions table. Note: NO token,
// NO token_hash. Admins can only revoke, not impersonate.
type SessionPublic struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	Username   string    `json:"username"`
	CreatedAt  time.Time `json:"created_at"`
	ExpiresAt  time.Time `json:"expires_at"`
	LastUsedAt time.Time `json:"last_used_at"`
	IP         *string   `json:"ip,omitempty"`
	UserAgent  *string   `json:"user_agent,omitempty"`
	Revoked    bool      `json:"revoked"`
}

// ─── Request bodies ────────────────────────────────────────────────────────

type LoginRequest struct {
	Username string `json:"username" binding:"required,min=1,max=64"`
	Password string `json:"password" binding:"required,min=1,max=256"`
}

type LoginResponse struct {
	Token     string     `json:"token"`
	ExpiresAt time.Time  `json:"expires_at"`
	User      UserPublic `json:"user"`
}

type MeResponse struct {
	User    UserPublic `json:"user"`
	Session struct {
		ExpiresAt  time.Time `json:"expires_at"`
		LastUsedAt time.Time `json:"last_used_at"`
	} `json:"session"`
}

type CreateUserRequest struct {
	Username    string  `json:"username" binding:"required,min=2,max=64"`
	Password    string  `json:"password" binding:"required,min=8,max=256"`
	Role        string  `json:"role" binding:"required,oneof=admin user"`
	DisplayName *string `json:"display_name,omitempty"`
}

type UpdateUserRequest struct {
	Password    *string `json:"password,omitempty" binding:"omitempty,min=8,max=256"`
	Role        *string `json:"role,omitempty" binding:"omitempty,oneof=admin user"`
	DisplayName *string `json:"display_name,omitempty"`
	Disabled    *bool   `json:"disabled,omitempty"`
}
