package main

import (
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/config"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/handlers"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/middleware"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/ai"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/chat"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/insights"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/plan"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/recommendation"
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
		log.Warn().Err(err).Msg("schema apply non-fatal")
	}

	repo := db.NewRepo(dbc)
	aiClient := ai.NewClient(cfg.GeminiKey, cfg.GeminiModel, cfg.GeminiEmbed)
	contentSvc := ai.NewContentService(aiClient)
	reco := recommendation.New(repo)
	planSvc := plan.New(repo)
	insightsEngine := insights.New(repo)
	chatSvc := chat.New(repo, aiClient, insightsEngine)

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
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	handlers.Register(r, &handlers.Deps{
		Repo: repo, Reco: reco, Content: contentSvc, Plan: planSvc,
		Insights:    insightsEngine,
		ChatSvc:     chatSvc,
		GeminiModel: cfg.GeminiModel,
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
