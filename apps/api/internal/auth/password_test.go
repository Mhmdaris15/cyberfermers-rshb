package auth

import (
	"strings"
	"testing"
)

// Tests for the bcrypt primitives that the login handler relies on.
// These run without any DB — they verify the math is correct end-to-end
// so that when integration tests later confirm "the right hash is stored",
// we already trust this layer.

func TestHashPasswordRoundtrip(t *testing.T) {
	const pw = "2wsx1qaz"
	hash, err := HashPassword(pw)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	if !strings.HasPrefix(hash, "$2a$") && !strings.HasPrefix(hash, "$2b$") {
		t.Fatalf("hash does not look like bcrypt output: %q", hash)
	}
	if len(hash) != 60 {
		t.Fatalf("bcrypt hash length: got %d, want 60", len(hash))
	}
	if err := VerifyPassword(hash, pw); err != nil {
		t.Fatalf("VerifyPassword rejected the just-hashed password: %v", err)
	}
}

func TestVerifyPasswordRejectsWrongPassword(t *testing.T) {
	hash, err := HashPassword("the-right-one")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if err := VerifyPassword(hash, "the-wrong-one"); err == nil {
		t.Fatal("VerifyPassword accepted the wrong password (no error)")
	}
}

func TestHashPasswordRejectsTooShort(t *testing.T) {
	if _, err := HashPassword("short"); err == nil {
		t.Fatal("HashPassword accepted a 5-char password (want error)")
	}
}

func TestHashPasswordRejectsTooLong(t *testing.T) {
	long := strings.Repeat("a", 257)
	if _, err := HashPassword(long); err == nil {
		t.Fatal("HashPassword accepted a 257-char password (want error)")
	}
}

func TestDummyVerifyDoesNotPanic(t *testing.T) {
	// DummyVerify exists purely to burn the same wall-time as a real
	// verify when the user lookup said "not found", so the response
	// timing doesn't leak username existence. It MUST never panic for
	// any input — that's its whole reason to exist.
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("DummyVerify panicked: %v", r)
		}
	}()
	DummyVerify("")
	DummyVerify("short")
	DummyVerify("2wsx1qaz")
	DummyVerify(strings.Repeat("x", 1000))
}

// Two-hash-different-password property — bcrypt salts mean even the same
// input produces different hashes each time. The verify layer accepts both.
func TestHashPasswordSaltDiffersBetweenCalls(t *testing.T) {
	const pw = "same-password"
	h1, err := HashPassword(pw)
	if err != nil {
		t.Fatalf("hash 1: %v", err)
	}
	h2, err := HashPassword(pw)
	if err != nil {
		t.Fatalf("hash 2: %v", err)
	}
	if h1 == h2 {
		t.Fatal("bcrypt produced identical hashes for the same password — salt is not random")
	}
	if err := VerifyPassword(h1, pw); err != nil {
		t.Fatalf("h1 didn't verify against original password: %v", err)
	}
	if err := VerifyPassword(h2, pw); err != nil {
		t.Fatalf("h2 didn't verify against original password: %v", err)
	}
}
