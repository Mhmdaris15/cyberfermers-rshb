package main

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/config"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/events"
)

func main() {
	cfg := config.Load()
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	dbc, err := db.New(cfg.SurrealURL, cfg.SurrealUser, cfg.SurrealPass, cfg.SurrealNS, cfg.SurrealDB)
	if err != nil {
		log.Fatal().Err(err).Msg("surreal connect")
	}
	defer dbc.Close()
	if err := dbc.EnsureSchema(cfg.SchemaPath); err != nil {
		log.Warn().Err(err).Msg("schema")
	}

	loaded, err := events.LoadFromYAML(cfg.EventsYAMLPath)
	if err != nil {
		log.Fatal().Err(err).Msg("events yaml")
	}
	repo := db.NewRepo(dbc)
	for _, e := range loaded {
		if _, err := repo.UpsertEvent(&e); err != nil {
			log.Warn().Err(err).Str("slug", e.Slug).Msg("upsert event")
		}
	}
	log.Info().Int("events", len(loaded)).Msg("seeded")
}
