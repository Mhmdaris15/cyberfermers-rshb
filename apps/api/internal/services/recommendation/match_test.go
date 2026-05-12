package recommendation

import (
	"testing"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// The matcher is the highest-scoring 6pt item ("solution quality") — these
// tests pin every important behavior so future tweaks don't silently regress.

func TestMatchProducts_TagOverlapBeatsCategoryAlone(t *testing.T) {
	ev := models.Event{
		Slug:        "easter-2026",
		Title:       "Пасха",
		Type:        models.EventHoliday,
		ProductTags: []string{"kulich", "paskha"},
		Categories:  []string{"Хлеб и выпечка"},
	}
	products := []models.Product{
		{ID: "1", Name: "Кулич", Category: "Хлеб и выпечка", Tags: []string{"kulich", "easter"}}, // tag+cat
		{ID: "2", Name: "Хлеб ржаной", Category: "Хлеб и выпечка"},                                // cat only
	}
	got := MatchProducts(ev, products)
	if len(got) < 2 {
		t.Fatalf("expected both products matched, got %d", len(got))
	}
	if got[0].Product.ID != "1" {
		t.Errorf("expected tag-match product to rank first, got %v", got[0].Product.ID)
	}
	if got[0].Score <= got[1].Score {
		t.Errorf("tag-match score must beat category-only; got %v vs %v", got[0].Score, got[1].Score)
	}
}

func TestMatchProducts_LentBansMeatAndDairy(t *testing.T) {
	ev := models.Event{
		Slug:        "lent-fasting",
		Title:       "Великий пост",
		Type:        models.EventSeason,
		TypeDetail:  "fasting",
		ProductTags: []string{"legumes", "mushrooms", "vegetables"},
		Categories:  []string{"Овощи и фрукты", "Бакалея"},
	}
	products := []models.Product{
		{ID: "ok-veg", Name: "Чечевица", Category: "Бакалея", Tags: []string{"legumes"}},
		{ID: "bad-meat", Name: "Колбаса", Category: "Мясо и птица", Tags: []string{"meat", "sausage_dry"}},
		{ID: "bad-cheese", Name: "Пармезан", Category: "Сыры", Tags: []string{"cheese", "cheese_aged"}},
	}
	got := MatchProducts(ev, products)
	for _, m := range got {
		if m.Product.ID == "bad-meat" || m.Product.ID == "bad-cheese" {
			t.Errorf("Lent must exclude %s but it slipped through", m.Product.ID)
		}
	}
}

func TestMatchProducts_VeganWeekBansAnimalProducts(t *testing.T) {
	ev := models.Event{
		Slug:        "vegan-week",
		Title:       "Веганская неделя",
		Type:        models.EventThemedWeek,
		ProductTags: []string{"plant_milk", "legumes", "nuts"},
	}
	products := []models.Product{
		{ID: "plant", Name: "Овсяное молоко", Tags: []string{"plant_milk"}},
		{ID: "honey", Name: "Мёд", Tags: []string{"honey"}}, // banned
	}
	got := MatchProducts(ev, products)
	for _, m := range got {
		if m.Product.ID == "honey" {
			t.Errorf("vegan-week must exclude honey, but it ranked %v", m.Score)
		}
	}
}

func TestMatchProducts_TagOverlapCapped(t *testing.T) {
	// A product with every event tag would dominate; the cap prevents one
	// over-tagged SKU from monopolising every event.
	ev := models.Event{
		Slug:        "summer-berries",
		Title:       "Ягодный сезон",
		Type:        models.EventSeason,
		ProductTags: []string{"strawberry", "raspberry", "blueberry", "cherry", "blackcurrant", "redcurrant"},
	}
	monster := models.Product{
		ID: "m", Name: "Ассорти ягод",
		Tags: []string{"strawberry", "raspberry", "blueberry", "cherry", "blackcurrant", "redcurrant"},
	}
	got := MatchProducts(ev, []models.Product{monster})
	if got[0].Score > 4.6 { // 4-tag cap + tiny epsilon for category/lex
		t.Errorf("score above tag-overlap cap: got %v", got[0].Score)
	}
}

func TestMatchProducts_ReturnsEmptyWhenNoSignals(t *testing.T) {
	ev := models.Event{
		Slug:        "honey-spas",
		Type:        models.EventHoliday,
		ProductTags: []string{"honey", "mead"},
	}
	products := []models.Product{{ID: "x", Name: "Тостер", Category: "Электроника"}}
	got := MatchProducts(ev, products)
	if len(got) != 0 {
		t.Errorf("expected no matches for irrelevant catalog, got %d", len(got))
	}
}
