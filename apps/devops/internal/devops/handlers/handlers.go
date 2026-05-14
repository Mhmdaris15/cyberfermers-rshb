// Package handlers wires HTTP routes to the deploy service. Each
// handler is a thin adapter — parse, delegate, map errors to HTTP
// codes. No business logic lives here.
package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/config"
	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/models"
	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/services"
)

type Deps struct {
	Deploy *services.Deploy
}

// Register wires all routes. /health is public; everything else sits
// behind the InternalAuth middleware applied at the router level.
func Register(r *gin.Engine, authMW gin.HandlerFunc, d *Deps) {
	// Docker / Coolify healthchecks use `wget --spider`, which sends HEAD
	// (not GET). Gin does not auto-mirror GET → HEAD, so we register both
	// methods against the same handler. /health is unauthenticated.
	healthHandler := func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	}
	r.GET("/health", healthHandler)
	r.HEAD("/health", healthHandler)

	g := r.Group("/", authMW)
	{
		g.POST("/deploy", d.deploy)
		g.GET("/status", d.status)
		g.GET("/logs", d.logs)
		g.POST("/restart", d.restart)
	}
}

// ---- Handlers ------------------------------------------------------

func (d *Deps) deploy(c *gin.Context) {
	var req models.DeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_body", err)
		return
	}
	resp, err := d.Deploy.Trigger(c.Request.Context(), req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusAccepted, resp)
}

func (d *Deps) status(c *gin.Context) {
	appUUID := c.Query("application_uuid")
	deploymentUUID := c.Query("deployment_uuid")
	resp, err := d.Deploy.Status(c.Request.Context(), appUUID, deploymentUUID)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (d *Deps) logs(c *gin.Context) {
	appUUID := c.Query("application_uuid")
	if appUUID == "" {
		respondError(c, http.StatusBadRequest, "missing_param", errors.New("application_uuid is required"))
		return
	}
	lines, _ := strconv.Atoi(c.DefaultQuery("lines", "200"))
	resp, err := d.Deploy.Logs(c.Request.Context(), appUUID, lines)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (d *Deps) restart(c *gin.Context) {
	var req models.RestartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid_body", err)
		return
	}
	resp, err := d.Deploy.Restart(c.Request.Context(), req)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	c.JSON(http.StatusAccepted, resp)
}

// ---- Helpers -------------------------------------------------------

func respondError(c *gin.Context, status int, code string, err error) {
	c.AbortWithStatusJSON(status, models.ErrorResponse{Error: err.Error(), Code: code})
}

func respondServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, config.ErrNotAllowed):
		respondError(c, http.StatusForbidden, "not_allowlisted", err)
	default:
		respondError(c, http.StatusBadGateway, "upstream_error", err)
	}
}
