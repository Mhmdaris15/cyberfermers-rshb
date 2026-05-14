package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
)

// TokenBytes is the size in bytes of the random portion of a session token.
// 32 bytes = 256 bits of entropy. After hex encoding, the wire format is
// 64 characters. 128 bits would be cryptographically sufficient; 256 bits
// gives a comfortable margin and matches the SHA-256 digest size used to
// hash the token for storage.
const TokenBytes = 32

// NewToken returns (rawToken, tokenHash). The raw token is what we send
// to the client exactly ONCE, in the login response. The hash is what we
// store. A DB dump leaks only the hash and is therefore unreplayable.
func NewToken() (raw string, hash string, err error) {
	buf := make([]byte, TokenBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(buf)
	hash = HashToken(raw)
	return raw, hash, nil
}

// HashToken produces the deterministic storage representation of a token.
// SHA-256 is correct here (high-entropy input + collision-resistance needed,
// brute-force resistance not needed) — bcrypt would be massively overkill
// and cripple per-request latency.
func HashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// ConstantTimeEqual compares two strings without leaking length-relative
// timing info. Used for any place we compare opaque tokens or hashes.
func ConstantTimeEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
