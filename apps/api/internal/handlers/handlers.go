package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
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
}

func Register(r *gin.Engine, d *Deps) {
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	api := r.Group("/api")
	{
		api.GET("/farmers", d.ListFarmers)
		api.GET("/farmers/:id", d.GetFarmer)
		api.GET("/farmers/:id/products", d.GetFarmerProducts)
		api.GET("/farmers/:id/calendar", d.GetCalendar)
		api.GET("/farmers/:id/plan", d.GetPlan)
		api.GET("/farmers/:id/insights", d.GetInsights)
		api.POST("/farmers/:id/chat", d.Chat)

		api.GET("/events", d.ListEvents)
		api.POST("/suggestions", d.CreateSuggestion)
		api.GET("/suggestions/:id", d.GetSuggestion)
		api.POST("/suggestions/:id/generate", d.GenerateContent)
		api.GET("/suggestions/:id/content", d.ListContent)
		api.POST("/plan/cards", d.AddPlanCard)
		api.POST("/plan/cards/move", d.MovePlanCard)
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

	out, err := d.Content.GenerateAll(ctx, *farmer, *ev, products, chs, req.Variant)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	persisted := make([]models.GeneratedContent, 0, len(out))
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
	board, err := d.Plan.Board(c.Param("id"))
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
	card, err := d.Plan.AddCard(req.FarmerID, req.Suggestion, defaultS(req.Column, "planned"), req.Note)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(201, card)
}

type moveCardReq struct {
	CardID   string `json:"card_id"`
	FarmerID string `json:"farmer_id"`
	SuggestionID string `json:"suggestion_id"`
	Column   string `json:"column"`
	Position int    `json:"position"`
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
	})
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
