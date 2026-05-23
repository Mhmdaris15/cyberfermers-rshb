package main

import (
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/auth"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/config"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/handlers"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/middleware"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/ai"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/chat"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/insights"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/plan"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/recommendation"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/tagging"
)

func main() {
	cfg := config.Load()

	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339}).
		Level(zerologLevel(cfg.LogLevel))

	dbc, err := db.New(cfg.SurrealURL, cfg.SurrealUser, cfg.SurrealPass, cfg.SurrealNS, cfg.SurrealDB)
	if err != nil {
		log.Fatal().Err(err).Msg("surreal connect")
	}
	defer dbc.Close()

	if err := dbc.EnsureSchema(cfg.SchemaPath); err != nil {
		// Log loudly but DO NOT exit. If a single DEFINE statement has bad
		// syntax for this Surreal version, every statement after it silently
		// doesn't apply. Killing the process here would leave the deployed
		// stack in a crash-loop with no way to diagnose. Better: stay up,
		// log the exact error, and let /health respond so callers can see
		// the container is alive even if features are degraded.
		log.Error().Err(err).Msg("schema apply FAILED — some tables/fields may be missing; the API will stay up so /health responds and the error is visible")
	}

	repo := db.NewRepo(dbc)

	// Bootstrap first admin from env vars when the DB has no admin yet.
	// On every subsequent boot this is a no-op (HasActiveAdmin gates it).
	//
	// Failure is NON-FATAL by design: a broken bootstrap (e.g. app_user
	// table missing because schema apply errored earlier) used to crash
	// the container, putting it in a restart loop that hid the underlying
	// schema problem under a CORS-headers-missing symptom in the browser.
	// We now log the error loudly and continue so /health responds and the
	// failure mode is debuggable.
	switch res, err := auth.EnsureFirstAdmin(repo, cfg.AdminUsername, cfg.AdminPassword); {
	case err != nil:
		log.Error().Err(err).Msg("auth bootstrap failed — login will not work until the underlying error is fixed, but the API will stay up so the failure is diagnosable")
	case res == auth.BootstrapCreated:
		log.Info().Str("username", strings.ToLower(strings.TrimSpace(cfg.AdminUsername))).
			Msg("bootstrapped first admin from env")
	default:
		log.Info().Msg("auth: admin already exists, env-bootstrap skipped")
	}

	// Periodic cleanup of expired and old-revoked sessions. 1h tick is
	// plenty — the hot path filters by expires_at anyway, so stale rows
	// only matter for table size.
	go func() {
		t := time.NewTicker(1 * time.Hour)
		defer t.Stop()
		for range t.C {
			if err := repo.CleanupExpiredSessions(); err != nil {
				log.Warn().Err(err).Msg("session cleanup failed")
			}
		}
	}()

	// Push dispatcher (phase-8). Ticks every 30s and atomically flips
	// queued pushes whose scheduled_for has passed to status=sent.
	// In Phase 8 MVP this SIMULATES sending — log a line per dispatch
	// and trust the operator to confirm via the FE. A real APN/FCM
	// integration would replace the log call with a provider HTTP call
	// and conditionalise the body.dispatch mutation on its success.
	go func() {
		t := time.NewTicker(30 * time.Second)
		defer t.Stop()
		for range t.C {
			sent, err := repo.DispatchDuePushes()
			if err != nil {
				log.Warn().Err(err).Msg("push dispatch failed")
				continue
			}
			for _, p := range sent {
				log.Info().
					Str("push_id", p.ID).
					Str("farmer_id", p.FarmerID).
					Str("headline", p.Headline).
					Msg("push: dispatched (simulated)")
			}
		}
	}()

	aiClient := ai.NewClient(cfg.GeminiKey, cfg.GeminiModel, cfg.GeminiEmbed)
	contentSvc := ai.NewContentService(aiClient)
	reco := recommendation.New(repo)
	planSvc := plan.New(repo)
	insightsEngine := insights.New(repo)
	chatSvc := chat.New(repo, aiClient, insightsEngine, planSvc)
	tagger := tagging.New(repo, aiClient, false)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(middleware.Recovery(), middleware.RequestLogger())

	// CORS — `cfg.CORSOrigins` has already been normalized (lowercased, trimmed,
	// quotes stripped, trailing slashes removed). We use AllowOriginFunc instead
	// of AllowOrigins so we can apply the same normalization to the incoming
	// browser Origin header before comparing — exact-match on raw strings is
	// far too easy to break with a stray space or scheme casing.
	log.Info().Strs("cors_allowlist", cfg.CORSOrigins).Msg("cors configured")
	if len(cfg.CORSOrigins) == 0 {
		log.Warn().Msg("API_CORS_ORIGINS is empty — every browser request will be rejected")
	}
	// Maintenance gate runs AFTER CORS is set up (so 503s carry the
	// Access-Control-Allow-Origin header — without it the browser can't
	// read the response body and the FE has no way to detect the gate).
	// It runs BEFORE handlers so EVERY request hits it, including ones
	// later mounted under /api.
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			norm := strings.ToLower(strings.TrimRight(strings.TrimSpace(origin), "/"))
			for _, a := range cfg.CORSOrigins {
				if a == norm {
					return true
				}
			}
			log.Debug().Str("origin", origin).Msg("cors: origin rejected")
			return false
		},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		// X-UI-Language + Accept-Language are sent by the FE axios client
		// for every request (Tolgee i18n integration). They MUST be in the
		// allow-list — otherwise the browser blocks the real request after
		// a 204 preflight ("blocked by CORS policy: request header field
		// x-ui-language is not allowed"). The bug surfaces as a login that
		// silently fails right after the user switches language.
		AllowHeaders: []string{
			"Origin", "Content-Type", "Authorization", "Accept",
			"X-Requested-With", "X-UI-Language", "Accept-Language",
		},
		ExposeHeaders:    []string{"Content-Length", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Maintenance gate — must run AFTER CORS so 503 responses carry the
	// allow-origin header (otherwise the browser can't read the body and
	// the FE can't switch to the maintenance screen).
	r.Use(middleware.Maintenance(repo))

	handlers.Register(r, &handlers.Deps{
		Repo: repo, Reco: reco, Content: contentSvc, Plan: planSvc,
		Insights:           insightsEngine,
		ChatSvc:            chatSvc,
		Tagger:             tagger,
		GeminiModel:        cfg.GeminiModel,
		SessionTTL:         time.Duration(cfg.AuthSessionTTLHours) * time.Hour,
		LoginRateLimit:     cfg.AuthLoginRateLimit,
		LoginRateWindowMin: cfg.AuthLoginRateWindowMin,
	})

	addr := ":" + cfg.APIPort
	log.Info().Str("addr", addr).Msg("api listening")
	if err := r.Run(addr); err != nil {
		log.Fatal().Err(err).Msg("server")
	}
}

func zerologLevel(s string) zerolog.Level {
	switch s {
	case "debug":
		return zerolog.DebugLevel
	case "warn":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	default:
		return zerolog.InfoLevel
	}
}
