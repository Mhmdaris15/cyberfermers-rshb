package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/middleware"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/ai"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/chat"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/insights"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/plan"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/recommendation"
)

// Deps is the dependency bundle passed to every handler.
type Deps struct {
	Repo        *db.Repo
	Reco        *recommendation.Engine
	Content     *ai.ContentService
	Plan        *plan.Service
	Insights    *insights.Engine
	ChatSvc     *chat.Service
	GeminiModel string // used as audit label on persisted GeneratedContent rows

	// Auth knobs — populated from config at boot.
	SessionTTL         time.Duration // fixed-expiry session TTL (default 7d)
	LoginRateLimit     int           // failed attempts per window before 429
	LoginRateWindowMin int           // window size in minutes

	// Login rate limiter — populated lazily inside Login handler.
	loginLimiter *loginRateLimiter
}

func Register(r *gin.Engine, d *Deps) {
	// Docker / Coolify healthchecks invoke `wget --spider`, which sends
	// HEAD (not GET). Gin does not auto-mirror GET → HEAD, so we register
	// the same handler against both methods. Without HEAD the container
	// looks alive in logs but Docker marks it unhealthy.
	healthHandler := func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) }
	r.GET("/health", healthHandler)
	r.HEAD("/health", healthHandler)

	api := r.Group("/api")
	{
		// ── public ───────────────────────────────────────────────────
		// Login is the ONLY pre-auth endpoint. Everything else is gated.
		api.POST("/auth/login", d.Login)

		// ── authed ───────────────────────────────────────────────────
		// `nil` Repo (e.g. in tests) means the auth middleware can't run;
		// guarded so health_test.go with an empty Deps still passes.
		var authed *gin.RouterGroup
		if d.Repo != nil {
			authed = api.Group("", middleware.RequireAuth(d.Repo))
		} else {
			authed = api.Group("")
		}

		authed.POST("/auth/logout", d.Logout)
		authed.GET("/auth/me", d.Me)

		authed.GET("/farmers", d.ListFarmers)
		authed.GET("/farmers/:id", d.GetFarmer)
		authed.GET("/farmers/:id/products", d.GetFarmerProducts)
		authed.GET("/farmers/:id/calendar", d.GetCalendar)
		authed.GET("/farmers/:id/plan", d.GetPlan)
		authed.GET("/farmers/:id/insights", d.GetInsights)
		authed.POST("/farmers/:id/chat", d.Chat)
		authed.GET("/farmers/:id/stream", d.Stream)

		authed.GET("/events", d.ListEvents)
		authed.POST("/suggestions", d.CreateSuggestion)
		authed.GET("/suggestions/:id", d.GetSuggestion)
		authed.POST("/suggestions/:id/generate", d.GenerateContent)
		authed.GET("/suggestions/:id/content", d.ListContent)
		authed.POST("/plan/cards", d.AddPlanCard)
		authed.POST("/plan/cards/move", d.MovePlanCard)

		// ── phase-3 multi-board kanban ─────────────────────────────
		// Spec: docs/superpowers/specs/2026-05-14-multi-board-kanban-design.md
		authed.GET("/farmers/:id/plan/boards", d.ListBoards)
		authed.GET("/plan/cards/:id", d.GetPlanCard)
		authed.PATCH("/plan/cards/:id", d.UpdatePlanCard)
		authed.DELETE("/plan/cards/:id", d.DeletePlanCard)
		authed.GET("/plan/cards/:id/comments", d.ListPlanCardComments)
		authed.POST("/plan/cards/:id/comments", d.AddPlanCardComment)
		authed.GET("/plan/cards/:id/activity", d.ListPlanCardActivity)

		// ── content lifecycle (phase-2) ────────────────────────────
		// Spec: docs/superpowers/specs/2026-05-14-content-versioning-design.md
		authed.GET("/content/:id", d.GetContent)
		authed.PATCH("/content/:id", d.UpdateContent)
		authed.POST("/content/:id/publish", d.PublishContent)
		authed.POST("/content/:id/archive", d.ArchiveContent)
		authed.POST("/content/:id/unarchive", d.UnarchiveContent)
		authed.GET("/content/:id/revisions", d.ListContentRevisions)
		authed.POST("/content/:id/revisions/:n/restore", d.RestoreContentRevision)

		// ── stories module (phase-4) ───────────────────────────────
		// Spec: docs/superpowers/specs/2026-05-14-stories-module-design.md
		// Stories are generated_content with channel='story'; these
		// routes are a dedicated view + free-form creation flow.
		authed.GET("/farmers/:id/stories", d.ListFarmerStories)
		authed.POST("/farmers/:id/stories", d.CreateFarmerStory)
		authed.GET("/stories/:id", d.GetStory)

		// ── blogs module (phase-5) ─────────────────────────────────
		// Spec: docs/superpowers/specs/2026-05-14-blogs-module-design.md
		// Blogs are generated_content with channel='blog'; same
		// lazy-bootstrap pattern as Stories (freeform-blogs event).
		authed.GET("/farmers/:id/blogs", d.ListFarmerBlogs)
		authed.POST("/farmers/:id/blogs", d.CreateFarmerBlog)
		authed.GET("/blogs/:id", d.GetBlog)

		// ── recipes module (phase-6) ───────────────────────────────
		// Spec: docs/superpowers/specs/2026-05-14-recipes-module-design.md
		// Recipes are generated_content with channel='recipe' (structured
		// body — ingredients/steps/nutrition arrays). Same lazy-bootstrap
		// pattern as Stories/Blogs (freeform-recipes event).
		authed.GET("/farmers/:id/recipes", d.ListFarmerRecipes)
		authed.POST("/farmers/:id/recipes", d.CreateFarmerRecipe)
		authed.GET("/recipes/:id", d.GetRecipe)

		// ── social module (phase-7) ────────────────────────────────
		// Spec: docs/superpowers/specs/2026-05-14-social-module-design.md
		// Social posts are generated_content with channel='social'.
		// Plan-card linked to Phase-3 `social` board (not storytelling).
		authed.GET("/farmers/:id/social-posts", d.ListFarmerSocialPosts)
		authed.POST("/farmers/:id/social-posts", d.CreateFarmerSocialPost)
		authed.GET("/social-posts/:id", d.GetSocialPost)

		// ── admin-only ───────────────────────────────────────────────
		admin := authed.Group("/admin", middleware.RequireAdmin())
		admin.GET("/users", d.ListUsers)
		admin.POST("/users", d.CreateUser)
		admin.PATCH("/users/:id", d.UpdateUser)
		admin.DELETE("/users/:id", d.DeleteUser)
		admin.GET("/sessions", d.ListSessions)
		admin.DELETE("/sessions/:id", d.RevokeSession)
	}
}

