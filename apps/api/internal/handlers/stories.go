package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   /api/farmers/:id/stories — list + create
//   /api/stories/:id          — alias of /api/content/:id projected
//
//   Stories are generated_content with channel='story'. Free-form
//   stories (not pegged to a calendar event) attach to a synthetic
//   "freeform-storytelling" event + per-farmer suggestion that we
//   lazy-bootstrap on first write. No schema changes.
// ============================================================

func (d *Deps) ListFarmerStories(c *gin.Context) {
	farmerID := c.Param("id")
	status := c.Query("status") // optional: draft|published|archived
	stories, err := d.Repo.ListFarmerStories(farmerID, status)
	if err != nil {
		log.Error().Err(err).Msg("stories: list failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"stories": stories})
}

type createStoryReq struct {
	Title          string   `json:"title" binding:"required,min=1,max=200"`
	Body           string   `json:"body"`
	HeroImageURL   string   `json:"hero_image_url,omitempty"`
	ImagePrompt    string   `json:"image_prompt,omitempty"`
	AudienceTags   []string `json:"audience_tags,omitempty"`
	Hashtags       []string `json:"hashtags,omitempty"`
	CreatePlanCard *bool    `json:"create_plan_card,omitempty"` // default true
}

type createStoryResp struct {
	Story       *models.GeneratedContent `json:"story"`
	PlanCardID  string                   `json:"plan_card_id,omitempty"`
}

func (d *Deps) CreateFarmerStory(c *gin.Context) {
	farmerID := c.Param("id")
	if farmerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing farmer id"})
		return
	}

	var req createStoryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}

	// Lazy bootstrap chain: event → suggestion → content row. Each step
	// is idempotent so a partial failure on a later step doesn't leak
	// orphan rows — re-running picks up exactly where we left off.
	eventID, err := d.Repo.EnsureFreeformStorytellingEvent()
	if err != nil {
		log.Error().Err(err).Msg("stories: event bootstrap failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	sugID, err := d.Repo.EnsureStorytellingSuggestion(farmerID, eventID)
	if err != nil {
		log.Error().Err(err).Msg("stories: suggestion bootstrap failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	body := map[string]any{
		"title":          req.Title,
		"body":           req.Body,
		"hero_image_url": req.HeroImageURL,
		"image_prompt":   req.ImagePrompt,
		"audience_tags":  defaultStringSlice(req.AudienceTags),
		"hashtags":       defaultStringSlice(req.Hashtags),
	}
	storyID, err := d.Repo.CreateUserStory(sugID, body, callerID(c))
	if err != nil {
		log.Error().Err(err).Msg("stories: content create failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Fetch the new story row so the FE can render it without a second
	// round-trip. Failure here is non-fatal — we still return the id.
	story, _ := d.Repo.GetContent(storyID)

	resp := createStoryResp{Story: story}

	// Optional: surface the story on the Phase-3 storytelling kanban.
	// Default ON for the FE flow; AI batch flows can opt out by passing
	// create_plan_card: false.
	want := true
	if req.CreatePlanCard != nil {
		want = *req.CreatePlanCard
	}
	if want && story != nil {
		card := &models.PlanCard{
			Column:       "proposed",
			BoardType:    models.BoardStorytelling,
			Priority:     models.PriorityNormal,
			Title:        req.Title,
			Description:  truncate(req.Body, 200),
			Hashtags:     req.Hashtags,
			AudienceTags: req.AudienceTags,
			Channels:     []string{string(models.ChStory)},
			DueDate:      ptrTime(time.Now().AddDate(0, 0, 7)),
		}
		// Minimal suggestion stub for plan.Service.AddCard — it only needs
		// the id; the suggestion was just lazy-created above.
		sug := &models.Suggestion{ID: sugID, FarmerID: farmerID, Status: "proposed"}
		if created, err := d.Plan.AddCard(farmerID, callerID(c), sug, card); err == nil {
			resp.PlanCardID = created.ID
		} else {
			log.Warn().Err(err).Msg("stories: plan card create failed (non-fatal)")
		}
	}

	c.JSON(http.StatusCreated, resp)
}

// GetStory is a thin alias that returns a single generated_content row
// by bare id. Same shape as GetContent but lives under /api/stories so
// the FE doesn't have to do channel filtering on the response.
func (d *Deps) GetStory(c *gin.Context) {
	d.GetContent(c) // identical behavior — channel check is FE's job
}

// ─── small helpers ─────────────────────────────────────────────────────

func defaultStringSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func ptrTime(t time.Time) *time.Time { return &t }

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
