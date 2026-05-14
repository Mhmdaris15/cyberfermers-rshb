package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/middleware"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   /api/content/:id          — GET (fetch), PATCH (edit)
//   /api/content/:id/publish     — POST
//   /api/content/:id/archive     — POST
//   /api/content/:id/unarchive   — POST
//   /api/content/:id/revisions   — GET
//   /api/content/:id/revisions/:n/restore — POST
//
//   Phase-2 lifecycle endpoints. All require an authenticated user;
//   editing a piece of content is a normal-user operation, not an
//   admin one. Multi-tenant ownership (only the owning farmer's team
//   can edit) is a separate phase — for now, any authed user can edit.
// ============================================================

// ─── fetch ─────────────────────────────────────────────────────────────

func (d *Deps) GetContent(c *gin.Context) {
	id := c.Param("id")
	gc, err := d.Repo.GetContent(id)
	if err != nil {
		if errors.Is(err, db.ErrContentNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "content not found", "code": "not_found"})
			return
		}
		log.Error().Err(err).Msg("content: fetch failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gc)
}

// ─── edit ──────────────────────────────────────────────────────────────

type updateContentReq struct {
	// Body is the new channel-shaped content body. Must be non-empty.
	// We accept arbitrary JSON because per-channel shapes differ
	// (push.title, social.hashtags, recipe.ingredients, ...).
	Body map[string]any `json:"body" binding:"required"`
	// Optional short label surfaced in the history dropdown (e.g.
	// "правка тона", "ужал текст до 140 знаков"). Defaults to "ручная правка".
	Note string `json:"note"`
}

func (d *Deps) UpdateContent(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing id"})
		return
	}
	var req updateContentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}
	if len(req.Body) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "body cannot be empty", "code": "empty_body"})
		return
	}
	note := req.Note
	if note == "" {
		note = "ручная правка"
	}
	uid := callerID(c)

	gc, err := d.Repo.UpdateContentBody(id, req.Body, note, uid)
	if err != nil {
		if errors.Is(err, db.ErrContentNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "content not found", "code": "not_found"})
			return
		}
		log.Error().Err(err).Msg("content: update failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gc)
}

// ─── lifecycle transitions ─────────────────────────────────────────────

func (d *Deps) PublishContent(c *gin.Context) { d.transition(c, models.ContentStatusPublished) }
func (d *Deps) ArchiveContent(c *gin.Context) { d.transition(c, models.ContentStatusArchived) }
func (d *Deps) UnarchiveContent(c *gin.Context) {
	// Unarchive moves to draft, not back-to-published. A previously
	// published item that was archived must be re-published explicitly
	// — too easy to mis-click "archive" otherwise.
	d.transition(c, models.ContentStatusDraft)
}

func (d *Deps) transition(c *gin.Context, target string) {
	id := c.Param("id")
	gc, err := d.Repo.TransitionContent(id, target)
	if err != nil {
		if errors.Is(err, db.ErrContentNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "content not found", "code": "not_found"})
			return
		}
		log.Error().Err(err).Str("target", target).Msg("content: transition failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gc)
}

// ─── revisions ────────────────────────────────────────────────────────

func (d *Deps) ListContentRevisions(c *gin.Context) {
	id := c.Param("id")
	revs, err := d.Repo.ListContentRevisions(id)
	if err != nil {
		log.Error().Err(err).Msg("content: list revisions failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"revisions": revs})
}

type restoreReq struct {
	Note string `json:"note"`
}

func (d *Deps) RestoreContentRevision(c *gin.Context) {
	id := c.Param("id")
	n, err := strconv.Atoi(c.Param("n"))
	if err != nil || n <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid revision number"})
		return
	}
	var req restoreReq
	_ = c.ShouldBindJSON(&req) // body is optional

	gc, err := d.Repo.RestoreContentRevision(id, n, req.Note, callerID(c))
	if err != nil {
		switch {
		case errors.Is(err, db.ErrContentNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "content not found", "code": "not_found"})
		case errors.Is(err, db.ErrRevisionNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "revision not found", "code": "revision_not_found"})
		default:
			log.Error().Err(err).Msg("content: restore failed")
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, gc)
}

// callerID returns the bare app_user record id of the authenticated
// caller (used as the `author` field on user-authored revisions).
// Empty string if no user is on the context (defense-in-depth — the
// auth middleware should have populated it).
func callerID(c *gin.Context) string {
	u := middleware.UserFromContext(c)
	if u == nil {
		return ""
	}
	return u.ID
}
