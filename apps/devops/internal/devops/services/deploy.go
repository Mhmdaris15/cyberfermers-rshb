// Package services is the policy layer between HTTP handlers and the
// raw Coolify client. Every method here enforces the allowlist BEFORE
// touching the network — the client never sees a UUID the operator
// hasn't been pre-authorized to act on.
package services

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/client"
	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/config"
	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/models"
)

type Deploy struct {
	cfg     *config.Config
	coolify *client.Coolify
	log     *slog.Logger
}

func NewDeploy(cfg *config.Config, c *client.Coolify, log *slog.Logger) *Deploy {
	return &Deploy{cfg: cfg, coolify: c, log: log.With(slog.String("component", "deploy-service"))}
}

// Trigger validates the allowlist and dispatches to Coolify.
func (s *Deploy) Trigger(ctx context.Context, req models.DeployRequest) (*models.DeployResponse, error) {
	if !s.cfg.IsAppAllowed(req.ApplicationUUID) {
		return nil, config.ErrNotAllowed
	}
	s.log.Info("trigger deploy",
		slog.String("application_uuid", req.ApplicationUUID),
		slog.Bool("force", req.Force),
	)
	return s.coolify.TriggerDeploy(ctx, req.ApplicationUUID, req.Force)
}

// Status returns either a specific deployment or the latest one for an app.
// Pass deploymentUUID="" to look up the latest deployment for appUUID.
func (s *Deploy) Status(ctx context.Context, appUUID, deploymentUUID string) (*models.StatusResponse, error) {
	if appUUID == "" && deploymentUUID == "" {
		return nil, errors.New("either application_uuid or deployment_uuid is required")
	}
	if appUUID != "" && !s.cfg.IsAppAllowed(appUUID) {
		return nil, config.ErrNotAllowed
	}

	var d *models.CoolifyDeployment
	var err error
	if deploymentUUID != "" {
		d, err = s.coolify.GetDeployment(ctx, deploymentUUID)
	} else {
		d, err = s.coolify.LatestDeploymentForApp(ctx, appUUID)
	}
	if err != nil {
		return nil, err
	}
	if d == nil {
		return &models.StatusResponse{ApplicationUUID: appUUID, Status: "no_deployments"}, nil
	}
	// If we looked up by deployment_uuid, re-check the allowlist on the
	// returned app uuid so callers can't probe deployments outside their scope.
	if !s.cfg.IsAppAllowed(d.ApplicationUUID) {
		return nil, config.ErrNotAllowed
	}
	return &models.StatusResponse{
		DeploymentUUID:  d.UUID,
		ApplicationUUID: d.ApplicationUUID,
		Status:          d.Status,
		StartedAt:       parseTime(d.CreatedAt),
		FinishedAt:      parseTime(d.UpdatedAt),
		Commit:          d.Commit,
	}, nil
}

// Logs fetches recent container logs (default 200 lines).
func (s *Deploy) Logs(ctx context.Context, appUUID string, lines int) (*models.LogsResponse, error) {
	if !s.cfg.IsAppAllowed(appUUID) {
		return nil, config.ErrNotAllowed
	}
	body, n, err := s.coolify.GetApplicationLogs(ctx, appUUID, lines)
	if err != nil {
		return nil, err
	}
	return &models.LogsResponse{
		ApplicationUUID: appUUID,
		Lines:           n,
		Logs:            body,
	}, nil
}

// Restart asks Coolify to restart the given application.
func (s *Deploy) Restart(ctx context.Context, req models.RestartRequest) (*models.RestartResponse, error) {
	if !s.cfg.IsAppAllowed(req.ApplicationUUID) {
		return nil, config.ErrNotAllowed
	}
	s.log.Info("restart", slog.String("application_uuid", req.ApplicationUUID))
	if err := s.coolify.RestartApplication(ctx, req.ApplicationUUID); err != nil {
		return nil, err
	}
	return &models.RestartResponse{
		ApplicationUUID: req.ApplicationUUID,
		Status:          "restarting",
		Message:         "Coolify accepted restart request",
	}, nil
}

func parseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}
