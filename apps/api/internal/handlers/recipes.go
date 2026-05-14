package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   /api/farmers/:id/recipes — list + create
//   /api/recipes/:id          — alias of /api/content/:id
//
//   Recipes follow the Stories/Blogs template (Phases 4-5): structured
//   body shape is opaque to this handler — we pass it through verbatim
//   so the FE editor can evolve the shape (add `notes`, `nutrition`,
//   `ingredients[*].product_id`, ...) without schema or handler changes.
// ============================================================

func (d *Deps) ListFarmerRecipes(c *gin.Context) {
	recipes, err := d.Repo.ListFarmerRecipes(c.Param("id"), c.Query("status"))
	if err != nil {
		log.Error().Err(err).Msg("recipes: list failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"recipes": recipes})
}

// createRecipeReq is intentionally loose — the body is a structured JSON
// document whose schema lives on the FE. Required: `title` for cataloging.
// Everything else (ingredients, steps, nutrition, etc.) is opaque and
// gets stored as-is in generated_content.body (FLEXIBLE TYPE object).
type createRecipeReq struct {
	Title           string         `json:"title" binding:"required,min=1,max=200"`
	Lede            string         `json:"lede,omitempty"`
	CoverImageURL   string         `json:"cover_image_url,omitempty"`
	Servings        int            `json:"servings,omitempty"`
	PrepTimeMin     int            `json:"prep_time_min,omitempty"`
	CookTimeMin     int            `json:"cook_time_min,omitempty"`
	Difficulty      string         `json:"difficulty,omitempty"`
	Ingredients     []any          `json:"ingredients,omitempty"`
	Steps           []any          `json:"steps,omitempty"`
	Nutrition       map[string]any `json:"nutrition,omitempty"`
	AudienceTags    []string       `json:"audience_tags,omitempty"`
	Hashtags        []string       `json:"hashtags,omitempty"`
	Notes           string         `json:"notes,omitempty"`
	CreatePlanCard  *bool          `json:"create_plan_card,omitempty"`
}

type createRecipeResp struct {
	Recipe     *models.GeneratedContent `json:"recipe"`
	PlanCardID string                   `json:"plan_card_id,omitempty"`
}

func (d *Deps) CreateFarmerRecipe(c *gin.Context) {
	farmerID := c.Param("id")
	if farmerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing farmer id"})
		return
	}

	var req createRecipeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}

	eventID, err := d.Repo.EnsureFreeformRecipesEvent()
	if err != nil {
		log.Error().Err(err).Msg("recipes: event bootstrap failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	sugID, err := d.Repo.EnsureRecipesSuggestion(farmerID, eventID)
	if err != nil {
		log.Error().Err(err).Msg("recipes: suggestion bootstrap failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	body := map[string]any{
		"title":            req.Title,
		"lede":             req.Lede,
		"cover_image_url":  req.CoverImageURL,
		"servings":         req.Servings,
		"prep_time_min":    req.PrepTimeMin,
		"cook_time_min":    req.CookTimeMin,
		"difficulty":       req.Difficulty,
		"ingredients":      defaultAnySlice(req.Ingredients),
		"steps":            defaultAnySlice(req.Steps),
		"nutrition":        req.Nutrition,
		"audience_tags":    defaultStringSlice(req.AudienceTags),
		"hashtags":         defaultStringSlice(req.Hashtags),
		"notes":            req.Notes,
	}
	recipeID, err := d.Repo.CreateUserRecipe(sugID, body, callerID(c))
	if err != nil {
		log.Error().Err(err).Msg("recipes: content create failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	recipe, _ := d.Repo.GetContent(recipeID)
	resp := createRecipeResp{Recipe: recipe}

	want := true
	if req.CreatePlanCard != nil {
		want = *req.CreatePlanCard
	}
	if want && recipe != nil {
		card := &models.PlanCard{
			Column:       "proposed",
			BoardType:    models.BoardStorytelling,
			Priority:     models.PriorityNormal,
			Title:        req.Title,
			Description:  truncate(firstNonEmptyStr(req.Lede, req.Notes), 220),
			Hashtags:     req.Hashtags,
			AudienceTags: req.AudienceTags,
			Channels:     []string{string(models.ChRecipe)},
			DueDate:      ptrTime(time.Now().AddDate(0, 0, 10)),
		}
		sug := &models.Suggestion{ID: sugID, FarmerID: farmerID, Status: "proposed"}
		if created, err := d.Plan.AddCard(farmerID, callerID(c), sug, card); err == nil {
			resp.PlanCardID = created.ID
		} else {
			log.Warn().Err(err).Msg("recipes: plan card create failed (non-fatal)")
		}
	}

	c.JSON(http.StatusCreated, resp)
}

// GetRecipe is a thin alias that returns a single generated_content row.
func (d *Deps) GetRecipe(c *gin.Context) {
	d.GetContent(c)
}

func defaultAnySlice(s []any) []any {
	if s == nil {
		return []any{}
	}
	return s
}
