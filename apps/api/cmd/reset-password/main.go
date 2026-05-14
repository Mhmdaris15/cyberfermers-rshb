// Command reset-password sets (or creates) a user's password without
// going through the HTTP login flow. Designed to be `docker exec`-ed
// inside the running API container — it reuses the runtime's config
// loader, DB client, and bcrypt cost so the resulting hash is
// bit-for-bit identical to one the live server would produce.
//
// Usage:
//
//	docker exec svoe-api-prod /app/bin/reset-password \
//	  --username admin --password new-strong-password
//
// Or with env vars (better for shell history hygiene):
//
//	docker exec \
//	  -e RESET_USERNAME=admin \
//	  -e NEW_PASSWORD='new-strong-password' \
//	  svoe-api-prod /app/bin/reset-password
//
// Behavior:
//   - If the user exists: password_hash is replaced, disabled=false,
//     role optionally updated, and ALL active sessions for that user
//     are revoked (kicks any clients with old tokens).
//   - If the user does NOT exist: a new row is created with role
//     defaulting to "admin" — bootstrap-style "I lost access to my
//     admin and need to get back in" rescue.
//
// The tool never logs the password. It does log the username and the
// resulting record id, so the operator can confirm the right row.
package main

import (
	"errors"
	"flag"
	"os"
	"strings"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/auth"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/config"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
)

func main() {
	var (
		usernameFlag = flag.String("username", "", "username to reset (also reads RESET_USERNAME env)")
		passwordFlag = flag.String("password", "", "new password (also reads NEW_PASSWORD env)")
		roleFlag     = flag.String("role", "admin", "role to assign on CREATE: admin|user. Ignored on UPDATE unless --role is explicitly passed.")
		quietFlag    = flag.Bool("quiet", false, "suppress info logs (errors still emit)")
	)
	flag.Parse()

	// Minimal stderr logger — no timestamps, no colors (suitable for piping).
	log.Logger = log.Output(zerolog.ConsoleWriter{
		Out:          os.Stderr,
		NoColor:      true,
		PartsExclude: []string{zerolog.TimestampFieldName},
	})
	if *quietFlag {
		zerolog.SetGlobalLevel(zerolog.ErrorLevel)
	}

	// Resolve inputs (flag wins; env fallback for password keeps the secret
	// out of `ps`/process listings when invoked via docker exec -e).
	username := strings.ToLower(strings.TrimSpace(firstNonEmpty(*usernameFlag, os.Getenv("RESET_USERNAME"))))
	password := firstNonEmpty(*passwordFlag, os.Getenv("NEW_PASSWORD"))

	if username == "" {
		log.Fatal().Msg("--username (or RESET_USERNAME env) is required")
	}
	if password == "" {
		log.Fatal().Msg("--password (or NEW_PASSWORD env) is required")
	}
	if len(password) < 8 {
		log.Fatal().Msg("password too short (min 8 chars)")
	}
	if *roleFlag != "admin" && *roleFlag != "user" {
		log.Fatal().Str("got", *roleFlag).Msg("--role must be 'admin' or 'user'")
	}

	// Reuse the live config — same SURREAL_URL/USER/PASS/NS/DB env vars
	// the API server itself reads at boot. Inside the api container this
	// "just works" because docker compose has set them already.
	cfg := config.Load()
	log.Info().
		Str("url", cfg.SurrealURL).
		Str("ns", cfg.SurrealNS).
		Str("db", cfg.SurrealDB).
		Msg("surreal target")

	dbc, err := db.New(cfg.SurrealURL, cfg.SurrealUser, cfg.SurrealPass, cfg.SurrealNS, cfg.SurrealDB)
	if err != nil {
		log.Fatal().Err(err).Msg("connect to surrealdb")
	}
	defer dbc.Close()

	repo := db.NewRepo(dbc)

	// Same bcrypt primitive the HTTP handlers use — guarantees the hash
	// the runtime's VerifyPassword will accept.
	hash, err := auth.HashPassword(password)
	if err != nil {
		log.Fatal().Err(err).Msg("hash password")
	}
	log.Info().Msg("password hashed (bcrypt cost 12)")

	existing, err := repo.FindUserByUsername(username)
	switch {
	case err == nil:
		// UPDATE path — replace password, re-enable, optionally re-role,
		// and revoke any still-valid sessions for that user.
		patch := map[string]any{
			"password_hash": hash,
			"disabled":      false,
		}
		if isFlagPassed("role") {
			patch["role"] = *roleFlag
		}
		updated, err := repo.UpdateUser(existing.ID, patch)
		if err != nil {
			log.Fatal().Err(err).Msg("update user")
		}
		log.Info().
			Str("id", updated.ID).
			Str("username", updated.Username).
			Str("role", updated.Role).
			Bool("re_enabled", existing.Disabled).
			Msg("user updated")

		// Revoking sessions is best-effort. Worst case: a stale token
		// remains valid until natural expiry. The password change still
		// took effect; subsequent logins will use the new credential.
		if err := repo.RevokeUserSessions(existing.ID); err != nil {
			log.Warn().Err(err).Msg("revoke user sessions (non-fatal)")
		} else {
			log.Info().Msg("active sessions revoked")
		}

	case errors.Is(err, db.ErrUserNotFound):
		// CREATE path — fresh user with the requested role (default admin).
		id, err := repo.CreateUser(username, hash, *roleFlag, nil, nil)
		if err != nil {
			log.Fatal().Err(err).Msg("create user")
		}
		log.Info().
			Str("id", id).
			Str("username", username).
			Str("role", *roleFlag).
			Msg("user created (no prior row matched)")

	default:
		log.Fatal().Err(err).Msg("lookup user")
	}

	log.Info().Str("username", username).Msg("done — log in with the new credentials")
}

// firstNonEmpty returns the first whitespace-trimmed non-empty input.
func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// isFlagPassed reports whether a flag was set on the CLI (vs. left at its
// default). Lets us treat --role differently on UPDATE: leave the existing
// role alone unless the operator explicitly typed --role.
func isFlagPassed(name string) bool {
	found := false
	flag.Visit(func(f *flag.Flag) {
		if f.Name == name {
			found = true
		}
	})
	return found
}
