// Package models holds DTOs shared between the HTTP handlers, the
// service layer, and the Coolify client. Keep these intentionally
// minimal — only the fields we actually surface to callers.
package models

import "time"

// ---- Request bodies (what AI agents POST to us) --------------------

type DeployRequest struct {
	ApplicationUUID string `json:"application_uuid" binding:"required"`
	Force           bool   `json:"force,omitempty"`
}

type RestartRequest struct {
	ApplicationUUID string `json:"application_uuid" binding:"required"`
}

// ---- Response bodies (what we return to AI agents) -----------------

type DeployResponse struct {
	ApplicationUUID string `json:"application_uuid"`
	DeploymentUUID  string `json:"deployment_uuid"`
	Status          string `json:"status"`            // queued | building | running | finished | failed
	Message         string `json:"message,omitempty"`
}

type StatusResponse struct {
	DeploymentUUID  string    `json:"deployment_uuid"`
	ApplicationUUID string    `json:"application_uuid"`
	Status          string    `json:"status"`
	StartedAt       time.Time `json:"started_at,omitempty"`
	FinishedAt      time.Time `json:"finished_at,omitempty"`
	Commit          string    `json:"commit,omitempty"`
}

type LogsResponse struct {
	ApplicationUUID string `json:"application_uuid"`
	Lines           int    `json:"lines"`
	Logs            string `json:"logs"`
}

type RestartResponse struct {
	ApplicationUUID string `json:"application_uuid"`
	Status          string `json:"status"`
	Message         string `json:"message,omitempty"`
}

type ErrorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code,omitempty"`
}

// ---- Coolify raw payloads (internal to client/) --------------------
// We model only the fields we read; Coolify returns more but extra
// keys are ignored by encoding/json.

type CoolifyDeployment struct {
	UUID            string `json:"uuid"`
	ApplicationUUID string `json:"application_uuid"`
	Status          string `json:"status"`
	Commit          string `json:"commit"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

type CoolifyDeployTrigger struct {
	Deployments []struct {
		ResourceUUID   string `json:"resource_uuid"`
		DeploymentUUID string `json:"deployment_uuid"`
		Message        string `json:"message"`
	} `json:"deployments"`
}
