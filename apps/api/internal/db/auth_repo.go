package db

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ErrUsernameExists is returned by CreateAuthUser when the username is
// already taken. Handlers map this to HTTP 409.
var ErrUsernameExists = errors.New("username already exists")

// ErrUserNotFound is returned when a user lookup yields no row.
var ErrUserNotFound = errors.New("user not found")

// ErrSessionNotFound — token hash doesn't match an active session.
var ErrSessionNotFound = errors.New("session not found")

// ============================================================
//   app_user
// ============================================================

// HasActiveAdmin reports whether at least one non-disabled admin exists.
// Used by the boot path to decide whether to seed the env-bootstrapped admin.
func (r *Repo) HasActiveAdmin() (bool, error) {
	res, err := r.c.Query(
		`SELECT count() AS n FROM app_user WHERE role = 'admin' AND disabled = false GROUP ALL;`,
		nil,
	)
	if err != nil {
		return false, err
	}
	var rows []struct {
		N int `json:"n"`
	}
	_ = decodeQueryRows(res, &rows)
	return len(rows) > 0 && rows[0].N > 0, nil
}

// CreateUser inserts a new app_user. password is expected to be already
// bcrypt-hashed by the caller — this repo never sees plaintext.
//
// displayName / createdBy are pointers because both are optional on the
// SurrealDB schema (option<string> / option<record<app_user>>).
func (r *Repo) CreateUser(username, passwordHash, role string, displayName *string, createdBy *string) (string, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	if username == "" || passwordHash == "" {
		return "", fmt.Errorf("username and password_hash required")
	}
	q := `
	  LET $existing = (SELECT id FROM app_user WHERE username = $u LIMIT 1);
	  IF array::len($existing) > 0 {
	    RETURN "exists";
	  } ELSE {
	    LET $created = (CREATE app_user SET
	      username = $u,
	      password_hash = $h,
	      role = $r,
	      display_name = $dn,
	      created_by = IF $cb = NONE THEN NONE ELSE type::thing("app_user", $cb) END
	    );
	    RETURN meta::id($created[0].id);
	  };`
	vars := map[string]any{
		"u": username, "h": passwordHash, "r": role,
		"dn": optionalString(displayName),
		"cb": optionalString(createdBy),
	}
	res, err := r.c.Query(q, vars)
	if err != nil {
		return "", err
	}
	var out string
	if err := decodeQueryRows(res, &out); err != nil {
		return "", err
	}
	if out == "exists" {
		return "", ErrUsernameExists
	}
	return out, nil
}

// FindUserByUsername returns the full User row for login. Returns
// ErrUserNotFound if the username does not exist.
func (r *Repo) FindUserByUsername(username string) (*models.User, error) {
	username = strings.ToLower(strings.TrimSpace(username))
	res, err := r.c.Query(
		`SELECT *, meta::id(id) AS id, meta::id(created_by) AS created_by
		   FROM app_user WHERE username = $u LIMIT 1;`,
		map[string]any{"u": username},
	)
	if err != nil {
		return nil, err
	}
	var rows []models.User
	_ = decodeQueryRows(res, &rows)
	if len(rows) == 0 {
		return nil, ErrUserNotFound
	}
	return &rows[0], nil
}

// FindUserByID — same as FindUserByUsername but keyed by the bare record ID.
func (r *Repo) FindUserByID(id string) (*models.User, error) {
	if id == "" {
		return nil, ErrUserNotFound
	}
	res, err := r.c.Query(
		`SELECT *, meta::id(id) AS id, meta::id(created_by) AS created_by
		   FROM type::thing("app_user", $id);`,
		map[string]any{"id": id},
	)
	if err != nil {
		return nil, err
	}
	var rows []models.User
	_ = decodeQueryRows(res, &rows)
	if len(rows) == 0 {
		return nil, ErrUserNotFound
	}
	return &rows[0], nil
}

