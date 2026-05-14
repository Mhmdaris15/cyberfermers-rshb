package auth

import (
	"encoding/hex"
	"strings"
	"testing"
)

func TestNewTokenIsHexAndUnique(t *testing.T) {
	raw1, hash1, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken 1: %v", err)
	}
	raw2, hash2, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken 2: %v", err)
	}

	// 32 random bytes → 64 hex chars.
	if len(raw1) != 64 {
		t.Errorf("raw token len: got %d, want 64", len(raw1))
	}
	if _, err := hex.DecodeString(raw1); err != nil {
		t.Errorf("raw token not valid hex: %v", err)
	}

	// Different calls MUST yield different tokens; otherwise the random
	// source is broken (or worse, deterministic).
	if raw1 == raw2 || hash1 == hash2 {
		t.Fatal("NewToken returned the same value twice — entropy broken")
	}

	// Hash size: SHA-256 hex = 64 chars too.
	if len(hash1) != 64 {
		t.Errorf("token hash len: got %d, want 64", len(hash1))
	}
}

func TestHashTokenIsDeterministic(t *testing.T) {
	const raw = "abcdef0123456789"
	h1 := HashToken(raw)
	h2 := HashToken(raw)
	if h1 != h2 {
		t.Fatalf("HashToken not deterministic: %q vs %q", h1, h2)
	}
	if len(h1) != 64 {
		t.Errorf("hash len: got %d, want 64", len(h1))
	}
}

func TestNewTokenHashMatchesHashTokenOnRaw(t *testing.T) {
	// CreateSession stores the hash; FindSessionByTokenHash hashes the
	// inbound Bearer and looks it up. The two MUST agree.
	raw, hashFromNew, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken: %v", err)
	}
	hashFromHash := HashToken(raw)
	if hashFromNew != hashFromHash {
		t.Fatalf("NewToken hash ≠ HashToken(raw): %q vs %q", hashFromNew, hashFromHash)
	}
}

func TestConstantTimeEqual(t *testing.T) {
	cases := []struct {
		name     string
		a, b     string
		expect   bool
	}{
		{"identical", "abc123", "abc123", true},
		{"different", "abc123", "xyz789", false},
		{"length mismatch short/long", "abc", "abcdef", false},
		{"empty both", "", "", true},
		{"empty one side", "", "abc", false},
		{"hex-ish", strings.Repeat("a", 64), strings.Repeat("a", 64), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ConstantTimeEqual(tc.a, tc.b); got != tc.expect {
				t.Fatalf("ConstantTimeEqual(%q, %q) = %v, want %v", tc.a, tc.b, got, tc.expect)
			}
		})
	}
}
