package chat

import (
	"strings"
	"time"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/ai"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/insights"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/recommendation"
)

// =====================================================================
//   Tool registry — every callable the chat LLM can dispatch.
//
//   Each entry exposes a Gemini function-declaration (name + JSON-schema
//   `parameters`) and a Go implementation `Run(args, ctx)`.
//
//   The chat service binds these to a farmer-scoped context at request
//   time so the LLM can't accidentally cross tenants.
// =====================================================================

type ToolCtx struct {
	FarmerID string
	Repo     *db.Repo
	Insights *insights.Engine
}

type Tool struct {
	Decl ai.ToolDecl
	// Run executes the tool with the given JSON-shaped args; the returned
	// map is sent back to Gemini as the FunctionResponse body.
	Run func(ctx ToolCtx, args map[string]any) (map[string]any, error)
}

// Declarations returns the flat list of ai.ToolDecl for Gemini.
func Declarations(tools []Tool) []ai.ToolDecl {
	out := make([]ai.ToolDecl, 0, len(tools))
	for _, t := range tools {
		out = append(out, t.Decl)
	}
	return out
}

// Registry returns the canonical 5-tool set bound to no farmer yet; callers
// must pass ToolCtx with FarmerID when running each tool.
func Registry() []Tool {
	return []Tool{
		toolUpcomingEvents(),
		toolSKUsMatching(),
		toolInsights(),
		toolPlanStatus(),
		toolSimulatePromo(),
	}
}

// --- 1. get_upcoming_events ------------------------------------------

func toolUpcomingEvents() Tool {
	return Tool{
		Decl: ai.ToolDecl{
			Name: "get_upcoming_events",
			Description: "Возвращает события маркетингового календаря, которые попадают в окно из N дней от сегодня. " +
				"Используй когда пользователь спрашивает о Пасхе, ближайших праздниках, открытии сезонов или предстоящих окнах продаж.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"window_days": map[string]any{
						"type":        "integer",
						"description": "Сколько дней вперёд смотреть. По умолчанию 30.",
					},
				},
			},
		},
		Run: func(ctx ToolCtx, args map[string]any) (map[string]any, error) {
			window := intArg(args, "window_days", 30)
			from := time.Now()
			to := from.AddDate(0, 0, window)
			evs, err := ctx.Repo.ListEventsBetween(from, to)
			if err != nil {
				return nil, err
			}
			out := make([]map[string]any, 0, len(evs))
			for _, ev := range evs {
				out = append(out, map[string]any{
					"slug":         ev.Slug,
					"title":        ev.Title,
					"type":         string(ev.Type),
					"start_date":   ev.StartDate.Format("2006-01-02"),
					"end_date":     ev.EndDate.Format("2006-01-02"),
					"product_tags": ev.ProductTags,
					"categories":   ev.Categories,
				})
			}
			return map[string]any{"events": out, "count": len(out), "window_days": window}, nil
		},
	}
}

// --- 2. get_skus_matching --------------------------------------------

