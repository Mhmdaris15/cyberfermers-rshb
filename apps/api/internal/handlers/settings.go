package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/middleware"
)

// =====================================================================
//   Settings page endpoints.
//
//     PATCH /api/farmers/:id                — partial farmer update
//                                              (profile + channels +
//                                               brand voice)
//     POST  /api/auth/change-password        — self-service password
//                                              change with current-
//                                              password verification
//     POST  /api/auth/sessions/revoke-others — kick every other session
//                                              for the current user;
//                                              the calling session
//                                              stays logged in
//
//   None of these endpoints touch ai_memory or generated content —
//   they are profile-scoped only.
// =====================================================================

// allowedBrandVoices mirrors prompts.go::brandVoicePresets — kept here
// so the handler can reject unknown values without an import cycle on
// the ai package. Update both lists when adding a new voice.
var allowedBrandVoices = map[string]bool{
	"":         true, // empty = unset, valid
	"warm":     true,
	"business": true,
	"folksy":   true,
	"sharp":    true,
	"expert":   true,
}

// allowedRisk — fixed set of valid risk-appetite values. Mirrors
// recommendation.PromoSuggest which reads this field.
var allowedRisk = map[string]bool{
	"conservative": true,
	"balanced":     true,
	"aggressive":   true,
}

// updateFarmerReq is the wire shape for the partial PATCH. Every field
// is a pointer so we can distinguish "not sent" from "sent as empty".
// Empty string / empty slice = explicit clear.
type updateFarmerReq struct {
	ShopName        *string   `json:"shop_name,omitempty"`
	Description     *string   `json:"description,omitempty"`
	Region          *string   `json:"region,omitempty"`
	URL             *string   `json:"url,omitempty"`
	Channels        *[]string `json:"channels,omitempty"`
	AudienceFocus   *[]string `json:"audience_focus,omitempty"`
	RiskAppetite    *string   `json:"risk_appetite,omitempty"`
	BrandVoice      *string   `json:"brand_voice,omitempty"`
	SignaturePhrase *string   `json:"signature_phrase,omitempty"`
	ForbiddenWords  *[]string `json:"forbidden_words,omitempty"`
	DefaultCTA      *string   `json:"default_cta,omitempty"`
}

// UpdateFarmer applies a partial patch from the Settings page. Validates
// brand_voice and risk_appetite against the canonical sets; everything
// else is trimmed and forwarded as-is. The repo handles MERGE so only
// supplied fields are touched.
func (d *Deps) UpdateFarmer(c *gin.Context) {
	var req updateFarmerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	patch := map[string]any{}
	if req.ShopName != nil {
		v := strings.TrimSpace(*req.ShopName)
		if v == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "shop_name cannot be empty"})
			return
		}
		patch["shop_name"] = v
	}
	if req.Description != nil {
		patch["description"] = strings.TrimSpace(*req.Description)
	}
	if req.Region != nil {
		v := strings.TrimSpace(*req.Region)
		if v == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "region cannot be empty"})
			return
		}
		patch["region"] = v
	}
	if req.URL != nil {
		patch["url"] = strings.TrimSpace(*req.URL)
	}
	if req.Channels != nil {
		patch["channels"] = cleanStringSlice(*req.Channels)
	}
	if req.AudienceFocus != nil {
		patch["audience_focus"] = cleanStringSlice(*req.AudienceFocus)
	}
	if req.RiskAppetite != nil {
		v := strings.TrimSpace(*req.RiskAppetite)
		if !allowedRisk[v] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "risk_appetite must be conservative|balanced|aggressive"})
			return
		}
		patch["risk_appetite"] = v
	}
	if req.BrandVoice != nil {
		v := strings.ToLower(strings.TrimSpace(*req.BrandVoice))
		if !allowedBrandVoices[v] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "brand_voice must be one of: warm, business, folksy, sharp, expert"})
			return
		}
		patch["brand_voice"] = v
	}
	if req.SignaturePhrase != nil {
		v := strings.TrimSpace(*req.SignaturePhrase)
		if len(v) > 200 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "signature_phrase ≤200 chars"})
			return
		}
		patch["signature_phrase"] = v
	}
	if req.DefaultCTA != nil {
		v := strings.TrimSpace(*req.DefaultCTA)
		if len(v) > 120 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "default_cta ≤120 chars"})
			return
		}
		patch["default_cta"] = v
	}
	if req.ForbiddenWords != nil {
		patch["forbidden_words"] = cleanStringSlice(*req.ForbiddenWords)
	}

	farmer, err := d.Repo.UpdateFarmer(c.Param("id"), patch)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, farmer)
}

// ------ password change ------------------------------------------------

type changePasswordReq struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required"`
}

// ChangePassword verifies the current password then writes a fresh
// bcrypt hash. We do NOT revoke other sessions automatically — that's
// a separate explicit action on the Settings page. Rationale: a farmer
// changing their password on their phone shouldn't get logged out of
// their laptop without warning; if they're worried about a breach,
// they hit the "sign out everywhere" button alongside.
func (d *Deps) ChangePassword(c *gin.Context) {
	caller := middleware.UserFromContext(c)
	if caller == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}
	var req changePasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.NewPassword) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "new password must be ≥8 characters"})
		return
	}
	if req.NewPassword == req.CurrentPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "new password must differ from the current one"})
		return
	}

	user, err := d.Repo.FindUserByID(caller.ID)
	if err != nil || user == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "user lookup failed"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "hash failed"})
		return
	}
	if err := d.Repo.UpdateUserPassword(user.ID, string(hash)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// RevokeOtherSessions kicks every session of the current user EXCEPT
// the one making this request. Use case: farmer logged in on a public
// machine, came home, wants to flush that session without logging
// themselves out of their phone.
func (d *Deps) RevokeOtherSessions(c *gin.Context) {
	caller := middleware.UserFromContext(c)
	if caller == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthenticated"})
		return
	}
	keepID := middleware.SessionIDFromContext(c)
	if err := d.Repo.RevokeOtherUserSessions(caller.ID, keepID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "kept_session_id": keepID})
}

// ------ helpers --------------------------------------------------------

// cleanStringSlice trims, lowercases (only for tag-ish fields that
// callers normalise — we leave casing as-is here), and drops empty
// entries. Used for channels, audience, forbidden words.
func cleanStringSlice(in []string) []string {
	out := make([]string, 0, len(in))
	seen := map[string]bool{}
	for _, raw := range in {
		v := strings.TrimSpace(raw)
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}
