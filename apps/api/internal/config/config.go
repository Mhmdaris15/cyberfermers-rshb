package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	APIPort        string
	LogLevel       string
	CORSOrigins    []string
	SurrealURL     string
	SurrealUser    string
	SurrealPass    string
	SurrealNS      string
	SurrealDB      string
	GeminiKey      string
	GeminiModel    string
	GeminiEmbed    string
	TaggingBatch   int
	TaggingRPM     int
	TaggingDryRun  bool
	DataDir        string
	SchemaPath     string
	EventsYAMLPath string
	XLSXPath       string
}

// Load reads env from the closest .env walking upward from cwd. This keeps the
// API runnable both from the repo root (`make api`) and from `apps/api` (when
// you `go run ./cmd/server` directly) — the binary always finds the same
// shared .env and the same data/infrastructure folders.
func Load() *Config {
	loadEnvUpward()
	root := findRepoRoot()

	c := &Config{
		APIPort:        envOr("API_PORT", "8080"),
		LogLevel:       envOr("API_LOG_LEVEL", "info"),
		CORSOrigins:    splitCSV(envOr("API_CORS_ORIGINS", "http://localhost:5173")),
		SurrealURL:     envOr("SURREAL_URL", "http://localhost:8000"),
		SurrealUser:    envOr("SURREAL_USER", "root"),
		SurrealPass:    envOr("SURREAL_PASS", "root"),
		SurrealNS:      envOr("SURREAL_NS", "rshb"),
		SurrealDB:      envOr("SURREAL_DB", "svoe_rodnoe"),
		GeminiKey:      os.Getenv("GEMINI_API_KEY"),
		GeminiModel:    envOr("GEMINI_MODEL", "gemini-2.5-flash"),
		GeminiEmbed:    envOr("GEMINI_EMBED_MODEL", "text-embedding-004"),
		TaggingBatch:   envInt("TAGGING_BATCH_SIZE", 20),
		TaggingRPM:     envInt("TAGGING_RATE_LIMIT_PER_MIN", 15),
		TaggingDryRun:  envBool("TAGGING_DRY_RUN", false),
		DataDir:        envOr("DATA_DIR", filepath.Join(root, "data")),
		SchemaPath:     envOr("SCHEMA_PATH", filepath.Join(root, "infrastructure", "surrealdb", "schema.surql")),
		EventsYAMLPath: envOr("EVENTS_YAML_PATH", filepath.Join(root, "data", "seed", "events.yml")),
		XLSXPath:       envOr("XLSX_PATH", filepath.Join(root, "data", "raw", "farmers_sku.xlsx")),
	}
	return c
}

// loadEnvUpward looks for a .env starting at cwd and walking up to 6 levels.
// First match wins; later levels are ignored so a project-local .env always
// overrides a parent one.
func loadEnvUpward() {
	dir, _ := os.Getwd()
	for i := 0; i < 6; i++ {
		p := filepath.Join(dir, ".env")
		if _, err := os.Stat(p); err == nil {
			_ = godotenv.Load(p)
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return
		}
		dir = parent
	}
}

// findRepoRoot detects the repo root by walking up until we see the marker
// `docker-compose.yml` next to `apps/`. Falls back to cwd if not found.
func findRepoRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}
	for i := 0; i < 6; i++ {
		if _, err := os.Stat(filepath.Join(dir, "docker-compose.yml")); err == nil {
			if _, err := os.Stat(filepath.Join(dir, "apps")); err == nil {
				return dir
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	cwd, _ := os.Getwd()
	return cwd
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func envBool(k string, def bool) bool {
	if v := os.Getenv(k); v != "" {
		switch strings.ToLower(v) {
		case "1", "true", "yes", "on":
			return true
		case "0", "false", "no", "off":
			return false
		}
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