// ----- farmers ----------------------------------------------------------

func (d *Deps) ListFarmers(c *gin.Context) {
	// `?with_counts=1` returns the heavier shape used by the picker page;
	// the default response stays light for autocomplete-style consumers.
	withCounts := c.Query("with_counts") != ""
	var (
		list []models.Farmer
		err  error
	)
	if withCounts {
		list, err = d.Repo.ListFarmersWithCounts(200)
	} else {
		list, err = d.Repo.ListFarmers(200)
	}
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"farmers": list})
}

func (d *Deps) GetFarmer(c *gin.Context) {
	f, err := d.Repo.GetFarmer(c.Param("id"))
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, f)
}

func (d *Deps) GetFarmerProducts(c *gin.Context) {
	prods, err := d.Repo.ListProductsByFarmer(c.Param("id"))
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"products": prods, "count": len(prods)})
}

// ----- calendar ---------------------------------------------------------

func (d *Deps) GetCalendar(c *gin.Context) {
	from := parseDate(c.Query("from"), time.Now())
	to := parseDate(c.Query("to"), time.Now().AddDate(0, 1, 0))
	build, err := d.Reco.BuildCalendar(c.Param("id"), from, to)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, build)
}

// ----- events -----------------------------------------------------------

func (d *Deps) ListEvents(c *gin.Context) {
	from := parseDate(c.Query("from"), time.Now())
	to := parseDate(c.Query("to"), time.Now().AddDate(0, 3, 0))
	evs, err := d.Repo.ListEventsBetween(from, to)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"events": evs})
}

// ----- suggestion -------------------------------------------------------

func (d *Deps) GetSuggestion(c *gin.Context) {
	s, err := d.Repo.GetSuggestion(c.Param("id"))
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, s)
}

