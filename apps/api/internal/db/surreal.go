package db

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// Client speaks to SurrealDB over its HTTP /sql endpoint. We bypass the
// official Go SDK because its surface keeps shifting between minor versions;
// the HTTP API is stable since 2.0 and only needs an Authorization header
// plus Surreal-NS / Surreal-DB to scope the namespace.
type Client struct {
	BaseURL string // e.g. http://surrealdb:8000
	NS      string
	DB      string
	auth    string
	http    *http.Client
}

// New parses the given URL (accepts ws://, wss://, http://, https://),
// derives the HTTP base URL, builds the Basic auth header, and returns a
// ready-to-use client. No connection is opened up front — Surreal HTTP is
// stateless per request.
func New(rawURL, user, pass, ns, dbName string) (*Client, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("parse surreal url: %w", err)
	}
	switch u.Scheme {
	case "ws":
		u.Scheme = "http"
	case "wss":
		u.Scheme = "https"
	case "http", "https":
		// fine
	default:
		return nil, fmt.Errorf("unsupported scheme: %s", u.Scheme)
	}
	// Drop the /rpc suffix if the user passed the WS endpoint
	u.Path = strings.TrimSuffix(u.Path, "/rpc")

	c := &Client{
		BaseURL: strings.TrimRight(u.String(), "/"),
		NS:      ns,
		DB:      dbName,
		auth:    "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+pass)),
		http:    &http.Client{Timeout: 30 * time.Second},
	}
	log.Info().Str("url", c.BaseURL).Str("ns", ns).Str("db", dbName).Msg("surreal client ready (http)")
	return c, nil
}

// EnsureSchema POSTs the raw .surql file to /sql at ROOT scope (no NS/DB
// headers) because the file itself defines + USEs the namespace/database.
// All DEFINE statements are idempotent in Surreal 2.x, so re-runs are safe.
func (c *Client) EnsureSchema(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read schema %s: %w", path, err)
	}
	if _, err := c.sqlRoot(string(raw)); err != nil {
		if !strings.Contains(strings.ToLower(err.Error()), "already exists") {
			return fmt.Errorf("apply schema: %w", err)
		}
	}
	log.Info().Str("path", path).Msg("schema applied")
	return nil
}

// Query inlines vars into the SQL safely and POSTs to /sql. Returns the raw
// per-statement response array exactly as SurrealDB emits it. Callers use
// decodeQueryRows() in repo.go to unmarshal the result of the last statement.
func (c *Client) Query(sql string, vars map[string]any) (any, error) {
	final, err := inlineVars(sql, vars)
	if err != nil {
		return nil, err
	}
	return c.sql(final)
}

// Close is a no-op for HTTP; kept so callers can defer it.
func (c *Client) Close() {}

// --------------------------------------------------------------------------

// sql POSTs the SQL with NS/DB scoping headers.
func (c *Client) sql(query string) (any, error) { return c.post(query, true) }

// sqlRoot POSTs the SQL without NS/DB headers — used for schema bootstrap.
func (c *Client) sqlRoot(query string) (any, error) { return c.post(query, false) }

