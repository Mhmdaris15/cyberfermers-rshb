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

// seed wires the entire knowledge graph from YAML files:
//   1. events       (calendar holidays / seasons / themed weeks)
//   2. audiences    (buyer personas)
//   3. trends       (+ RELATE trend -> influences -> event)
//   4. seasonal     (+ RELATE seasonal_window -> covers -> event)
//
// Idempotent. Run after `import` (which populates farmers + products).
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
	repo := db.NewRepo(dbc)

	// 1. events
	loadedEvents, err := events.LoadFromYAML(cfg.EventsYAMLPath)
	if err != nil {
		log.Fatal().Err(err).Msg("events yaml")
	}
	eventIDBySlug := map[string]string{}
	for i := range loadedEvents {
		ev := &loadedEvents[i]
		id, err := repo.UpsertEvent(ev)
		if err != nil {
			log.Warn().Err(err).Str("slug", ev.Slug).Msg("upsert event")
			continue
		}
		eventIDBySlug[ev.Slug] = id
	}
	log.Info().Int("events", len(loadedEvents)).Msg("events seeded")

	// 2. audiences
	if auds, err := events.LoadAudiences(cfg.AudiencesYAMLPath); err == nil {
		for i := range auds {
			if _, err := repo.UpsertAudience(&auds[i]); err != nil {
				log.Warn().Err(err).Str("slug", auds[i].Slug).Msg("upsert audience")
			}
		}
		log.Info().Int("audiences", len(auds)).Msg("audiences seeded")
	} else {
		log.Warn().Err(err).Msg("audiences yaml — skipped")
	}

	// 3. trends + influences edges
	if trends, err := events.LoadTrends(cfg.TrendsYAMLPath); err == nil {
		linked := 0
		for _, t := range trends {
			id, err := repo.UpsertTrend(&t.Trend)
			if err != nil {
				log.Warn().Err(err).Str("slug", t.Trend.Slug).Msg("upsert trend")
				continue
			}
			for _, infl := range t.Influences {
				eventID, ok := eventIDBySlug[infl.Event]
				if !ok {
					continue
				}
				if err := repo.RelateInfluences(id, eventID, infl.Strength); err != nil {
					log.Warn().Err(err).Str("from", t.Trend.Slug).Str("to", infl.Event).Msg("influences edge")
					continue
				}
				linked++
			}
		}
		log.Info().Int("trends", len(trends)).Int("influences_edges", linked).Msg("trends seeded")
	} else {
		log.Warn().Err(err).Msg("trends yaml — skipped")
	}

	// 4. seasonal_windows + covers edges
	if wins, err := events.LoadSeasonalWindows(cfg.SeasonalWindowsYAMLPath); err == nil {
		linked := 0
		for _, w := range wins {
			id, err := repo.UpsertSeasonalWindow(&w.Window)
			if err != nil {
				log.Warn().Err(err).Str("concept", w.Window.ProductConcept).Msg("upsert window")
				continue
			}
			for _, slug := range w.Covers {
				eventID, ok := eventIDBySlug[slug]
				if !ok {
					continue
				}
				if err := repo.RelateCovers(id, eventID); err != nil {
					log.Warn().Err(err).Str("window", w.Window.Label).Str("event", slug).Msg("covers edge")
					continue
				}
				linked++
			}
		}
		log.Info().Int("seasonal_windows", len(wins)).Int("covers_edges", linked).Msg("seasonal windows seeded")
	} else {
		log.Warn().Err(err).Msg("seasonal yaml — skipped")
	}

	log.Info().Msg("seed done")
}
