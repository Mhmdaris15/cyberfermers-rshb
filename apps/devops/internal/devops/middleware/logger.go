package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// RequestLogger emits a structured slog line per request. The
// Authorization header is NEVER included — only method, path, status,
// duration, client IP. If a future field would carry a secret, scrub
// it here, not at the call site.
func RequestLogger(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		log.Info("http",
			slog.String("method", c.Request.Method),
			slog.String("path", c.Request.URL.Path),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("elapsed", time.Since(start)),
			slog.String("ip", c.ClientIP()),
			slog.Int("size", c.Writer.Size()),
		)
	}
}
