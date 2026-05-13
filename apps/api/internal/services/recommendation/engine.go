package recommendation

import (
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// Engine is the public surface of the recommendation service.
type Engine struct {
	Repo *db.Repo
}

func New(repo *db.Repo) *Engine { return &Engine{Repo: repo} }

// Suggestion is a runtime-only struct returned by BuildCalendar. We don't
// persist it on read; persistence happens when the user clicks "Add to plan."
type CalendarBuild struct {
	From        time.Time           `json:"from"`
	To          time.Time           `json:"to"`
	Events      []models.Event      `json:"events"`
	Suggestions []models.Suggestion `json:"suggestions"`
}

// BuildCalendar fetches events in [from,to], matches them against the farmer's
// catalog, builds suggestions with ROI estimates, and returns them ranked.
func (e *Engine) BuildCalendar(farmerID string, from, to time.Time) (*CalendarBuild, error) {
	farmer, err := e.Repo.GetFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	products, err := e.Repo.ListProductsByFarmer(farmerID)
	if err != nil {
		return nil, err
	}
	events, err := e.Repo.ListEventsBetween(from, to)
	if err != nil {
		return nil, err
	}

	out := &CalendarBuild{From: from, To: to, Events: events}

	for _, ev := range events {
		matches := MatchProducts(ev, products)
		if len(matches) == 0 {
			continue
		}
		// keep top-5 SKUs per event — more than that is rarely useful in a single campaign
		if len(matches) > 5 {
			matches = matches[:5]
		}
		channels := pickChannels(ev, farmer.Channels)
		lift := EstimateLift(ev, *farmer, matches, channels)

		productIDs := make([]string, 0, len(matches))
		productList := make([]models.Product, 0, len(matches))
		reasons := make(map[string][]string, len(matches))
		for _, m := range matches {
			productIDs = append(productIDs, m.Product.ID)
			productList = append(productList, m.Product)
			if len(m.Reasons) > 0 {
				reasons[m.Product.ID] = m.Reasons
			}
		}

		out.Suggestions = append(out.Suggestions, models.Suggestion{
			FarmerID:        farmer.ID,
			EventID:         ev.ID,
			Event:           cloneEvent(ev),
			Products:        productList,
			ProductIDs:      productIDs,
			Channels:        channels,
			DateWindowStart: prepStart(ev),
			DateWindowEnd:   ev.EndDate,
			Promo:           PromoSuggest(ev),
			PredictedLift:   lift,
			Score:           lift.OrdersDelta, // rank by Δorders
			Status:          "proposed",
			ProductReasons:  reasons,
		})
	}
	return out, nil
}

// pickChannels intersects the event's recommended channels with the channels
// the farmer actually has enabled. Falls back to event channels if empty.
func pickChannels(ev models.Event, farmerHas []string) []string {
	if len(farmerHas) == 0 {
		return ev.Channels
	}
	has := stringSet(farmerHas)
	out := []string{}
	for _, c := range ev.Channels {
		if has[c] {
			out = append(out, c)
		}
	}
	if len(out) == 0 {
		return ev.Channels
	}
	return out
}

func prepStart(ev models.Event) time.Time {
	prep := ev.PrepWindowDays
	if prep <= 0 {
		prep = 7
	}
	return ev.StartDate.AddDate(0, 0, -prep)
}

func cloneEvent(ev models.Event) *models.Event {
	e := ev
	return &e
}
