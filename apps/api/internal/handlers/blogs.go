package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   /api/farmers/:id/blogs — list + create
//   /api/blogs/:id          — alias of /api/content/:id
//
//   Blogs follow the Stories template (Phase 4): generated_content
//   rows with channel='blog', lazy-bootstrap a freeform-blogs event +
//   per-farmer suggestion shell on first write. Creating a blog auto-
//   adds a plan_card on the storytelling kanban board so editorial
//   pipeline visibility is in one place.
// ============================================================

func (d *Deps) ListFarmerBlogs(c *gin.Context) {
	blogs, err := d.Repo.ListFarmerBlogs(c.Param("id"), c.Query("status"))
	if err != nil {
		log.Error().Err(err).Msg("blogs: list failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"blogs": blogs})
}

type createBlogReq struct {
	Title           string   `json:"title" binding:"required,min=1,max=200"`
	Lede            string   `json:"lede,omitempty"`
	Body            string   `json:"body"`
	CoverImageURL   string   `json:"cover_image_url,omitempty"`
	SEOKeywords     []string `json:"seo_keywords,omitempty"`
	MetaDescription string   `json:"meta_description,omitempty"`
	AudienceTags    []string `json:"audience_tags,omitempty"`
	Hashtags        []string `json:"hashtags,omitempty"`
	CreatePlanCard  *bool    `json:"create_plan_card,omitempty"`
}

type createBlogResp struct {
	Blog       *models.GeneratedContent `json:"blog"`
	PlanCardID string                   `json:"plan_card_id,omitempty"`
}

func (d *Deps) CreateFarmerBlog(c *gin.Context) {
	farmerID := c.Param("id")
	if farmerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing farmer id"})
		return
	}

	var req createBlogReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}

	// Lazy bootstrap chain: event → suggestion → content row, each step
	// idempotent so re-running picks up cleanly.
	eventID, err := d.Repo.EnsureFreeformBlogsEvent()
	if err != nil {
		log.Error().Err(err).Msg("blogs: event bootstrap failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	sugID, err := d.Repo.EnsureBlogsSuggestion(farmerID, eventID)
	if err != nil {
		log.Error().Err(err).Msg("blogs: suggestion bootstrap failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	body := map[string]any{
		"title":            req.Title,
		"lede":             req.Lede,
		"body":             req.Body,
		"cover_image_url":  req.CoverImageURL,
		"seo_keywords":     defaultStringSlice(req.SEOKeywords),
		"meta_description": req.MetaDescription,
		"audience_tags":    defaultStringSlice(req.AudienceTags),
		"hashtags":         defaultStringSlice(req.Hashtags),
	}
	blogID, err := d.Repo.CreateUserBlog(sugID, body, callerID(c))
	if err != nil {
		log.Error().Err(err).Msg("blogs: content create failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	blog, _ := d.Repo.GetContent(blogID)
	resp := createBlogResp{Blog: blog}

	// Optional: surface on the Phase-3 storytelling kanban (same
	// editorial pipeline). Opt out by passing create_plan_card: false.
	want := true
	if req.CreatePlanCard != nil {
		want = *req.CreatePlanCard
	}
	if want && blog != nil {
		card := &models.PlanCard{
			Column:       "proposed",
			BoardType:    models.BoardStorytelling,
			Priority:     models.PriorityNormal,
			Title:        req.Title,
			Description:  truncate(firstNonEmptyStr(req.Lede, req.Body), 220),
			Hashtags:     req.Hashtags,
			AudienceTags: req.AudienceTags,
			Channels:     []string{string(models.ChBlog)},
			DueDate:      ptrTime(time.Now().AddDate(0, 0, 14)),
		}
		sug := &models.Suggestion{ID: sugID, FarmerID: farmerID, Status: "proposed"}
		if created, err := d.Plan.AddCard(farmerID, callerID(c), sug, card); err == nil {
			resp.PlanCardID = created.ID
		} else {
			log.Warn().Err(err).Msg("blogs: plan card create failed (non-fatal)")
		}
	}

	c.JSON(http.StatusCreated, resp)
}

// GetBlog is a thin alias that returns a single generated_content row
// by bare id. Same as GetContent but lives under /api/blogs so the FE
// doesn't have to do channel filtering on the response.
func (d *Deps) GetBlog(c *gin.Context) {
	d.GetContent(c)
}

// firstNonEmptyStr returns the first non-empty string from a list.
// Used to prefer `lede` over `body` for plan-card descriptions.
func firstNonEmptyStr(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