func toolSKUsMatching() Tool {
	return Tool{
		Decl: ai.ToolDecl{
			Name: "get_skus_matching",
			Description: "Возвращает товары фермера, которые подходят под событие (по slug события) или под список тегов. " +
				"Используй когда пользователь спрашивает 'какие мои SKU подходят к Пасхе' или 'покажи мои premium-товары'.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"event_slug": map[string]any{
						"type":        "string",
						"description": "Slug события, например \"orthodox-easter\". Опционально — можно передать tags вместо.",
					},
					"tags": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string"},
						"description": "Список тегов для поиска по AND-логике. Альтернатива event_slug.",
					},
					"limit": map[string]any{
						"type":        "integer",
						"description": "Максимум товаров в ответе. По умолчанию 8.",
					},
				},
			},
		},
		Run: func(ctx ToolCtx, args map[string]any) (map[string]any, error) {
			limit := intArg(args, "limit", 8)
			products, err := ctx.Repo.ListProductsByFarmer(ctx.FarmerID)
			if err != nil {
				return nil, err
			}

			var ev *models.Event
			tags := stringSliceArg(args, "tags")
			if slug := stringArg(args, "event_slug"); slug != "" {
				now := time.Now()
				evs, _ := ctx.Repo.ListEventsBetween(now.AddDate(0, -3, 0), now.AddDate(0, 12, 0))
				for i := range evs {
					if evs[i].Slug == slug {
						ev = &evs[i]
						break
					}
				}
			}

			// Reuse the matcher for event-mode; for tags-only, do a simple intersect.
			matched := []map[string]any{}
			if ev != nil {
				results := recommendation.MatchProducts(*ev, products)
				if len(results) > limit {
					results = results[:limit]
				}
				for _, r := range results {
					matched = append(matched, map[string]any{
						"id":       r.Product.ID,
						"name":     r.Product.Name,
						"category": r.Product.Category,
						"reasons":  r.Reasons,
					})
				}
			} else if len(tags) > 0 {
				want := stringSet(tags)
				for _, p := range products {
					hits := 0
					for _, t := range p.Tags {
						if want[t] {
							hits++
						}
					}
					if hits > 0 {
						matched = append(matched, map[string]any{
							"id": p.ID, "name": p.Name, "category": p.Category,
							"matched_tags": hits,
						})
					}
					if len(matched) >= limit {
						break
					}
				}
			}
			return map[string]any{
				"matched": matched, "count": len(matched),
				"event_slug": stringArg(args, "event_slug"),
			}, nil
		},
	}
}

// --- 3. get_insights -------------------------------------------------

