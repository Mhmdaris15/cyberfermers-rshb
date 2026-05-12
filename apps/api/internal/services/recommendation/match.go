package recommendation

import (
	"sort"
	"strings"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// MatchResult is a (product, score, reason) triple. Higher score = better fit.
type MatchResult struct {
	Product models.Product
	Score   float64
	Reasons []string
}

// MatchProducts ranks the farmer's catalog against an event using a 3-tier strategy:
//  1. Tag overlap   (strongest signal; +1 per matching tag, capped at 4).
//  2. Category fallback (event allow-list; +0.6 per category hit).
//  3. Lexical fallback (substring vs event.Themes / Title; +0.3).
// Negative filters: explicit "ban" tags drop the product entirely.
func MatchProducts(ev models.Event, products []models.Product) []MatchResult {
	bans := banTagsForEvent(ev)
	tagSet := stringSet(ev.ProductTags)
	catSet := stringSet(ev.Categories)
	themeWords := lower(append([]string{ev.Title}, ev.Themes...))

	out := make([]MatchResult, 0, len(products))
	for _, p := range products {
		if hasAny(p.Tags, bans) {
			continue
		}
		score := 0.0
		reasons := []string{}

		// 1) tag overlap (cap at 4 to avoid noisy fully-tagged SKUs winning everything)
		overlap := 0
		for _, t := range p.Tags {
			if tagSet[t] {
				overlap++
			}
		}
		if overlap > 4 {
			overlap = 4
		}
		if overlap > 0 {
			score += float64(overlap)
			reasons = append(reasons, "tag-match:"+itoa(overlap))
		}

		// 2) category match
		if catSet[p.Category] {
			score += 0.6
			reasons = append(reasons, "category:"+p.Category)
		}

		// 3) lexical fallback against event themes
		ph := strings.ToLower(p.Name + " " + p.Description)
		for _, w := range themeWords {
			if w == "" {
				continue
			}
			if strings.Contains(ph, w) {
				score += 0.3
				reasons = append(reasons, "theme:"+w)
				break
			}
		}

		if score <= 0 {
			continue
		}
		out = append(out, MatchResult{Product: p, Score: score, Reasons: reasons})
	}

	sort.SliceStable(out, func(i, j int) bool { return out[i].Score > out[j].Score })
	return out
}

// banTagsForEvent encodes hard constraints (e.g. fasting events ban meat/dairy).
func banTagsForEvent(ev models.Event) map[string]bool {
	if ev.TypeDetail == "fasting" || ev.Slug == "lent-fasting" {
		return stringSet([]string{"meat", "dairy", "cheese", "cheese_aged", "cheese_blue",
			"cheese_fresh", "lamb", "goose", "duck", "smoked_meat", "sausage_dry",
			"sausage_grill", "shashlik", "butter", "sour_cream", "yogurt_live",
			"kefir", "cottage_cheese", "milk_fresh", "eggs"})
	}
	if ev.Slug == "vegan-week" || ev.Slug == "world-vegan-day" {
		return stringSet([]string{"meat", "dairy", "cheese", "cheese_aged", "lamb", "goose", "duck",
			"smoked_meat", "sausage_dry", "sausage_grill", "fish_fresh", "smoked_fish",
			"caviar", "honey", "mead", "butter", "sour_cream", "yogurt_live", "kefir",
			"cottage_cheese", "milk_fresh", "eggs"})
	}
	return map[string]bool{}
}

// --- helpers ----------------------------------------------------------

func stringSet(xs []string) map[string]bool {
	m := make(map[string]bool, len(xs))
	for _, x := range xs {
		m[x] = true
	}
	return m
}
func hasAny(xs []string, set map[string]bool) bool {
	for _, x := range xs {
		if set[x] {
			return true
		}
	}
	return false
}
func lower(xs []string) []string {
	o := make([]string, len(xs))
	for i, s := range xs {
		o[i] = strings.ToLower(s)
	}
	return o
}
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	const digits = "0123456789"
	b := [4]byte{}
	pos := len(b)
	for n > 0 {
		pos--
		b[pos] = digits[n%10]
		n /= 10
	}
	return string(b[pos:])
}