// ListUsers returns all users for the admin dashboard.
func (r *Repo) ListUsers() ([]models.User, error) {
	res, err := r.c.Query(
		`SELECT *, meta::id(id) AS id, meta::id(created_by) AS created_by
		   FROM app_user ORDER BY created_at DESC;`,
		nil,
	)
	if err != nil {
		return nil, err
	}
	var rows []models.User
	_ = decodeQueryRows(res, &rows)
	return rows, nil
}

// UpdateUser applies a partial patch. Only non-nil fields are written.
// Returns the updated user.
func (r *Repo) UpdateUser(id string, patch map[string]any) (*models.User, error) {
	if id == "" {
		return nil, ErrUserNotFound
	}
	// Always bump updated_at; never let a stale value linger.
	patch["updated_at"] = time.Now().UTC().Format(time.RFC3339Nano)

	res, err := r.c.Query(
		`UPDATE type::thing("app_user", $id) MERGE $patch
		   RETURN *, meta::id(id) AS id, meta::id(created_by) AS created_by;`,
		map[string]any{"id": id, "patch": patch},
	)
	if err != nil {
		return nil, err
	}
	var rows []models.User
	_ = decodeQueryRows(res, &rows)
	if len(rows) == 0 {
		return nil, ErrUserNotFound
	}
	return &rows[0], nil
}

// DeleteUser cascade-revokes that user's sessions then removes the user row.
// We revoke first (rather than delete sessions) so a brief race window where
// a session is still validating against a deleted user never returns success.
func (r *Repo) DeleteUser(id string) error {
	if id == "" {
		return ErrUserNotFound
	}
	q := `
	  UPDATE session SET revoked = true WHERE user = type::thing("app_user", $id);
	  DELETE type::thing("app_user", $id);`
	_, err := r.c.Query(q, map[string]any{"id": id})
	return err
}

// ============================================================
//   session
// ============================================================

// CreateSession persists a new session row. The CALLER is responsible for
// generating the raw token and its hash; we only store the hash.
func (r *Repo) CreateSession(userID, tokenHash string, expiresAt time.Time, ip, userAgent *string) (string, error) {
	if userID == "" || tokenHash == "" {
		return "", fmt.Errorf("user_id and token_hash required")
	}
	q := `
	  LET $created = (CREATE session SET
	    user        = type::thing("app_user", $uid),
	    token_hash  = $th,
	    expires_at  = $exp,
	    ip          = $ip,
	    user_agent  = $ua
	  );
	  RETURN meta::id($created[0].id);`
	res, err := r.c.Query(q, map[string]any{
		"uid": userID, "th": tokenHash,
		"exp": expiresAt.UTC().Format(time.RFC3339Nano),
		"ip":  optionalString(ip), "ua": optionalString(userAgent),
	})
	if err != nil {
		return "", err
	}
	var id string
	if err := decodeQueryRows(res, &id); err != nil {
		return "", err
	}
	return id, nil
}

// FindSessionByTokenHash is the hot-path lookup used by RequireAuth on
// every protected request. Returns the session AND the joined user in one
// round-trip. ErrSessionNotFound if no matching row.
func (r *Repo) FindSessionByTokenHash(tokenHash string) (*models.Session, *models.User, error) {
	if tokenHash == "" {
		return nil, nil, ErrSessionNotFound
	}
	res, err := r.c.Query(
		`SELECT
		    meta::id(id)        AS id,
		    meta::id(user)      AS user_id,
		    token_hash, created_at, expires_at, last_used_at,
		    ip, user_agent, revoked,
		    user.*               AS user
		  FROM session
		  WHERE token_hash = $th
		    AND revoked = false
		    AND expires_at > time::now()
		  LIMIT 1
		  FETCH user;`,
		map[string]any{"th": tokenHash},
	)
	if err != nil {
		return nil, nil, err
	}
	var rows []struct {
		models.Session
		User struct {
			ID           string  `json:"id"` // surreal record id, with `app_user:` prefix
			Username     string  `json:"username"`
			PasswordHash string  `json:"password_hash"`
			Role         string  `json:"role"`
			DisplayName  *string `json:"display_name,omitempty"`
			Disabled     bool    `json:"disabled"`
			CreatedAt    string  `json:"created_at"`
			UpdatedAt    string  `json:"updated_at"`
		} `json:"user"`
	}
	_ = decodeQueryRows(res, &rows)
	if len(rows) == 0 {
		return nil, nil, ErrSessionNotFound
	}
	row := rows[0]

	// If the joined user is disabled, we treat the session as not found —
	// disabled accounts have no valid sessions.
	if row.User.Disabled {
		return nil, nil, ErrSessionNotFound
	}

	user := &models.User{
		ID:           stripPrefix(row.User.ID, "app_user:"),
		Username:     row.User.Username,
		PasswordHash: row.User.PasswordHash,
		Role:         row.User.Role,
		DisplayName:  row.User.DisplayName,
		Disabled:     row.User.Disabled,
		CreatedAt:    parseRFC3339(row.User.CreatedAt),
		UpdatedAt:    parseRFC3339(row.User.UpdatedAt),
	}
	sess := row.Session
	return &sess, user, nil
}