func toolInsights() Tool {
	return Tool{
		Decl: ai.ToolDecl{
			Name: "get_insights",
			Description: "Возвращает 4-8 проактивных инсайтов про каталог фермера. " +
				"Используй когда пользователь спрашивает 'что AI думает', 'где у меня пробелы', 'что улучшить'.",
			Parameters: map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
		Run: func(ctx ToolCtx, _ map[string]any) (map[string]any, error) {
			ins, err := ctx.Insights.For(ctx.FarmerID)
			if err != nil {
				return nil, err
			}
			lite := make([]map[string]any, 0, len(ins))
			for _, in := range ins {
				lite = append(lite, map[string]any{
					"kind": in.Kind, "title": in.Title, "body": in.Body,
					"score": in.Score,
				})
			}
			return map[string]any{"insights": lite, "count": len(lite)}, nil
		},
	}
}

// --- 4. get_plan_status ----------------------------------------------

func toolPlanStatus() Tool {
	return Tool{
		Decl: ai.ToolDecl{
			Name: "get_plan_status",
			Description: "Возвращает сводку по доске кампаний: сколько карточек в каждой колонке " +
				"(proposed/planned/live/completed). Используй когда пользователь спрашивает про план или статус кампаний.",
			Parameters: map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
		Run: func(ctx ToolCtx, _ map[string]any) (map[string]any, error) {
			cards, err := ctx.Repo.ListPlanByFarmer(ctx.FarmerID)
			if err != nil {
				return nil, err
			}
			counts := map[string]int{"proposed": 0, "planned": 0, "live": 0, "completed": 0}
			for _, c := range cards {
				col := c.Column
				if col == "" {
					col = "proposed"
				}
				counts[col]++
			}
			return map[string]any{"counts": counts, "total": len(cards)}, nil
		},
	}
}

// --- 5. simulate_promo (Tools + ROI sim, per user's choice) ----------

func toolSimulatePromo() Tool {
	return Tool{
		Decl: ai.ToolDecl{
			Name: "simulate_promo",
			Description: "Что-если симуляция: пересчитывает прогноз ROI для события с заданной скидкой и набором каналов. " +
				"Используй когда пользователь спрашивает 'что если поднять скидку до 20%' или 'что если убрать пуш-канал'.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"event_slug": map[string]any{
						"type":        "string",
						"description": "Slug события для симуляции.",
					},
					"discount_pct": map[string]any{
						"type":        "integer",
						"description": "Скидка 0-50%. По умолчанию — как в исходном предложении.",
					},
					"channels": map[string]any{
						"type":        "array",
						"items":       map[string]any{"type": "string"},
						"description": "Список каналов: storefront, push, story, blog, recipe, chat, social, email.",
					},
				},
				"required": []string{"event_slug"},
			},
		},
		Run: func(ctx ToolCtx, args map[string]any) (map[string]any, error) {
			slug := stringArg(args, "event_slug")
			if slug == "" {
				return map[string]any{"error": "event_slug обязателен"}, nil
			}
			now := time.Now()
			evs, _ := ctx.Repo.ListEventsBetween(now.AddDate(0, -3, 0), now.AddDate(0, 12, 0))
			var ev *models.Event
			for i := range evs {
				if evs[i].Slug == slug {
					ev = &evs[i]
					break
				}
			}
			if ev == nil {
				return map[string]any{"error": "событие не найдено: " + slug}, nil
			}
			farmer, err := ctx.Repo.GetFarmer(ctx.FarmerID)
			if err != nil {
				return nil, err
			}
			products, err := ctx.Repo.ListProductsByFarmer(ctx.FarmerID)
			if err != nil {
				return nil, err
			}
			matched := recommendation.MatchProducts(*ev, products)
			if len(matched) > 5 {
				matched = matched[:5]
			}

			channels := stringSliceArg(args, "channels")
			if len(channels) == 0 {
				channels = ev.Channels
			}

			// Baseline (whatever PromoSuggest would propose).
			baseLift := recommendation.EstimateLift(*ev, *farmer, matched, channels)

			// Override the discount if requested. ROI engine reads discount from
			// PromoSuggest internally — we recompute revenue manually with the override.
			discount := intArg(args, "discount_pct", -1)
			out := map[string]any{
				"event":    ev.Title,
				"channels": channels,
				"baseline": map[string]any{
					"orders_delta":  baseLift.OrdersDelta,
					"revenue_delta": baseLift.RevenueDelta,
					"confidence":    baseLift.Confidence,
				},
			}
			if discount >= 0 {
				// revenue scales linearly with (1 - d/100); orders unchanged in this MVP.
				newRev := baseLift.RevenueDelta * (1 - float64(discount)/100.0) /
					(1 - effectiveBaseDiscount(*ev)/100.0)
				out["override"] = map[string]any{
					"discount_pct":  discount,
					"orders_delta":  baseLift.OrdersDelta,
					"revenue_delta": round0(newRev),
					"delta_revenue_vs_baseline": round0(newRev - baseLift.RevenueDelta),
				}
			}
			return out, nil
		},
	}
}

// effectiveBaseDiscount looks up what PromoSuggest would give for this event.
func effectiveBaseDiscount(ev models.Event) float64 {
	return float64(recommendation.PromoSuggest(ev).DiscountPct)
}

// --- helpers ---------------------------------------------------------

func stringArg(args map[string]any, key string) string {
	if v, ok := args[key].(string); ok {
		return v
	}
	return ""
}
func intArg(args map[string]any, key string, def int) int {
	switch v := args[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	case string:
		// LLMs occasionally stringify ints; tolerate.
		var n int
		for _, ch := range v {
			if ch < '0' || ch > '9' {
				return def
			}
			n = n*10 + int(ch-'0')
		}
		return n
	}
	return def
}
func stringSliceArg(args map[string]any, key string) []string {
	v, ok := args[key].([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(v))
	for _, x := range v {
		if s, ok := x.(string); ok {
			out = append(out, strings.TrimSpace(s))
		}
	}
	return out
}
func stringSet(xs []string) map[string]bool {
	m := make(map[string]bool, len(xs))
	for _, x := range xs {
		m[x] = true
	}
	return m
}
func round0(v float64) float64 {
	if v < 0 {
		return -round0(-v)
	}
	return float64(int(v + 0.5))
}