// CreateSuggestion persists a transient suggestion (one returned by GET
// /calendar but not yet saved). The FE calls this before requesting content
// generation, so every generation has a stable suggestion_id to attach to.
type createSuggestionReq struct {
	FarmerID   string             `json:"farmer_id" binding:"required"`
	Suggestion *models.Suggestion `json:"suggestion" binding:"required"`
}

func (d *Deps) CreateSuggestion(c *gin.Context) {
	var req createSuggestionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	req.Suggestion.FarmerID = req.FarmerID
	if req.Suggestion.Status == "" {
		req.Suggestion.Status = "proposed"
	}
	id, err := d.Repo.CreateSuggestion(req.Suggestion)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	req.Suggestion.ID = id
	c.JSON(201, req.Suggestion)
}

type generateReq struct {
	Channels []string `json:"channels"`
	Variant  int      `json:"variant"`
}

// GenerateContent fans out per-channel Gemini calls and persists results.
// It supports a *transient* suggestion in the request body — useful for the
// demo where we generate before the user even clicks "Add to plan."
func (d *Deps) GenerateContent(c *gin.Context) {
	id := c.Param("id")
	sug, err := d.Repo.GetSuggestion(id)
	if err != nil {
		c.JSON(404, gin.H{"error": err.Error()})
		return
	}
	farmer, err := d.Repo.GetFarmer(sug.FarmerID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	var req generateReq
	_ = c.BindJSON(&req)
	channels := req.Channels
	if len(channels) == 0 {
		channels = sug.Channels
	}
	chs := make([]models.Channel, 0, len(channels))
	for _, c := range channels {
		chs = append(chs, models.Channel(c))
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 90*time.Second)
	defer cancel()

	// re-fetch event + products as full objects for the prompt builder
	ev, _ := d.eventForSuggestion(sug)
	products := sug.Products
	if len(products) == 0 {
		products, _ = d.Repo.ListProductsByFarmer(sug.FarmerID)
	}

	// ── Cache pass: skip channels we already have a fresh generation for. ──
	// Re-opening an action sheet costs zero Gemini tokens if every channel
	// already has a content row at the requested variant and prompt version.
	existing, _ := d.Repo.ListGeneratedForSuggestion(sug.ID)
	have := make(map[string]models.GeneratedContent, len(existing))
	for _, gc := range existing {
		if gc.Variant != req.Variant {
			continue
		}
		if gc.PromptVersion != "" && gc.PromptVersion != ai.PromptVersion {
			continue
		}
		have[string(gc.Channel)] = gc
	}
	toGenerate := make([]models.Channel, 0, len(chs))
	persisted := make([]models.GeneratedContent, 0, len(chs))
	for _, ch := range chs {
		if cached, ok := have[string(ch)]; ok {
			persisted = append(persisted, cached)
		} else {
			toGenerate = append(toGenerate, ch)
		}
	}
	if len(toGenerate) == 0 {
		c.JSON(200, gin.H{"content": persisted, "cache_hits": len(persisted), "api_calls": 0})
		return
	}

	out, err := d.Content.GenerateAll(ctx, *farmer, *ev, products, toGenerate, req.Variant)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	for ch, body := range out {
		gc := &models.GeneratedContent{
			SuggestionID: sug.ID, Channel: ch, Variant: req.Variant,
			Body: body, Model: d.modelLabel(), PromptVersion: ai.PromptVersion,
		}
		if err := d.Repo.UpsertGenerated(gc); err == nil {
			persisted = append(persisted, *gc)
		}
	}
	c.JSON(200, gin.H{"content": persisted})
}

func (d *Deps) ListContent(c *gin.Context) {
	id := c.Param("id")
	list, err := d.Repo.ListGeneratedForSuggestion(id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"content": list})
}

// ----- plan -------------------------------------------------------------

func (d *Deps) GetPlan(c *gin.Context) {
	// ?board=<type> filters to a single board (campaign/seasonal/social/...).
	// Empty = all boards (the default for legacy dashboard consumers).
	board, err := d.Plan.Board(c.Param("id"), c.Query("board"))
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, board)
}

// Chat handles one turn of the grounded Q&A chat. The request body carries
// the message + optional prior transcript; the response is the assistant
// reply, deep-link action chips, and a list of tools that were invoked.
type chatReq struct {
	Message string         `json:"message" binding:"required"`
	History []chat.Message `json:"history"`
}

