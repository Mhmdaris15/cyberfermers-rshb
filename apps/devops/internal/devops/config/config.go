// Package config loads runtime configuration for the DevOps operator
// from environment variables. No file IO, no walk-up logic — Coolify /
// systemd / docker compose are expected to inject the env directly.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	// Server
	Port      string
	BindAddr  string
	LogLevel  string

	// Internal auth — shared secret bearer token clients must present.
	InternalToken string

	// Coolify
	CoolifyURL         string
	CoolifyProjectUUID string
	CoolifyToken       string
	CoolifyTimeout     time.Duration

	// Whitelist of application UUIDs this operator is allowed to touch.
	// Empty = deny all (safe default).
	AllowedApps []string
}

// Load reads env vars and validates required fields. Returns a usable
// Config or a wrapped error describing every problem found.
func Load() (*Config, error) {
	c := &Config{
		Port:               envOr("DEVOPS_PORT", "9090"),
		BindAddr:           envOr("DEVOPS_BIND_ADDR", "127.0.0.1"),
		LogLevel:           strings.ToLower(envOr("DEVOPS_LOG_LEVEL", "info")),
		InternalToken:      os.Getenv("DEVOPS_INTERNAL_TOKEN"),
		CoolifyURL:         strings.TrimRight(os.Getenv("COOLIFY_URL"), "/"),
		CoolifyProjectUUID: os.Getenv("COOLIFY_PROJECT_UUID"),
		CoolifyToken:       os.Getenv("COOLIFY_TOKEN"),
		CoolifyTimeout:     envDuration("COOLIFY_HTTP_TIMEOUT_SECONDS", 30*time.Second),
		AllowedApps:        splitCSV(os.Getenv("DEVOPS_ALLOWED_APPS")),
	}

	var problems []string
	if c.InternalToken == "" || c.InternalToken == "replace-me-openssl-rand-hex-32" {
		problems = append(problems, "DEVOPS_INTERNAL_TOKEN must be set to a strong secret")
	}
	if c.CoolifyURL == "" {
		problems = append(problems, "COOLIFY_URL must be set")
	}
	if c.CoolifyToken == "" {
		problems = append(problems, "COOLIFY_TOKEN must be set")
	}
	if len(problems) > 0 {
		return nil, fmt.Errorf("invalid config: %s", strings.Join(problems, "; "))
	}
	return c, nil
}

// IsAppAllowed returns true iff uuid is on the allowlist. Empty allowlist
// denies everything — deploys are not the kind of thing to permit by default.
func (c *Config) IsAppAllowed(uuid string) bool {
	if uuid == "" {
		return false
	}
	for _, a := range c.AllowedApps {
		if a == uuid {
			return true
		}
	}
	return false
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envDuration(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return def
	}
	return time.Duration(n) * time.Second
}

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := parts[:0]
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// ErrNotAllowed is returned when a request targets an application UUID
// that is not on the allowlist. Surfaces as HTTP 403 in handlers.
var ErrNotAllowed = errors.New("application is not in DEVOPS_ALLOWED_APPS allowlist")
