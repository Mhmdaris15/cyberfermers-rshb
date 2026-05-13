package insights

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// =====================================================================
//   Each rule below maps a catalog/event signal to 0 or 1 insight.
//   Rules are intentionally small and named so the FE / deck can quote
//   the underlying signal ("rule: season_opening").
// =====================================================================

// ruleSeasonOpenings — surfaces season events starting in the next 30 days
// where the farmer already has ≥3 matching SKUs. The "soon but real" signal.
func ruleSeasonOpenings(products []models.Product, events []models.Event) []models.Insight {
	out := []models.Insight{}
	now := time.Now()
	horizon := now.AddDate(0, 0, 30)

	for _, ev := range events {
		if ev.Type != models.EventSeason {
			continue
		}
		if ev.StartDate.Before(now) || ev.StartDate.After(horizon) {
			continue
		}
		matched := countMatching(products, ev.ProductTags)
		if matched < 3 {
			continue
		}
		days := int(ev.StartDate.Sub(now).Hours() / 24)
		out = append(out, models.Insight{
			Kind:  "season_opening",
			Title: fmt.Sprintf("Сезон «%s» через %d дней — у вас %d подходящих SKU", ev.Title, days, matched),
			Body: fmt.Sprintf(
				"Окно сезона открывается %s. Рекомендуем подсветить SKU с тегами: %s. "+
					"Лучшее время начать прогрев — за %d дней до старта.",
				ev.StartDate.Format("2 January"),
				topTags(products, ev.ProductTags, 4),
				ev.PrepWindowDays,
			),
			Tone:  "leaf",
			Score: 0.80 - float64(days)*0.005,
			Evidence: map[string]any{
				"event": ev.Slug, "matched_skus": matched, "days_to_start": days,
			},
		})
	}
	return out
}

// ruleGiftGap — if < 5% of catalog has gift/gift_basket tags, flag the gap.
// The "gift_buyers" persona is one of the strongest converters on the marketplace.
func ruleGiftGap(products []models.Product) []models.Insight {
	if len(products) == 0 {
		return nil
	}
	giftTags := stringSet([]string{"gift", "gift_basket", "ribbon", "hand_packed"})
	hits := 0
	for _, p := range products {
		for _, t := range p.Tags {
			if giftTags[t] {
				hits++
				break
			}
		}
	}
	pct := float64(hits) / float64(len(products))
	if pct >= 0.05 {
		return nil
	}
	return []models.Insight{{
		Kind:  "gift_gap",
		Title: fmt.Sprintf("Подарочный сегмент недозагружен (%d из %d SKU)", hits, len(products)),
		Body: "Покупатели подарков — самый платёжеспособный сегмент маркетплейса. " +
			"Достаточно собрать 3–5 подарочных наборов из существующих SKU и пометить их тегом gift. " +
			"Пик спроса: декабрь, 23 февраля, 8 марта.",
		Tone:  "amber",
		Score: 0.70 + (0.05-pct)*4, // higher score when the gap is wider
		Evidence: map[string]any{
			"gift_skus": hits, "total_skus": len(products), "pct": pct,
		},
	}}
}

// rulePremiumGap — same idea for the "premium" tag. < 10% of catalog → flag.
func rulePremiumGap(products []models.Product) []models.Insight {
	if len(products) == 0 {
		return nil
	}
	premiumTags := stringSet([]string{"premium", "aged", "milk_fed", "rare", "truffle", "caviar_premium"})
	hits := 0
	for _, p := range products {
		for _, t := range p.Tags {
			if premiumTags[t] {
				hits++
				break
			}
		}
	}
	pct := float64(hits) / float64(len(products))
	if pct >= 0.10 {
		return nil
	}
	return []models.Insight{{
		Kind:  "premium_gap",
		Title: fmt.Sprintf("Премиум-сегмент — %d из %d SKU", hits, len(products)),
		Body: "Премиум-продукты лучше всего работают на Новый год и Международный день шеф-повара (20 октября). " +
			"Метка «premium» в описании + одна качественная фотография могут поднять средний чек на 15–25%.",
		Tone:  "plum",
		Score: 0.55 + (0.10-pct)*2,
		Evidence: map[string]any{
			"premium_skus": hits, "total_skus": len(products), "pct": pct,
		},
	}}
}

// ruleCategoryStrength — pick the farmer's top-2 categories and pair them
// with the most relevant upcoming events. A "play to your strengths" prompt.
func ruleCategoryStrength(products []models.Product, events []models.Event) []models.Insight {
	if len(products) < 5 {
		return nil
	}
	counts := map[string]int{}
	for _, p := range products {
		counts[p.Category]++
	}
	type pair struct {
		cat string
		n   int
	}
	ranked := make([]pair, 0, len(counts))
	for c, n := range counts {
		ranked = append(ranked, pair{c, n})
	}
	sort.Slice(ranked, func(i, j int) bool { return ranked[i].n > ranked[j].n })
	if len(ranked) == 0 {
		return nil
	}
	top := ranked[0]

	// Find next 2 events with this category in their target.
	matches := []string{}
	now := time.Now()
	horizon := now.AddDate(0, 0, 90)
	for _, ev := range events {
		if ev.StartDate.Before(now) || ev.StartDate.After(horizon) {
			continue
		}
		for _, c := range ev.Categories {
			if c == top.cat {
				matches = append(matches, ev.Title)
				break
			}
		}
		if len(matches) >= 3 {
			break
		}
	}
	if len(matches) == 0 {
		return nil
	}
	return []models.Insight{{
		Kind:  "category_strength",
		Title: fmt.Sprintf("Ваш сильный профиль — %s (%d SKU)", top.cat, top.n),
		Body: fmt.Sprintf(
			"В ближайшие 90 дней есть %d событий, где эта категория особенно востребована: %s. "+
				"Сфокусируйте 2–3 кампании на этих окнах — кросс-сейл бандлов даст самый большой ROI.",
			len(matches), strings.Join(matches, " · "),
		),
		Tone:  "leaf",
		Score: 0.60,
		Evidence: map[string]any{
			"category": top.cat, "skus": top.n, "matching_events": matches,
		},
	}}
}

