package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// ============================================================
//   Login handler tests — input-validation surface.
//
//   The full "nonexistent user → 401" / "wrong password → 401" /
//   "successful login → 200 + session row" scenarios require a live
//   SurrealDB or a refactored Repo interface so a fake can stand in.
//   That's its own task — see TODO at the bottom of this file. The
//   tests here lock in everything the handler does BEFORE the first
//   d.Repo call, which is where the bulk of bug-prone branching
//   actually happens (binding, rate-limiting, response shape).
// ============================================================

func newRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// Empty Deps is fine — the /health route ignores it and the
	// /api/auth/login binding errors fire before any d.Repo access.
	Register(r, &Deps{})
	return r
}

// post is a tiny helper that POSTs a JSON body to a route and returns
// the recorder. Reduces noise in each test.
func post(t *testing.T, r *gin.Engine, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var rdr *bytes.Buffer
	switch v := body.(type) {
	case nil:
		rdr = bytes.NewBufferString("")
	case string:
		rdr = bytes.NewBufferString(v) // for malformed-JSON tests
	default:
		buf, err := json.Marshal(v)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		rdr = bytes.NewBuffer(buf)
	}
	req := httptest.NewRequest(http.MethodPost, path, rdr)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func decodeBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode body %q: %v", w.Body.String(), err)
	}
	return out
}

// ─── input validation ────────────────────────────────────────────────────

func TestLoginRejectsMissingBody(t *testing.T) {
	r := newRouter()
	w := post(t, r, "/api/auth/login", nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400; body=%s", w.Code, w.Body.String())
	}
}

func TestLoginRejectsMalformedJSON(t *testing.T) {
	r := newRouter()
	w := post(t, r, "/api/auth/login", `{"username": "admin", "password":`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400; body=%s", w.Code, w.Body.String())
	}
}

func TestLoginRejectsEmptyUsername(t *testing.T) {
	r := newRouter()
	w := post(t, r, "/api/auth/login", map[string]string{"username": "", "password": "validpass"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400; body=%s", w.Code, w.Body.String())
	}
}

func TestLoginRejectsEmptyPassword(t *testing.T) {
	r := newRouter()
	w := post(t, r, "/api/auth/login", map[string]string{"username": "admin", "password": ""})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400; body=%s", w.Code, w.Body.String())
	}
}

func TestLoginRejectsOverLongUsername(t *testing.T) {
	r := newRouter()
	long := strings.Repeat("a", 65)
	w := post(t, r, "/api/auth/login", map[string]string{"username": long, "password": "validpass"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400 for >64-char username; body=%s", w.Code, w.Body.String())
	}
}

// ─── error-response shape ────────────────────────────────────────────────

// On a 400, the body must include both `error` (human message) and
// `code` (machine-readable). The FE drives its error UI off `code`,
// so this shape is part of the API contract.
func TestLoginErrorResponseShape(t *testing.T) {
	r := newRouter()
	w := post(t, r, "/api/auth/login", map[string]string{"username": "", "password": ""})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d, want 400", w.Code)
	}
	body := decodeBody(t, w)
	if _, ok := body["error"]; !ok {
		t.Errorf("response body missing `error` key: %s", w.Body.String())
	}
	if code, ok := body["code"].(string); !ok || code != "invalid_body" {
		t.Errorf("expected code=invalid_body, got %v", body["code"])
	}
}

// ─── rate limiter ────────────────────────────────────────────────────────

// Tests the in-memory sliding-window login rate limiter without any HTTP
// or DB. The hot-path semantics here are: 5 failures in 15 min → blocked;
// a single success resets; pruning clears expired entries.

func TestLoginRateLimiterBlocksAfterLimit(t *testing.T) {
	l := newLoginRateLimiter(3, 15*time.Minute)
	for i := 0; i < 3; i++ {
		if l.blocked("alice") {
			t.Fatalf("blocked too early at attempt %d", i)
		}
		l.recordFailure("alice")
	}
	if !l.blocked("alice") {
		t.Fatal("expected alice to be blocked after 3 failures")
	}
	// bob should not be affected — limiter is per-username.
	if l.blocked("bob") {
		t.Fatal("limiter leaked across usernames")
	}
}

func TestLoginRateLimiterResetsOnSuccess(t *testing.T) {
	l := newLoginRateLimiter(3, 15*time.Minute)
	for i := 0; i < 3; i++ {
		l.recordFailure("alice")
	}
	if !l.blocked("alice") {
		t.Fatal("expected alice blocked")
	}
	l.recordSuccess("alice")
	if l.blocked("alice") {
		t.Fatal("recordSuccess didn't clear the limiter")
	}
}

func TestLoginRateLimiterPrunesPastWindow(t *testing.T) {
	// Window of 50ms — short enough for a test, long enough that the
	// recordFailure / blocked sequence stays inside it.
	l := newLoginRateLimiter(2, 50*time.Millisecond)
	l.recordFailure("alice")
	l.recordFailure("alice")
	if !l.blocked("alice") {
		t.Fatal("expected blocked immediately after 2 failures")
	}
	time.Sleep(80 * time.Millisecond)
	if l.blocked("alice") {
		t.Fatal("expected window to have expired and alice no longer blocked")
	}
}

// ─── integration-test seam ───────────────────────────────────────────────
//
// The following scenarios are NOT covered here because they require a
// live SurrealDB to exercise the full request → repo → session path:
//
//   1. POST /api/auth/login with a username that does NOT exist
//      → 401 invalid_credentials (verify it's NOT 500, even when the
//        DB returns the empty-row case)
//   2. POST /api/auth/login with valid username + wrong password
//      → 401 invalid_credentials
//   3. POST /api/auth/login success → 200 with token + a session row in
//      the session table whose token_hash is HashToken(response.token)
//   4. reset-password CLI: create path when user absent
//   5. reset-password CLI: update path when user exists
//
// Approach when a DB harness exists (next test-infra task):
//   - Spin a SurrealDB via testcontainers-go OR connect to a CI-managed
//     instance via SURREAL_TEST_URL.
//   - Apply schema.surql.
//   - Wire a real *db.Repo and call Login / reset-password directly.
//   - Use `t.Cleanup` to DELETE the test users after each case.
//
// Adding the harness is its own ticket; until then, the bcrypt and
// token primitive tests (auth/password_test.go + auth/token_test.go)
// cover the math, and the input-validation tests above cover the
// pre-DB branches of the handler.
