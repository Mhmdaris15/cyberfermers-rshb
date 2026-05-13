package insights

import (
	"sort"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// =====================================================================
//   Insights engine — proactive intelligence on the farmer's catalog.
//
//   Inputs:  farmer profile, products with tags, events in next 90 days.
//   Output:  ranked []models.Insight — 4..8 high-signal cards.
//
//   Each rule is a pure function (catalog state → 0..1 insight); ordering
//   is by .Score. No LLM in the loop — this is structured analytics.
// =====================================================================

type Engine struct {
	Repo *db.Repo
}

func New(repo *db.Repo) *Engine { return &Engine{Repo: repo} }

func (e *Engine) For(farmerID string) ([]models.Insight, error) {
	farmer, err := e.Repo.GetFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	products, err := e.Repo.ListProductsByFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	from := time.Now()
	to := from.AddDate(0, 0, 90)
	events, err := e.Repo.ListEventsBetween(from, to)
	if err != nil {
		// Tolerate empty event KB; some rules still run on catalog alone.
		events = nil
	}

	out := make([]models.Insight, 0, 8)
	out = append(out, ruleSeasonOpenings(products, events)...)
	out = append(out, ruleGiftGap(products)...)
	out = append(out, rulePremiumGap(products)...)
	out = append(out, ruleCategoryStrength(products, events)...)
	out = append(out, ruleChannelGap(*farmer)...)
	out = append(out, ruleMatchGap(products, events)...)
	out = append(out, ruleRepeatCadence(products)...)

	// Stable rank: highest score first; deterministic tiebreak on Title.
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].Title < out[j].Title
	})
	if len(out) > 8 {
		out = out[:8]
	}
	return out, nil
}