func (d *Deps) Chat(c *gin.Context) {
	var req chatReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	reply, err := d.ChatSvc.Answer(ctx, c.Param("id"), req.History, req.Message)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, reply)
}

// GetInsights returns 4-8 proactive intelligence cards for the farmer.
// All rules are deterministic; the response is stable for the same catalog.
func (d *Deps) GetInsights(c *gin.Context) {
	list, err := d.Insights.For(c.Param("id"))
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"insights": list})
}

type addCardReq struct {
	FarmerID   string             `json:"farmer_id"`
	Suggestion *models.Suggestion `json:"suggestion"`
	Column     string             `json:"column"`
	Note       string             `json:"note"`

	// Phase-3 rich-card fields — all optional. Callers (FE today, future
	// integrations tomorrow) can set any subset; defaults fill the rest.
	BoardType    string     `json:"board_type,omitempty"`
	Title        string     `json:"title,omitempty"`
	Description  string     `json:"description,omitempty"`
	Priority     string     `json:"priority,omitempty"`
	DueDate      *time.Time `json:"due_date,omitempty"`
	AudienceTags []string   `json:"audience_tags,omitempty"`
	Channels     []string   `json:"channels,omitempty"`
	Hashtags     []string   `json:"hashtags,omitempty"`
	CTA          string     `json:"cta,omitempty"`
}

func (d *Deps) AddPlanCard(c *gin.Context) {
	var req addCardReq
	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if req.Suggestion == nil || req.FarmerID == "" {
		c.JSON(400, gin.H{"error": "farmer_id and suggestion are required"})
		return
	}
	req.Suggestion.FarmerID = req.FarmerID
	card := &models.PlanCard{
		Column:       defaultS(req.Column, "planned"),
		Note:         req.Note,
		BoardType:    defaultS(req.BoardType, models.BoardCampaign),
		Title:        req.Title,
		Description:  req.Description,
		Priority:     defaultS(req.Priority, models.PriorityNormal),
		DueDate:      req.DueDate,
		AudienceTags: req.AudienceTags,
		Channels:     req.Channels,
		Hashtags:     req.Hashtags,
		CTA:          req.CTA,
	}
	created, err := d.Plan.AddCard(req.FarmerID, callerID(c), req.Suggestion, card)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, created)
}

type moveCardReq struct {
	CardID         string `json:"card_id"`
	FarmerID       string `json:"farmer_id"`
	SuggestionID   string `json:"suggestion_id"`
	Column         string `json:"column"`
	Position       int    `json:"position"`
	PreviousColumn string `json:"previous_column,omitempty"`
}

func (d *Deps) MovePlanCard(c *gin.Context) {
	var req moveCardReq
	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	err := d.Plan.Move(&models.PlanCard{
		ID: req.CardID, FarmerID: req.FarmerID, SuggestionID: req.SuggestionID,
		Column: req.Column, Position: req.Position,
	}, callerID(c), req.PreviousColumn)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// ----- helpers ----------------------------------------------------------

func (d *Deps) eventForSuggestion(sug *models.Suggestion) (*models.Event, error) {
	if sug.Event != nil {
		return sug.Event, nil
	}
	// re-load via events list (cheap; the KB is tiny)
	evs, err := d.Repo.ListEventsBetween(sug.DateWindowStart.AddDate(0, 0, -1), sug.DateWindowEnd.AddDate(0, 0, 1))
	if err != nil {
		return nil, err
	}
	for _, e := range evs {
		if e.ID == sug.EventID {
			ev := e
			return &ev, nil
		}
	}
	return &models.Event{Title: "Событие", Type: models.EventTrend}, nil
}

func parseDate(s string, def time.Time) time.Time {
	if s == "" {
		return def
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	return def
}

func defaultS(v, d string) string {
	if v == "" {
		return d
	}
	return v
}

// modelLabel returns the configured Gemini model name, falling back to a
// sensible default. Used as the audit `model` field on persisted content.
func (d *Deps) modelLabel() string {
	if d.GeminiModel != "" {
		return d.GeminiModel
	}
	return "gemini-2.5-flash"
}

// unused import guard (gin pinned)
var _ = http.StatusOK
