package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   /api/farmers/:id/push — list + create
//   /api/push/:id          — alias of /api/content/:id
//
//   Push notifications follow the same content-module template but
//   their body carries a `dispatch` object that the runtime scheduler
//   (cmd/server/main.go) mutates when scheduled_for fires. Auto-creates
//   a plan_card on the Phase-3 `push` board.
// ============================================================

func (d *Deps) ListFarmerPushes(c *gin.Context) {
	pushes, err := d.Repo.ListFarmerPushes(c.Param("id"), c.Query("status"))
	if err != nil {
		log.Error().Err(err).Msg("push: list failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"pushes": pushes})
}

type createPushReq struct {
	Title           string     `json:"title" binding:"required,min=1,max=200"`
	Headline        string     `json:"headline" binding:"required,min=1,max=200"`
	Body            string     `json:"body" binding:"required,min=1,max=500"`
	DeepLink        string     `json:"deep_link,omitempty"`
	IconEmoji       string     `json:"icon_emoji,omitempty"`
	PreviewImageURL string     `json:"preview_image_url,omitempty"`
	Segments        []string   `json:"segments,omitempty"`
	Urgency         string     `json:"urgency,omitempty"`        // normal | high | critical
	ScheduledFor    *time.Time `json:"scheduled_for,omitempty"`
	CreatePlanCard  *bool      `json:"create_plan_card,omitempty"`
}

type createPushResp struct {
	Push       *models.GeneratedContent `json:"push"`
	PlanCardID string                   `json:"plan_card_id,omitempty"`
}

func (d *Deps) CreateFarmerPush(c *gin.Context) {
	farmerID := c.Param("id")
	if farmerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing farmer id"})
		return
	}

	var req createPushReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}

	if req.Urgency == "" {
		req.Urgency = "normal"
	}

	eventID, err := d.Repo.EnsureFreeformPushEvent()
	if err != nil {
		log.Error().Err(err).Msg("push: event bootstrap failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	sugID, err := d.Repo.EnsurePushSuggestion(farmerID, eventID)
	if err != nil {
		log.Error().Err(err).Msg("push: suggestion bootstrap failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	body := map[string]any{
		"title":             req.Title,
		"headline":          req.Headline,
		"body":              req.Body,
		"deep_link":         req.DeepLink,
		"icon_emoji":        req.IconEmoji,
		"preview_image_url": req.PreviewImageURL,
		"segments":          defaultStringSlice(req.Segments),
		"urgency":           req.Urgency,
		"dispatch": map[string]any{
			"status":   "queued",
			"attempts": 0,
		},
	}
	if req.ScheduledFor != nil {
		body["scheduled_for"] = req.ScheduledFor.UTC()
	}

	pushID, err := d.Repo.CreateUserPush(sugID, body, callerID(c))
	if err != nil {
		log.Error().Err(err).Msg("push: content create failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	push, _ := d.Repo.GetContent(pushID)
	resp := createPushResp{Push: push}

	want := true
	if req.CreatePlanCard != nil {
		want = *req.CreatePlanCard
	}
	if want && push != nil {
		// Plan-card lives on the Phase-3 `push` board.
		due := time.Now().Add(2 * time.Hour)
		if req.ScheduledFor != nil {
			due = *req.ScheduledFor
		}
		// Map push urgency to plan-card priority so the operator can
		// scan the push board and see the critical ones jump out.
		priority := models.PriorityNormal
		switch req.Urgency {
		case "high":
			priority = models.PriorityHigh
		case "critical":
			priority = models.PriorityUrgent
		}
		card := &models.PlanCard{
			Column:       "proposed",
			BoardType:    models.BoardPush,
			Priority:     priority,
			Title:        req.Headline, // headline is more decision-relevant than the internal title
			Description:  truncate(req.Body, 220),
			AudienceTags: req.Segments,
			Channels:     []string{string(models.ChPush)},
			DueDate:      &due,
		}
		sug := &models.Suggestion{ID: sugID, FarmerID: farmerID, Status: "proposed"}
		if created, err := d.Plan.AddCard(farmerID, callerID(c), sug, card); err == nil {
			resp.PlanCardID = created.ID
		} else {
			log.Warn().Err(err).Msg("push: plan card create failed (non-fatal)")
		}
	}

	c.JSON(http.StatusCreated, resp)
}

func (d *Deps) GetPush(c *gin.Context) {
	d.GetContent(c)
}
