package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   /api/farmers/:id/social-posts — list + create
//   /api/social-posts/:id          — alias of /api/content/:id
//
//   Social posts follow the Stories/Blogs/Recipes template. The body
//   shape is opaque (FLEXIBLE TYPE object on the DB) so the FE editor
//   can evolve the schema (per-platform overrides, more slides, etc.)
//   without DB or handler changes.
//
//   Auto-creates a plan_card on the Phase-3 `social` board (NOT
//   storytelling — social has its own pipeline by design).
// ============================================================

func (d *Deps) ListFarmerSocialPosts(c *gin.Context) {
	posts, err := d.Repo.ListFarmerSocialPosts(c.Param("id"), c.Query("status"))
	if err != nil {
		log.Error().Err(err).Msg("social: list failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"posts": posts})
}

// createSocialReq is intentionally loose — only `title` is required so
// the row is cataloguable. The shape of `slides` / `platforms` /
// `scheduled_for` is the FE's contract, not the handler's.
type createSocialReq struct {
	Title          string     `json:"title" binding:"required,min=1,max=200"`
	Platforms      []string   `json:"platforms,omitempty"`
	Caption        string     `json:"caption"`
	Hashtags       []string   `json:"hashtags,omitempty"`
	CTA            string     `json:"cta,omitempty"`
	Slides         []any      `json:"slides,omitempty"`
	ScheduledFor   *time.Time `json:"scheduled_for,omitempty"`
	AudienceTags   []string   `json:"audience_tags,omitempty"`
	CreatePlanCard *bool      `json:"create_plan_card,omitempty"`
}

type createSocialResp struct {
	Post       *models.GeneratedContent `json:"post"`
	PlanCardID string                   `json:"plan_card_id,omitempty"`
}

func (d *Deps) CreateFarmerSocialPost(c *gin.Context) {
	farmerID := c.Param("id")
	if farmerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing farmer id"})
		return
	}

	var req createSocialReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}

	eventID, err := d.Repo.EnsureFreeformSocialEvent()
	if err != nil {
		log.Error().Err(err).Msg("social: event bootstrap failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	sugID, err := d.Repo.EnsureSocialSuggestion(farmerID, eventID)
	if err != nil {
		log.Error().Err(err).Msg("social: suggestion bootstrap failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	body := map[string]any{
		"title":         req.Title,
		"platforms":     defaultStringSlice(req.Platforms),
		"caption":       req.Caption,
		"hashtags":      defaultStringSlice(req.Hashtags),
		"cta":           req.CTA,
		"slides":        defaultAnySlice(req.Slides),
		"audience_tags": defaultStringSlice(req.AudienceTags),
	}
	if req.ScheduledFor != nil {
		body["scheduled_for"] = req.ScheduledFor.UTC()
	}
	postID, err := d.Repo.CreateUserSocialPost(sugID, body, callerID(c))
	if err != nil {
		log.Error().Err(err).Msg("social: content create failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	post, _ := d.Repo.GetContent(postID)
	resp := createSocialResp{Post: post}

	want := true
	if req.CreatePlanCard != nil {
		want = *req.CreatePlanCard
	}
	if want && post != nil {
		// Phase-3 `social` board is where the editorial pipeline for
		// posts lives — distinct from `storytelling` so the social team
		// can see "what's queued for publishing" without prose noise.
		due := time.Now().AddDate(0, 0, 3)
		if req.ScheduledFor != nil {
			due = *req.ScheduledFor
		}
		card := &models.PlanCard{
			Column:       "proposed",
			BoardType:    models.BoardSocial,
			Priority:     models.PriorityNormal,
			Title:        req.Title,
			Description:  truncate(req.Caption, 220),
			Hashtags:     req.Hashtags,
			AudienceTags: req.AudienceTags,
			Channels:     []string{string(models.ChSocial)},
			DueDate:      &due,
			CTA:          req.CTA,
		}
		sug := &models.Suggestion{ID: sugID, FarmerID: farmerID, Status: "proposed"}
		if created, err := d.Plan.AddCard(farmerID, callerID(c), sug, card); err == nil {
			resp.PlanCardID = created.ID
		} else {
			log.Warn().Err(err).Msg("social: plan card create failed (non-fatal)")
		}
	}

	c.JSON(http.StatusCreated, resp)
}

// GetSocialPost is a thin alias for GetContent.
func (d *Deps) GetSocialPost(c *gin.Context) {
	d.GetContent(c)
}
