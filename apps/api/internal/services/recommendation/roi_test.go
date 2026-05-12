package recommendation

import (
	"testing"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// fixtureEvent returns a deterministic event used as the input to every ROI
// assertion. All test cases below describe how variations to the *inputs*
// (farmer focus, channel set, sku count) change the *output* — not the model
// itself. If the assertions ever break, that means our ROI model changed and
// the deck/COVERAGE.md numbers need to be re-calibrated.
func fixtureEvent() models.Event {
	return models.Event{
		Slug:           "easter-2026",
		Title:          "Пасха",
		Type:           models.EventHoliday,
		StartDate:      time.Date(2026, 4, 12, 0, 0, 0, 0, time.UTC),
		EndDate:        time.Date(2026, 4, 19, 0, 0, 0, 0, time.UTC),
		PrepWindowDays: 14,
		Audience:       []string{"healthy", "parents", "gourmets"},
		Channels:       []string{"storefront", "push", "story", "blog", "chat"},
	}
}

func fixtureFarmer(focus ...string) models.Farmer {
	return models.Farmer{
		OrganizationID: 10060,
		ShopName:       "Экоферма ОГО-РОД",
		AudienceFocus:  focus,
	}
}

func threeSKUs() []MatchResult {
	return []MatchResult{
		{Product: models.Product{ID: "a", Name: "Кулич"}, Score: 4},
		{Product: models.Product{ID: "b", Name: "Творог"}, Score: 3},
		{Product: models.Product{ID: "c", Name: "Яйца"}, Score: 2},
	}
}

func TestEstimateLift_Positive(t *testing.T) {
	lift := EstimateLift(fixtureEvent(), fixtureFarmer("healthy", "parents"), threeSKUs(), []string{"storefront", "push", "story"})
	if lift.OrdersDelta <= 0 {
		t.Fatalf("orders_delta must be positive, got %v", lift.OrdersDelta)
	}
	if lift.RevenueDelta <= 0 {
		t.Fatalf("revenue_delta must be positive, got %v", lift.RevenueDelta)
	}
	if len(lift.Assumptions) < 5 {
		t.Fatalf("expected ≥5 named assumptions on the projection, got %d", len(lift.Assumptions))
	}
}

func TestEstimateLift_AudienceWeightInRange(t *testing.T) {
	// Audience overlap directly drives the lift multiplier; outputs must
	// fall in the documented [0.7, 1.3] window.
	none := audienceWeight([]string{"healthy", "parents"}, []string{"gift_buyers"})
	full := audienceWeight([]string{"healthy", "parents"}, []string{"healthy", "parents"})

	if none < 0.69 || none > 1.0 {
		t.Errorf("zero-overlap weight out of band: got %v", none)
	}
	if full < 1.25 || full > 1.31 {
		t.Errorf("full-overlap weight out of band: got %v", full)
	}
	if full <= none {
		t.Errorf("full overlap must score above zero overlap; full=%v none=%v", full, none)
	}
}

func TestEstimateLift_DiversityBonusCappedAt50(t *testing.T) {
	if got := skuDiversityBonus(1); got != 1.0 {
		t.Errorf("1 SKU bonus = %v, want 1.0", got)
	}
	if got := skuDiversityBonus(2); got != 1.15 {
		t.Errorf("2 SKU bonus = %v, want 1.15", got)
	}
	if got := skuDiversityBonus(3); got != 1.30 {
		t.Errorf("3 SKU bonus = %v, want 1.30", got)
	}
	// >= 4 SKUs should plateau at 1.5 — the docs promise +50% max.
	if got := skuDiversityBonus(10); got != 1.50 {
		t.Errorf("10 SKU bonus = %v, want 1.50 (cap)", got)
	}
}

func TestEstimateLift_MoreChannelsMoreOrders(t *testing.T) {
	farmer := fixtureFarmer("healthy")
	products := threeSKUs()
	ev := fixtureEvent()

	one := EstimateLift(ev, farmer, products, []string{"storefront"})
	many := EstimateLift(ev, farmer, products, []string{"storefront", "push", "story", "blog", "chat"})

	if many.OrdersDelta <= one.OrdersDelta {
		t.Fatalf("expanding channel mix must increase Δorders; one=%v many=%v",
			one.OrdersDelta, many.OrdersDelta)
	}
}

func TestPromoSuggest_PerEventType(t *testing.T) {
	cases := []struct {
		typ    models.EventType
		minPct int
	}{
		{models.EventHoliday, 10},
		{models.EventThemedWeek, 5},
		{models.EventTrend, 7},
		{models.EventSeason, 0},
		{models.EventProfessional, 0},
	}
	for _, tc := range cases {
		p := PromoSuggest(models.Event{Type: tc.typ})
		if p.DiscountPct < tc.minPct {
			t.Errorf("type=%s discount=%d want ≥%d", tc.typ, p.DiscountPct, tc.minPct)
		}
	}
}

// Revenue should fall when promo discount climbs (same Δorders, lower margin).
func TestEstimateLift_DiscountErodesRevenue(t *testing.T) {
	farmer := fixtureFarmer("healthy", "parents")
	products := threeSKUs()

	holiday := fixtureEvent()
	season := fixtureEvent()
	season.Type = models.EventSeason // 0% discount

	hLift := EstimateLift(holiday, farmer, products, []string{"storefront", "push"})
	sLift := EstimateLift(season, farmer, products, []string{"storefront", "push"})

	if hLift.OrdersDelta >= sLift.OrdersDelta && hLift.RevenueDelta/hLift.OrdersDelta >=
		sLift.RevenueDelta/sLift.OrdersDelta {
		t.Errorf("holiday should yield lower revenue per order due to discount; h=%v s=%v",
			hLift.RevenueDelta/hLift.OrdersDelta, sLift.RevenueDelta/sLift.OrdersDelta)
	}
}
