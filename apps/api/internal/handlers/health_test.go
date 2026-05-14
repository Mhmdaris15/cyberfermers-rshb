package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestHealthAcceptsGETAndHEAD locks in the production fix where Docker /
// Coolify healthchecks invoke `wget --spider`, which sends HEAD. If gin
// is ever swapped or Register is rewritten, this test fails immediately
// rather than waiting for an "unhealthy container" production incident.
func TestHealthAcceptsGETAndHEAD(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// Empty Deps is safe — /health doesn't dereference any of the inner
	// pointers, and we don't exercise the /api/* group in this test.
	Register(r, &Deps{})

	for _, method := range []string{http.MethodGet, http.MethodHead} {
		t.Run(method, func(t *testing.T) {
			req := httptest.NewRequest(method, "/health", nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("%s /health: status = %d, want 200", method, w.Code)
			}
		})
	}
}
