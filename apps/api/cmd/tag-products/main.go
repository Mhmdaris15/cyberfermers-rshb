package main

import (
	"context"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/config"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/ai"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/tagging"
)

// tag-products tags every SKU using rules first (deterministic, free) and
// Gemini second (only when the rule pass produced < 3 tags AND a key is set).
//
// The runtime is bounded by Gemini's free-tier rate limit; we drive it with a
// fixed-size worker pool whose effective RPS is controlled by
// TAGGING_RATE_LIMIT_PER_MIN. Rule-only SKUs cost ~no time.
func main() {
	cfg := config.Load()
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	dbc, err := db.New(cfg.SurrealURL, cfg.SurrealUser, cfg.SurrealPass, cfg.SurrealNS, cfg.SurrealDB)
	if err != nil {
		log.Fatal().Err(err).Msg("surreal connect")
	}
	defer dbc.Close()

	repo := db.NewRepo(dbc)
	aiClient := ai.NewClient(cfg.GeminiKey, cfg.GeminiModel, cfg.GeminiEmbed)
	tagger := tagging.New(repo, aiClient, cfg.TaggingDryRun)

	farmers, err := repo.ListFarmers(1000)
	if err != nil {
		log.Fatal().Err(err).Msg("list farmers")
	}

	// Collect all products up-front so we know the total for ETA logging.
	products := make([]models.Product, 0, len(farmers)*64)
	for _, f := range farmers {
		ps, err := repo.ListProductsByFarmer(f.ID)
		if err != nil {
			log.Warn().Err(err).Str("farmer", f.ShopName).Msg("list products")
			continue
		}
		products = append(products, ps...)
	}
	if len(products) == 0 {
		log.Warn().Msg("no products to tag (run import first?)")
		return
	}

	// Throughput math. The ticker gates the LLM-flavored SKUs; rule-only SKUs
	// bypass it because they don't touch the network.
	rpm := cfg.TaggingRPM
	if rpm < 1 {
		rpm = 15
	}
	workers := cfg.TaggingBatch
	if workers < 1 {
		workers = 8
	}
	ticker := time.NewTicker(time.Minute / time.Duration(rpm))
	defer ticker.Stop()

	log.Info().Int("products", len(products)).Int("workers", workers).Int("rpm", rpm).Msg("starting")

	ctx := context.Background()
	in := make(chan models.Product, workers*2)
	var done atomic.Int64
	var wg sync.WaitGroup

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for p := range in {
				// Rule pass — fast & free.
				ruleTags := tagging.RuleTags(p)
				if !cfg.TaggingDryRun {
					for _, t := range ruleTags {
						_ = repo.UpsertTag(p.ID, t, "rule", 1.0)
					}
				}
				// LLM pass only if rules under-deliver and key configured.
				if len(ruleTags) < 3 && aiClient.APIKey != "" {
					<-ticker.C // throttle
					_, _ = tagger.TagOne(ctx, p)
				}
				n := done.Add(1)
				if n%100 == 0 {
					log.Info().Int64("processed", n).Int("total", len(products)).Msg("progress")
				}
			}
		}()
	}

	for _, p := range products {
		in <- p
	}
	close(in)
	wg.Wait()

	log.Info().Int64("tagged", done.Load()).Msg("done")
}
