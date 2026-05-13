// Package middleware holds gin middleware specific to the DevOps operator.
package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// InternalAuth returns a gin middleware that enforces a shared-secret
// bearer token on every protected route.
//
// This is a deliberate placeholder for a real auth system. When this
// service later becomes Claude Code's deployment operator, replace this
// with mTLS / OAuth / signed-request verification. The interface stays
// the same: pass if authorized, 401 if not, never log the token.
func InternalAuth(expected string) gin.HandlerFunc {
	expectedBytes := []byte(expected)
	return func(c *gin.Context) {
		got := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
		if got == "" || subtle.ConstantTimeCompare([]byte(got), expectedBytes) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized",
				"code":  "missing_or_invalid_token",
			})
			return
		}
		c.Next()
	}
}
