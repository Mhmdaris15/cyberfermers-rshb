package models

import (
	"encoding/json"
	"strings"
	"testing"
)

// Regression test for the auth lookup bug triaged 2026-05-14:
//
// PasswordHash had `json:"-"` which blocked unmarshal as well as
// marshal, so SurrealDB's SELECT response decoded into a User with
// PasswordHash == "" — and every login bcrypt verify failed with 401.
//
// This test locks the JSON tag to a real field name so the regression
// can't recur silently. If anyone re-introduces `json:"-"` on the hash
// field (e.g. as a "belt and braces" leak prevention), this test fails
// immediately and points them at the design note in the struct.
func TestUserPasswordHashRoundtripsThroughJSON(t *testing.T) {
	// Sample shape matches what FindUserByUsername actually receives
	// from SurrealDB after `SELECT *, meta::id(id) AS id ...`.
	raw := `{
		"id": "abc123",
		"username": "admin",
		"password_hash": "$2a$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR",
		"role": "admin",
		"disabled": false,
		"created_at": "2026-05-14T10:00:00Z",
		"updated_at": "2026-05-14T10:00:00Z"
	}`
	var u User
	if err := json.Unmarshal([]byte(raw), &u); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if u.PasswordHash == "" {
		t.Fatal("PasswordHash decoded as empty — json:\"-\" regression on the field tag")
	}
	if !strings.HasPrefix(u.PasswordHash, "$2a$") {
		t.Fatalf("PasswordHash decoded with wrong prefix: %q", u.PasswordHash)
	}
	if u.Username != "admin" || u.Role != "admin" {
		t.Fatalf("other fields broken: username=%q role=%q", u.Username, u.Role)
	}
}

// Sibling check: ensure UserPublic (the API-safe projection) STILL has
// no password_hash anywhere — by absence, not by tag. If anyone ever
// adds the field to UserPublic, this test catches it before the leak
// reaches a deployed client.
func TestUserPublicHasNoPasswordHash(t *testing.T) {
	u := User{
		ID:           "abc",
		Username:     "admin",
		PasswordHash: "$2a$12$should-never-leak",
		Role:         "admin",
	}
	out, err := json.Marshal(u.Public())
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(out), "$2a$") || strings.Contains(string(out), "password") {
		t.Fatalf("Public() leaked password material: %s", out)
	}
}