func (c *Client) post(query string, scoped bool) (any, error) {
	req, err := http.NewRequest("POST", c.BaseURL+"/sql", strings.NewReader(query))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", c.auth)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "text/plain")
	if scoped {
		req.Header.Set("Surreal-NS", c.NS)
		req.Header.Set("Surreal-DB", c.DB)
		req.Header.Set("NS", c.NS)
		req.Header.Set("DB", c.DB)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("surreal http: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("surreal %d: %s", resp.StatusCode, string(body))
	}

	// Surreal returns [{ "status": "OK"|"ERR", "result": ..., "time": "..." }, ...]
	var arr []map[string]json.RawMessage
	if err := json.Unmarshal(body, &arr); err != nil {
		// Some versions occasionally wrap a single error object — surface it.
		return nil, fmt.Errorf("decode surreal response: %w; body: %s", err, truncate(string(body), 400))
	}
	for _, row := range arr {
		var status string
		_ = json.Unmarshal(row["status"], &status)
		if strings.EqualFold(status, "ERR") {
			var msg string
			_ = json.Unmarshal(row["result"], &msg)
			if msg != "" && !strings.Contains(strings.ToLower(msg), "already exists") {
				return nil, fmt.Errorf("surreal: %s", msg)
			}
		}
	}
	return arr, nil
}

// --------------------------------------------------------------------------
// Variable inlining. The /sql endpoint does not accept a vars sidecar; we
// substitute $name tokens with safely encoded literals. Record-ID strings
// (e.g. "farmer:abc123") are emitted unquoted; other strings are JSON-encoded.
//
// IMPORTANT: this is *not* a generic SQL escaper. It is safe because (a) all
// callers are inside this codebase and (b) we never substitute into identifier
// positions — only into expressions where the encoding rules below are exact.
// --------------------------------------------------------------------------

func inlineVars(sql string, vars map[string]any) (string, error) {
	if len(vars) == 0 {
		return sql, nil
	}
	// Replace longer keys first to avoid prefix collisions ($product vs $pro).
	keys := make([]string, 0, len(vars))
	for k := range vars {
		keys = append(keys, k)
	}
	// crude length-desc sort
	for i := 0; i < len(keys); i++ {
		for j := i + 1; j < len(keys); j++ {
			if len(keys[j]) > len(keys[i]) {
				keys[i], keys[j] = keys[j], keys[i]
			}
		}
	}
	for _, k := range keys {
		repl, err := marshalSurreal(vars[k])
		if err != nil {
			return "", fmt.Errorf("var %s: %w", k, err)
		}
		sql = strings.ReplaceAll(sql, "$"+k, repl)
	}
	return sql, nil
}

func marshalSurreal(v any) (string, error) {
	switch x := v.(type) {
	case nil:
		return "NONE", nil
	case bool:
		if x {
			return "true", nil
		}
		return "false", nil
	case string:
		if isRecordID(x) {
			return x, nil
		}
		b, _ := json.Marshal(x)
		return string(b), nil
	case time.Time:
		return `d"` + x.UTC().Format(time.RFC3339Nano) + `"`, nil
	case int:
		return fmt.Sprintf("%d", x), nil
	case int32:
		return fmt.Sprintf("%d", x), nil
	case int64:
		return fmt.Sprintf("%d", x), nil
	case float32:
		return fmt.Sprintf("%g", x), nil
	case float64:
		return fmt.Sprintf("%g", x), nil
	case []string:
		parts := make([]string, len(x))
		for i, e := range x {
			s, err := marshalSurreal(e)
			if err != nil {
				return "", err
			}
			parts[i] = s
		}
		return "[" + strings.Join(parts, ",") + "]", nil
	case []any:
		parts := make([]string, len(x))
		for i, e := range x {
			s, err := marshalSurreal(e)
			if err != nil {
				return "", err
			}
			parts[i] = s
		}
		return "[" + strings.Join(parts, ",") + "]", nil
	case map[string]any:
		parts := make([]string, 0, len(x))
		for k, val := range x {
			s, err := marshalSurreal(val)
			if err != nil {
				return "", err
			}
			kb, _ := json.Marshal(k)
			parts = append(parts, string(kb)+":"+s)
		}
		return "{" + strings.Join(parts, ",") + "}", nil
	case *time.Time:
		if x == nil {
			return "NONE", nil
		}
		return marshalSurreal(*x)
	default:
		// Fallback: encode via JSON. Works for arbitrary struct/slice shapes
		// produced by handler request bodies. Surreal accepts JSON-literal
		// objects as object/array values in DEFINE FLEXIBLE fields.
		b, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return string(b), nil
	}
}

// isRecordID returns true for tokens shaped like "table:id" where both sides
// match the relaxed Surreal identifier rules. We deliberately keep this strict
// — anything with whitespace or quote chars falls back to JSON-string encoding.
func isRecordID(s string) bool {
	if len(s) < 3 {
		return false
	}
	colon := -1
	for i, r := range s {
		if r == ':' {
			if colon != -1 {
				return false // more than one colon → ambiguous
			}
			colon = i
		}
	}
	if colon <= 0 || colon == len(s)-1 {
		return false
	}
	for i, r := range s {
		if i == colon {
			continue
		}
		if !(r == '_' || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')) {
			return false
		}
	}
	return true
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

