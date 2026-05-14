package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/auth"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/middleware"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ============================================================
//   /api/admin/users — list, create, update, delete
//   /api/admin/sessions — list, revoke
//
//   Every handler in this file is gated by RequireAdmin (chained at the
//   route group level). We re-verify role at the handler level too as a
//   belt-and-braces defense against accidental ungating in a future
//   refactor. The cost is one cheap context lookup.
// ============================================================

func (d *Deps) ListUsers(c *gin.Context) {
	if !ensureAdmin(c) {
		return
	}
	users, err := d.Repo.ListUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]models.UserPublic, len(users))
	for i := range users {
		out[i] = users[i].Public()
	}
	c.JSON(http.StatusOK, gin.H{"users": out})
}

func (d *Deps) CreateUser(c *gin.Context) {
	caller := middleware.UserFromContext(c)
	if caller == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if caller.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "code": "admin_required"})
		return
	}

	var req models.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "weak_password"})
		return
	}

	createdBy := caller.ID
	id, err := d.Repo.CreateUser(req.Username, hash, req.Role, req.DisplayName, &createdBy)
	if err != nil {
		if errors.Is(err, db.ErrUsernameExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "Username already exists", "code": "username_exists"})
			return
		}
		log.Error().Err(err).Msg("admin: create user failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	user, err := d.Repo.FindUserByID(id)
	if err != nil {
		// Created but couldn't fetch — return minimal payload rather than 500.
		c.JSON(http.StatusCreated, gin.H{"id": id})
		return
	}
	log.Info().
		Str("created_by", caller.ID).
		Str("new_user_id", id).
		Str("new_username", user.Username).
		Str("role", user.Role).
		Msg("admin: user created")
	c.JSON(http.StatusCreated, user.Public())
}

func (d *Deps) UpdateUser(c *gin.Context) {
	caller := middleware.UserFromContext(c)
	if caller == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if caller.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "code": "admin_required"})
		return
	}

	targetID := c.Param("id")
	if targetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing user id"})
		return
	}

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_body"})
		return
	}

	// Self-protection: admin cannot disable, demote, or change their own
	// role. Password change on self is allowed (it's a healthy operation).
	if targetID == caller.ID {
		if req.Disabled != nil && *req.Disabled {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "You cannot disable your own account",
				"code":  "cannot_self_modify",
			})
			return
		}
		if req.Role != nil && *req.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "You cannot demote yourself",
				"code":  "cannot_self_modify",
			})
			return
		}
	}

	patch := map[string]any{}
	revokeSessions := false

	if req.Password != nil {
		hash, err := auth.HashPassword(*req.Password)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "weak_password"})
			return
		}
		patch["password_hash"] = hash
		// Password change kicks all of the user's existing sessions so a
		// stolen credential is invalidated everywhere.
		revokeSessions = true
	}
	if req.Role != nil {
		patch["role"] = *req.Role
	}
	if req.DisplayName != nil {
		patch["display_name"] = *req.DisplayName
	}
	if req.Disabled != nil {
		patch["disabled"] = *req.Disabled
		if *req.Disabled {
			revokeSessions = true
		}
	}
	if len(patch) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
		return
	}

	user, err := d.Repo.UpdateUser(targetID, patch)
	if err != nil {
		if errors.Is(err, db.ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found", "code": "not_found"})
			return
		}
		log.Error().Err(err).Msg("admin: update user failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if revokeSessions {
		if err := d.Repo.RevokeUserSessions(targetID); err != nil {
			log.Warn().Err(err).Str("user_id", targetID).Msg("admin: cascade session revoke failed")
		}
	}

	log.Info().
		Str("admin_id", caller.ID).
		Str("target_id", targetID).
		Bool("revoked_sessions", revokeSessions).
		Msg("admin: user updated")
	c.JSON(http.StatusOK, user.Public())
}

func (d *Deps) DeleteUser(c *gin.Context) {
	caller := middleware.UserFromContext(c)
	if caller == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if caller.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "code": "admin_required"})
		return
	}

	targetID := c.Param("id")
	if targetID == caller.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "You cannot delete your own account",
			"code":  "cannot_self_delete",
		})
		return
	}

	if err := d.Repo.DeleteUser(targetID); err != nil {
		log.Error().Err(err).Msg("admin: delete user failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	log.Info().Str("admin_id", caller.ID).Str("target_id", targetID).Msg("admin: user deleted")
	c.Status(http.StatusNoContent)
}

// ============================================================
//   sessions
// ============================================================

func (d *Deps) ListSessions(c *gin.Context) {
	if !ensureAdmin(c) {
		return
	}
	userID := c.Query("user_id")
	sessions, err := d.Repo.ListActiveSessions(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func (d *Deps) RevokeSession(c *gin.Context) {
	if !ensureAdmin(c) {
		return
	}
	id := c.Param("id")
	if err := d.Repo.RevokeSession(id); err != nil {
		log.Error().Err(err).Msg("admin: revoke session failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ensureAdmin is a tiny defense-in-depth check that re-verifies the caller's
// role at the handler level. The middleware already gates these routes, so
// this is belt-and-braces (cheap context map lookup).
func ensureAdmin(c *gin.Context) bool {
	caller := middleware.UserFromContext(c)
	if caller == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return false
	}
	if caller.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden", "code": "admin_required"})
		return false
	}
	return true
}
