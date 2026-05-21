package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// =====================================================================
//   Product-tag CRUD + AI-assisted suggestions.
//
//   Routes (mounted under /api/farmers/:id by Register):
//
//     POST   /products/:productId/tags           — add a user tag
//     DELETE /products/:productId/tags/:tag       — remove any tag
//     POST   /products/:productId/tags/suggest    — LLM+rule suggestions
//                                                   (no persistence)
//     POST   /products/tags/auto-tag-missing      — bulk: tag products
//                                                   with <3 existing tags
//     GET    /products/tags/vocabulary            — distinct corpus tags,
//                                                   for autocomplete
//
//   :id is the farmer organization_id (resolved via Repo.ResolveFarmer);
//   :productId is the bare SurrealDB id (no `product:` prefix).
// =====================================================================

// ------ payloads --------------------------------------------------------

type addTagReq struct {
	Tag string `json:"tag" binding:"required"`
}

type addTagsBatchReq struct {
	Tags []string `json:"tags" binding:"required"`
}

// AddProductTag persists one user-authored tag. Source is forced to
// "user" with confidence 1.0 — the farmer's domain knowledge outranks
// the model's guess in the recommender.
func (d *Deps) AddProductTag(c *gin.Context) {
	var req addTagReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tag := normaliseTag(req.Tag)
	if tag == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tag must be non-empty"})
		return
	}
	if err := d.Repo.UpsertTag(c.Param("productId"), tag, "user", 1.0); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tags, _ := d.Repo.ListTagsForProduct(c.Param("productId"))
	c.JSON(http.StatusOK, gin.H{"tags": tags})
}

// AddProductTagsBatch accepts an array of tags in a single request —
// used when the user accepts multiple suggestion chips at once from the
// LLM-suggestion modal. Saves N round-trips vs calling AddProductTag in
// a loop.
func (d *Deps) AddProductTagsBatch(c *gin.Context) {
	var req addTagsBatchReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	productID := c.Param("productId")
	added := 0
	for _, raw := range req.Tags {
		tag := normaliseTag(raw)
		if tag == "" {
			continue
		}
		if err := d.Repo.UpsertTag(productID, tag, "user", 1.0); err == nil {
			added++
		}
	}
	tags, _ := d.Repo.ListTagsForProduct(productID)
	c.JSON(http.StatusOK, gin.H{"tags": tags, "added": added})
}

// RemoveProductTag deletes a tag regardless of source. The FE × button
// flows here. We do not soft-delete — provenance lives elsewhere
// (ai_memory rows on the recommendation side persist independently).
func (d *Deps) RemoveProductTag(c *gin.Context) {
	tag := normaliseTag(c.Param("tag"))
	if tag == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tag required"})
		return
	}
	if err := d.Repo.DeleteTag(c.Param("productId"), tag); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	tags, _ := d.Repo.ListTagsForProduct(c.Param("productId"))
	c.JSON(http.StatusOK, gin.H{"tags": tags})
}

// SuggestProductTags returns rule + LLM tag candidates WITHOUT applying
// them. The FE shows the chips and lets the user pick which to accept.
// This is the suggest-then-approve flow — explicit human-in-the-loop
// so the LLM never auto-canonicalises a tag the farmer disagrees with.
func (d *Deps) SuggestProductTags(c *gin.Context) {
	if d.Tagger == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "tagger not configured"})
		return
	}
	productID := c.Param("productId")
	prod, err := d.Repo.GetProduct(productID)
	if err != nil || prod == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 45*time.Second)
	defer cancel()
	suggestions, err := d.Tagger.SuggestForProduct(ctx, *prod)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"suggestions": suggestions, "count": len(suggestions)})
}

// AutoTagMissing runs the canonical rule→LLM pipeline against every
// product belonging to this farmer that currently has fewer than 3
// tags. Persists results directly (this is a power-user action, no
// approval per-product). Returns counts so the FE shows a meaningful
// toast: "Tagged 36 products, 84 new tags added".
func (d *Deps) AutoTagMissing(c *gin.Context) {
	if d.Tagger == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "tagger not configured"})
		return
	}
	farmerID := c.Param("id")
	products, err := d.Repo.ListProductsByFarmer(farmerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Generous timeout — Gemini calls can stack up. 6m matches the
	// reverse-proxy idle limit on Coolify's default Traefik config.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Minute)
	defer cancel()
	res, err := d.Tagger.AutoTagMissing(ctx, products, 3)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

// GetTagVocabulary returns every distinct tag currently in the corpus,
// sorted. Used by the FE chip-editor's autocomplete so a farmer typing
// "мё" sees "мёд, медовый, медовик" suggestions. Cheap query — there
// are ≈80 canonical tags + whatever the LLM has generated.
func (d *Deps) GetTagVocabulary(c *gin.Context) {
	tags, err := d.Repo.ListAllTags()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"tags": tags, "count": len(tags)})
}

// ------ helpers ---------------------------------------------------------

// normaliseTag lowercases + trims + collapses whitespace. Tags are
// case-insensitive in the DB, so this prevents `мёд` / `Мёд` / `мёд `
// from creating three separate rows.
func normaliseTag(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	// collapse internal whitespace runs
	parts := strings.Fields(s)
	return strings.Join(parts, " ")
}

// Compile-time stub so the models import doesn't drop on partial builds.
var _ = models.Product{}
