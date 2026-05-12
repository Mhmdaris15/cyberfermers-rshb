package main

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/config"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/catalog"
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
		log.Warn().Err(err).Msg("schema (non-fatal)")
	}

	imp := catalog.NewImporter(db.NewRepo(dbc))
	farmers, products, err := imp.ImportXLSX(cfg.XLSXPath)
	if err != nil {
		log.Fatal().Err(err).Msg("import failed")
	}
	log.Info().Int("farmers", farmers).Int("products", products).Msg("import done")
}
