package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
)

// ============================================================
//   Phase-3 plan-card endpoints (single-card detail + lifecycle).
//
//   GET    /api/plan/cards/:id              — full card detail
//   PATCH  /api/plan/cards/:id              — partial update (rich fields)
//   DELETE /api/plan/cards/:id              — archive (hard delete + activity)
//   GET    /api/plan/cards/:id/comments     — list comments
//   POST   /api/plan/cards/:id/comments     — add comment
//   GET    /api/plan/cards/:id/activity     — audit timeline
//   GET    /api/farmers/:id/plan/boards     — per-board counts (for switcher)
//
//   Existing /api/farmers/:id/plan already supports ?board=<type>
//   (wired in handlers.go::GetPlan).
// ============================================================

func (d *Deps) GetPlanCard(c *gin.Context) {
	card, err := d.Repo.GetPlanCard(c.Param("id"))
	if err != nil {
		if errors.Is(err, db.ErrPlanCardNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "card not found", "code": "not_found"})
			return
		}
		log.Error().Err(err).Msg("cards: get failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, card)
}

// patchCardReq is the body for PATCH /api/plan/cards/:id. Every field is
// a pointer so we can distinguish "field omitted" (no change) from
// "field set to zero value" (clear it).
type patchCardReq struct {
	Title        *string    `json:"title,omitempty"`
	Description  *string    `json:"description,omitempty"`
	Priority     *string    `json:"priority,omitempty"`
	DueDate      *time.Time `json:"due_date,omitempty"`
	AudienceTags *[]string  `json:"audience_tags,omitempty"`
	Channels     *[]string  `json:"channels,omitempty"`
	Hashtags     *[]string  `json:"hashtags,omitempty"`
	CTA          *string    `json:"cta,omitempty"`
	Attachments  *[]any     `json:"attachments,omitempty"`
	ProductRefs  *[]string  `json:"product_refs,omitempty"`
	AssigneeID   *string    `json:"assignee_id,omitempty"`
	BoardType    *string    `json:"board_type,omitempty"`
	Note         *string    `json:"note,omitempty"`
}

func (d *Deps) UpdatePlanCard(c *gin.Context) {
	var req patchCardReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}

	// Build the loose patch map the repo expects. Only fields present in
	// the body (non-nil pointers) make it in — absent fields are not
	// touched, even on a partial submit.
	patch := map[string]any{}
	if req.Title != nil {
		patch["title"] = *req.Title
	}
	if req.Description != nil {
		patch["description"] = *req.Description
	}
	if req.Priority != nil {
		patch["priority"] = *req.Priority
	}
	if req.DueDate != nil {
		patch["due_date"] = *req.DueDate
	}
	if req.AudienceTags != nil {
		patch["audience_tags"] = *req.AudienceTags
	}
	if req.Channels != nil {
		patch["channels"] = *req.Channels
	}
	if req.Hashtags != nil {
		patch["hashtags"] = *req.Hashtags
	}
	if req.CTA != nil {
		patch["cta"] = *req.CTA
	}
	if req.Attachments != nil {
		patch["attachments"] = *req.Attachments
	}
	if req.ProductRefs != nil {
		patch["product_refs"] = *req.ProductRefs
	}
	if req.AssigneeID != nil {
		patch["assignee_id"] = *req.AssigneeID
	}
	if req.BoardType != nil {
		patch["board_type"] = *req.BoardType
	}
	if req.Note != nil {
		patch["note"] = *req.Note
	}

	if len(patch) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	card, err := d.Repo.UpdatePlanCardFields(c.Param("id"), patch, callerID(c))
	if err != nil {
		if errors.Is(err, db.ErrPlanCardNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "card not found", "code": "not_found"})
			return
		}
		log.Error().Err(err).Msg("cards: update failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, card)
}

func (d *Deps) DeletePlanCard(c *gin.Context) {
	err := d.Repo.DeletePlanCard(c.Param("id"), callerID(c))
	if err != nil {
		if errors.Is(err, db.ErrPlanCardNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "card not found", "code": "not_found"})
			return
		}
		log.Error().Err(err).Msg("cards: delete failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── comments ──────────────────────────────────────────────────────────

func (d *Deps) ListPlanCardComments(c *gin.Context) {
	comments, err := d.Repo.ListPlanCardComments(c.Param("id"))
	if err != nil {
		log.Error().Err(err).Msg("cards: list comments failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"comments": comments})
}

type addCommentReq struct {
	Body string `json:"body" binding:"required,min=1,max=4000"`
}

func (d *Deps) AddPlanCardComment(c *gin.Context) {
	var req addCommentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}
	comment, err := d.Repo.AddPlanCardComment(c.Param("id"), callerID(c), req.Body)
	if err != nil {
		if errors.Is(err, db.ErrPlanCardNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "card not found", "code": "not_found"})
			return
		}
		log.Error().Err(err).Msg("cards: add comment failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, comment)
}

// ─── activity ──────────────────────────────────────────────────────────

func (d *Deps) ListPlanCardActivity(c *gin.Context) {
	acts, err := d.Repo.ListPlanCardActivity(c.Param("id"), 50)
	if err != nil {
		log.Error().Err(err).Msg("cards: list activity failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"activity": acts})
}

// ─── board summaries ───────────────────────────────────────────────────

func (d *Deps) ListBoards(c *gin.Context) {
	boards, err := d.Repo.ListBoardSummaries(c.Param("id"))
	if err != nil {
		log.Error().Err(err).Msg("cards: list boards failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"boards": boards})
}