// TouchSession bumps last_used_at. Callers debounce so we don't write on
// every request — typically only when (now - last_used_at) > 60s.
func (r *Repo) TouchSession(id string) error {
	if id == "" {
		return nil
	}
	_, err := r.c.Query(
		`UPDATE type::thing("session", $id) SET last_used_at = time::now();`,
		map[string]any{"id": id},
	)
	return err
}

// RevokeSession marks a specific session as revoked.
func (r *Repo) RevokeSession(id string) error {
	if id == "" {
		return nil
	}
	_, err := r.c.Query(
		`UPDATE type::thing("session", $id) SET revoked = true;`,
		map[string]any{"id": id},
	)
	return err
}

// RevokeUserSessions revokes every session belonging to a user. Used by
// admin "kick user" action and on password change.
func (r *Repo) RevokeUserSessions(userID string) error {
	if userID == "" {
		return nil
	}
	_, err := r.c.Query(
		`UPDATE session SET revoked = true WHERE user = type::thing("app_user", $uid);`,
		map[string]any{"uid": userID},
	)
	return err
}

// ListActiveSessions returns all currently-active sessions for the admin
// dashboard. Optionally filter to a single user.
func (r *Repo) ListActiveSessions(userID string) ([]models.SessionPublic, error) {
	var (
		q    string
		vars map[string]any
	)
	base := `SELECT
	    meta::id(id)        AS id,
	    meta::id(user)      AS user_id,
	    user.username       AS username,
	    created_at, expires_at, last_used_at,
	    ip, user_agent, revoked
	  FROM session
	  WHERE revoked = false AND expires_at > time::now()`
	if userID != "" {
		q = base + ` AND user = type::thing("app_user", $uid)
		  ORDER BY last_used_at DESC;`
		vars = map[string]any{"uid": userID}
	} else {
		q = base + ` ORDER BY last_used_at DESC;`
	}
	res, err := r.c.Query(q, vars)
	if err != nil {
		return nil, err
	}
	var rows []models.SessionPublic
	_ = decodeQueryRows(res, &rows)
	return rows, nil
}

// CleanupExpiredSessions is called periodically (hourly) by a goroutine in
// the API. Drops rows that are past their expiry, AND old-revoked rows
// (kept around for one day for audit visibility, then garbage-collected).
func (r *Repo) CleanupExpiredSessions() error {
	q := `
	  DELETE session WHERE expires_at < time::now();
	  DELETE session WHERE revoked = true AND created_at < time::now() - 1d;`
	_, err := r.c.Query(q, nil)
	return err
}

// ============================================================
//   helpers (file-local)
// ============================================================

// optionalString returns nil for nil/empty so the SurrealDB JSON encoder
// sees `null` (= NONE) rather than an empty string for option<string> fields.
func optionalString(s *string) any {
	if s == nil || *s == "" {
		return nil
	}
	return *s
}

func stripPrefix(s, prefix string) string {
	if strings.HasPrefix(s, prefix) {
		return s[len(prefix):]
	}
	return s
}

func parseRFC3339(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}
