package main

import (
	"os"
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

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(middleware.Recovery(), middleware.RequestLogger())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	handlers.Register(r, &handlers.Deps{
		Repo: repo, Reco: reco, Content: contentSvc, Plan: planSvc,
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