// ruleChannelGap — flags missing high-impact channels in the farmer's settings.
func ruleChannelGap(farmer models.Farmer) []models.Insight {
	have := stringSet(farmer.Channels)
	missing := []string{}
	for _, ch := range []string{"push", "email", "chat"} {
		if !have[ch] {
			missing = append(missing, ch)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	cnLabel := map[string]string{
		"push":  "пуш-уведомления",
		"email": "e-mail рассылка",
		"chat":  "чат повторным покупателям",
	}
	labels := make([]string, len(missing))
	for i, m := range missing {
		labels[i] = cnLabel[m]
	}
	return []models.Insight{{
		Kind:  "channel_gap",
		Title: fmt.Sprintf("Не подключены каналы: %d", len(missing)),
		Body: fmt.Sprintf(
			"Эти каналы дают максимальный возврат на единицу усилий: %s. "+
				"Чат с повторными покупателями конвертит x4–x6 по сравнению с холодным пушем.",
			strings.Join(labels, ", "),
		),
		Tone:  "sky",
		Score: 0.50 + float64(len(missing))*0.05,
		Evidence: map[string]any{
			"missing_channels": missing,
		},
	}}
}

// ruleMatchGap — events in the next 60 days where the farmer has *some*
// category overlap but no tag-level matches. Calling attention to tagging
// effort that would unlock a campaign.
func ruleMatchGap(products []models.Product, events []models.Event) []models.Insight {
	out := []models.Insight{}
	now := time.Now()
	horizon := now.AddDate(0, 0, 60)
	for _, ev := range events {
		if ev.StartDate.Before(now) || ev.StartDate.After(horizon) {
			continue
		}
		catMatch := 0
		tagMatch := 0
		catSet := stringSet(ev.Categories)
		tagSet := stringSet(ev.ProductTags)
		for _, p := range products {
			if catSet[p.Category] {
				catMatch++
				for _, t := range p.Tags {
					if tagSet[t] {
						tagMatch++
						break
					}
				}
			}
		}
		if catMatch >= 5 && tagMatch == 0 {
			out = append(out, models.Insight{
				Kind:  "match_gap",
				Title: fmt.Sprintf("«%s»: %d SKU в нужных категориях, но без точных тегов", ev.Title, catMatch),
				Body: fmt.Sprintf(
					"У вас много продуктов в категориях %s, но ни один не помечен под событие. "+
						"Достаточно проставить 1–2 тега на ваши SKU — и они попадут в подборку.",
					strings.Join(top(ev.Categories, 3), ", "),
				),
				Tone:  "amber",
				Score: 0.45 + float64(catMatch)*0.01,
				Evidence: map[string]any{
					"event": ev.Slug, "cat_match": catMatch, "tag_match": tagMatch,
				},
			})
		}
	}
	if len(out) > 2 {
		out = out[:2]
	}
	return out
}

// ruleRepeatCadence — surfaces typical reorder cadence for fast-moving categories.
// Heuristic: dairy/bread/eggs/fresh ~= 7-14 days. Honey/jam ~= 30 days.
func ruleRepeatCadence(products []models.Product) []models.Insight {
	fast := stringSet([]string{
		"Яйца и молочные продукты", "Хлеб и выпечка", "Овощи и фрукты",
	})
	hits := 0
	for _, p := range products {
		if fast[p.Category] {
			hits++
		}
	}
	if hits < 5 {
		return nil
	}
	return []models.Insight{{
		Kind:  "repeat_cadence",
		Title: "Быстрые товары — окно для повторных продаж",
		Body: fmt.Sprintf(
			"%d ваших SKU относятся к категориям с коротким циклом повтора (7–14 дней). "+
				"Сообщение в чат повторному покупателю за 9 дней после первой покупки даёт лучший CTR.",
			hits,
		),
		Tone:  "plum",
		Score: 0.40,
		Evidence: map[string]any{"fast_movers": hits},
	}}
}

// --- helpers --------------------------------------------------------

func countMatching(products []models.Product, tags []string) int {
	set := stringSet(tags)
	n := 0
	for _, p := range products {
		for _, t := range p.Tags {
			if set[t] {
				n++
				break
			}
		}
	}
	return n
}

func topTags(products []models.Product, tags []string, k int) string {
	set := stringSet(tags)
	count := map[string]int{}
	for _, p := range products {
		for _, t := range p.Tags {
			if set[t] {
				count[t]++
			}
		}
	}
	type kv struct {
		t string
		n int
	}
	ranked := []kv{}
	for t, n := range count {
		ranked = append(ranked, kv{t, n})
	}
	sort.Slice(ranked, func(i, j int) bool { return ranked[i].n > ranked[j].n })
	out := []string{}
	for i := 0; i < len(ranked) && i < k; i++ {
		out = append(out, ranked[i].t)
	}
	if len(out) == 0 {
		return "—"
	}
	return strings.Join(out, ", ")
}

func top(xs []string, k int) []string {
	if len(xs) <= k {
		return xs
	}
	return xs[:k]
}

func stringSet(xs []string) map[string]bool {
	m := make(map[string]bool, len(xs))
	for _, x := range xs {
		m[x] = true
	}
	return m
}
