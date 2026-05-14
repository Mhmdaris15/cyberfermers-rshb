package auth

import (
	"errors"
	"strings"
)

// AdminBootstrapper is the contract the bootstrap step needs from the
// data layer. Kept narrow so this package stays import-light and the
// real db.Repo can satisfy it without circular deps.
//
// No context.Context — matches the existing Repo conventions in this
// codebase. The underlying Surreal HTTP client does not honor context
// cancellation today; adding it is a separate refactor.
type AdminBootstrapper interface {
	HasActiveAdmin() (bool, error)
	CreateUser(username, passwordHash, role string, displayName *string, createdBy *string) (id string, err error)
}

// BootstrapResult tells the caller what bootstrap did, so main.go can log
// a single descriptive line per outcome rather than scattering info logs.
type BootstrapResult int

const (
	// BootstrapAdminAlreadyExists means at least one active admin exists;
	// the env vars are ignored.
	BootstrapAdminAlreadyExists BootstrapResult = iota
	// BootstrapCreated means a fresh admin was created from env.
	BootstrapCreated
)

// ErrAdminMissingAndNoEnv is returned when there is no active admin in the
// DB AND ADMIN_USERNAME/ADMIN_PASSWORD are not both set. The server should
// refuse to start in this state — it would be a deployed API with no way
// to log in.
var ErrAdminMissingAndNoEnv = errors.New("no active admin in db and ADMIN_USERNAME/ADMIN_PASSWORD not both set")

// EnsureFirstAdmin is the function main.go calls on every boot.
// It is idempotent — calling it ten times has the same effect as calling
// it once, because creation is gated by HasActiveAdmin().
func EnsureFirstAdmin(repo AdminBootstrapper, envUsername, envPassword string) (BootstrapResult, error) {
	hasAdmin, err := repo.HasActiveAdmin()
	if err != nil {
		return 0, err
	}
	if hasAdmin {
		return BootstrapAdminAlreadyExists, nil
	}

	envUsername = strings.TrimSpace(envUsername)
	if envUsername == "" || envPassword == "" {
		return 0, ErrAdminMissingAndNoEnv
	}

	hash, err := HashPassword(envPassword)
	if err != nil {
		return 0, err
	}
	// createdBy = nil — bootstrap admin has no creator (sentinel value).
	if _, err := repo.CreateUser(envUsername, hash, "admin", nil, nil); err != nil {
		return 0, err
	}
	return BootstrapCreated, nil
}
