// Package auth holds the password / token / bootstrap primitives used by
// the authentication middleware and handlers. Nothing in this package
// touches the database directly — repositories live in internal/db.
package auth

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

// bcryptCost = 12 is the sweet spot for 2026 hardware:
//   - ~250ms per hash on a typical server core (slow enough to defeat
//     brute-force, fast enough not to feel sluggish on login)
//   - well above the OWASP-recommended floor of 10
//   - safely below 14 which causes noticeable login latency
const bcryptCost = 12

// HashPassword turns a plaintext password into a bcrypt hash. The caller
// MUST drop the plaintext from memory immediately after this returns —
// `password` strings in Go are not zeroable but local-scope helps GC.
func HashPassword(password string) (string, error) {
	if len(password) < 8 {
		return "", errors.New("password too short")
	}
	if len(password) > 256 {
		return "", errors.New("password too long")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// VerifyPassword constant-time compares plaintext against a stored hash.
// Returns nil on match, an error on mismatch. The error is intentionally
// generic — callers must NOT distinguish "wrong password" from "no user"
// when surfacing to clients (username-enumeration mitigation).
func VerifyPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// DummyVerify burns a constant-time bcrypt comparison against a fixed
// throwaway hash. Used in the login handler when the username does not
// exist, so the response time is indistinguishable from a real failed
// password check. Defeats timing-based username enumeration.
func DummyVerify(password string) {
	_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
}

// dummyHash is a bcrypt hash of a random string, baked in at compile time.
// The plaintext is irrelevant — only the work factor (cost 12) matters.
var dummyHash = []byte(`$2a$12$N5pX0wH2Cb1nQwxQX8vTUu7l5Mxw1nL.rgrEf5kJ2H6f3OqI3yQby`)
