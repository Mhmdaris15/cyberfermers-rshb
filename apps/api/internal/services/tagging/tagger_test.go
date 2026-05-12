package tagging

import (
	"sort"
	"testing"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

func TestRuleTags_CategoryBaseline(t *testing.T) {
	cases := []struct {
		category string
		want     string
	}{
		{"Мёд и пчеловодство", "honey"},
		{"Сыры", "cheese"},
		{"Хлеб и выпечка", "bread_artisan"},
		{"Мясо и птица", "meat"},
		{"Рыба и морепродукты", "fish_fresh"},
		{"Яйца и молочные продукты", "dairy"},
		{"Овощи и фрукты", "vegetables"},
	}
	for _, tc := range cases {
		got := RuleTags(models.Product{Category: tc.category})
		if !contains(got, tc.want) {
			t.Errorf("category %q must produce tag %q, got %v", tc.category, tc.want, got)
		}
	}
}

func TestRuleTags_KeywordExtraction(t *testing.T) {
	// Each pair: input product description fragment → expected tag.
	cases := []struct {
		name string
		desc string
		want []string
	}{
		{"Кулич пасхальный", "Традиционный кулич с изюмом, готовится к Пасхе.", []string{"easter"}},
		{"Мёд гречишный", "Натуральный мёд без добавок.", []string{"honey"}},
		{"Творог", "Свежий домашний творог.", []string{"cottage_cheese"}},
		{"Малина свежая", "Малина прямо с куста.", []string{"raspberry"}},
		{"Травяной сбор", "Травяной сбор из горных трав.", []string{"herbal_blend"}},
		{"Яблочный сидр премиум", "Premium яблочный сидр.", []string{"cider", "apple", "premium"}},
	}
	for _, tc := range cases {
		got := RuleTags(models.Product{Name: tc.name, Description: tc.desc})
		for _, w := range tc.want {
			if !contains(got, w) {
				t.Errorf("name=%q desc=%q must produce tag %q, got %v", tc.name, tc.desc, w, got)
			}
		}
	}
}

func TestRuleTags_NoFalsePositives(t *testing.T) {
	got := RuleTags(models.Product{
		Name:        "Розы свежие",
		Description: "Букет роз.",
		Category:    "",
	})
	// roses must not be tagged as vegan/easter/etc.
	for _, bad := range []string{"vegan", "easter", "premium", "honey"} {
		if contains(got, bad) {
			t.Errorf("rose description should not tag %q; tags=%v", bad, got)
		}
	}
}

func TestRuleTags_DedupAndLowercase(t *testing.T) {
	got := RuleTags(models.Product{
		Name:        "Мёд горный",
		Description: "Мёд горный, мёд натуральный.",
		Category:    "Мёд и пчеловодство",
	})
	count := 0
	for _, x := range got {
		if x == "honey" {
			count++
		}
	}
	if count != 1 {
		t.Errorf("expected 'honey' deduplicated to single occurrence, got %d in %v", count, got)
	}
	// all lowercase
	for _, x := range got {
		for _, r := range x {
			if r >= 'A' && r <= 'Z' {
				t.Errorf("tag %q must be lowercase", x)
				break
			}
		}
	}
}

func contains(xs []string, target string) bool {
	sort.Strings(xs)
	i := sort.SearchStrings(xs, target)
	return i < len(xs) && xs[i] == target
}
