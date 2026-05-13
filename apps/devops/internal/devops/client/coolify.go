// Package client wraps the subset of Coolify's REST API that the
// DevOps operator exposes to AI agents. The client deliberately
// implements only a handful of read + trigger operations — no
// generic "execute arbitrary URL" or "run command" surface.
//
// Coolify v4 API reference: https://coolify.io/docs/api-reference/
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/models"
)

type Coolify struct {
	baseURL string
	token   string
	http    *http.Client
	log     *slog.Logger
}

func New(baseURL, token string, timeout time.Duration, log *slog.Logger) *Coolify {
	return &Coolify{
		baseURL: baseURL,
		token:   token,
		http:    &http.Client{Timeout: timeout},
		log:     log.With(slog.String("component", "coolify")),
	}
}

// ---- Public surface (all return typed payloads, never raw http) ----

// TriggerDeploy POSTs /api/v1/deploy?uuid={app_uuid}&force={bool}.
// Coolify returns a list of deployments; we collapse to the first match
// since we trigger exactly one app at a time.
func (c *Coolify) TriggerDeploy(ctx context.Context, appUUID string, force bool) (*models.DeployResponse, error) {
	q := url.Values{}
	q.Set("uuid", appUUID)
	q.Set("force", strconv.FormatBool(force))

	body, err := c.do(ctx, http.MethodPost, "/api/v1/deploy?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}

	var trig models.CoolifyDeployTrigger
	if err := json.Unmarshal(body, &trig); err != nil {
		// Coolify sometimes returns a flat {"message": "..."} on success.
		// Best-effort surface that without failing.
		return &models.DeployResponse{
			ApplicationUUID: appUUID,
			Status:          "queued",
			Message:         string(body),
		}, nil
	}
	if len(trig.Deployments) == 0 {
		return &models.DeployResponse{
			ApplicationUUID: appUUID,
			Status:          "queued",
			Message:         "no deployment row returned",
		}, nil
	}
	d := trig.Deployments[0]
	return &models.DeployResponse{
		ApplicationUUID: d.ResourceUUID,
		DeploymentUUID:  d.DeploymentUUID,
		Status:          "queued",
		Message:         d.Message,
	}, nil
}

// GetDeployment fetches a single deployment row by its UUID.
func (c *Coolify) GetDeployment(ctx context.Context, deploymentUUID string) (*models.CoolifyDeployment, error) {
	body, err := c.do(ctx, http.MethodGet, "/api/v1/deployments/"+url.PathEscape(deploymentUUID), nil)
	if err != nil {
		return nil, err
	}
	var d models.CoolifyDeployment
	if err := json.Unmarshal(body, &d); err != nil {
		return nil, fmt.Errorf("decode deployment: %w", err)
	}
	return &d, nil
}

// LatestDeploymentForApp returns the most recent deployment for an app,
// or nil if Coolify has no history yet.
func (c *Coolify) LatestDeploymentForApp(ctx context.Context, appUUID string) (*models.CoolifyDeployment, error) {
	q := url.Values{}
	q.Set("uuid", appUUID)
	q.Set("skip", "0")
	q.Set("take", "1")

	body, err := c.do(ctx, http.MethodGet, "/api/v1/deployments?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	var list []models.CoolifyDeployment
	if err := json.Unmarshal(body, &list); err != nil {
		// Coolify may wrap results — try {"data":[...]}.
		var wrap struct {
			Data []models.CoolifyDeployment `json:"data"`
		}
		if err2 := json.Unmarshal(body, &wrap); err2 == nil {
			list = wrap.Data
		} else {
			return nil, fmt.Errorf("decode deployments list: %w", err)
		}
	}
	if len(list) == 0 {
		return nil, nil
	}
	return &list[0], nil
}

// GetApplicationLogs returns the most recent container logs for an app.
// Coolify's logs endpoint varies by version — adjust the path here if your
// instance differs. Returns the raw text and a parsed line count.
func (c *Coolify) GetApplicationLogs(ctx context.Context, appUUID string, lines int) (string, int, error) {
	if lines <= 0 || lines > 5000 {
		lines = 200
	}
	q := url.Values{}
	q.Set("lines", strconv.Itoa(lines))

	body, err := c.do(ctx, http.MethodGet, "/api/v1/applications/"+url.PathEscape(appUUID)+"/logs?"+q.Encode(), nil)
	if err != nil {
		return "", 0, err
	}
	// Coolify may return either a JSON envelope {"logs": "..."} or raw text.
	var env struct {
		Logs string `json:"logs"`
	}
	if json.Unmarshal(body, &env) == nil && env.Logs != "" {
		return env.Logs, countLines(env.Logs), nil
	}
	s := string(body)
	return s, countLines(s), nil
}

// RestartApplication asks Coolify to restart the given application.
func (c *Coolify) RestartApplication(ctx context.Context, appUUID string) error {
	_, err := c.do(ctx, http.MethodPost, "/api/v1/applications/"+url.PathEscape(appUUID)+"/restart", nil)
	return err
}

// ---- Internal HTTP plumbing ----------------------------------------

func (c *Coolify) do(ctx context.Context, method, path string, body any) ([]byte, error) {
	var reader io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("encode body: %w", err)
		}
		reader = bytes.NewReader(buf)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	// Bearer token — NEVER logged. The token field is also redacted in any
	// fmt.Stringer / slog.Value the Coolify struct might offer in the future.
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	start := time.Now()
	resp, err := c.http.Do(req)
	if err != nil {
		c.log.Error("coolify request failed",
			slog.String("method", method),
			slog.String("path", path),
			slog.Duration("elapsed", time.Since(start)),
			slog.String("err", err.Error()),
		)
		return nil, fmt.Errorf("coolify %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	c.log.Info("coolify request",
		slog.String("method", method),
		slog.String("path", path),
		slog.Int("status", resp.StatusCode),
		slog.Int("bytes", len(respBody)),
		slog.Duration("elapsed", time.Since(start)),
	)

	if resp.StatusCode >= 400 {
		// Surface the upstream error message but never the request body
		// (which could contain caller-supplied secrets in the future).
		return nil, fmt.Errorf("coolify %s %s: HTTP %d: %s",
			method, path, resp.StatusCode, truncate(string(respBody), 512))
	}
	return respBody, nil
}

func countLines(s string) int {
	if s == "" {
		return 0
	}
	n := 1
	for _, r := range s {
		if r == '\n' {
			n++
		}
	}
	return n
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
