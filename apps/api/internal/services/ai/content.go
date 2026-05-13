package ai

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ContentService orchestrates per-channel content generation for a suggestion.
type ContentService struct {
	AI *Client
}

func NewContentService(c *Client) *ContentService { return &ContentService{AI: c} }

// channelGen returns the (prompt-builder, schema) pair for a channel.
type channelGen struct {
	build  func(farmer, eventTitle, eventType, productsBlock string) string
	schema any
}

func channelGenerators() map[models.Channel]channelGen {
	return map[models.Channel]channelGen{
		models.ChPush: {
			build: func(f, t, _, pb string) string { return PushPrompt(f, t, "holiday", pb) },
			schema: SchemaPush,
		},
		models.ChStory: {
			build: func(f, t, _, pb string) string { return StoryPrompt(f, t, pb) },
			schema: SchemaStory,
		},
		models.ChBlog: {
			build: func(f, t, _, pb string) string { return BlogPrompt(f, t, pb) },
			schema: SchemaBlog,
		},
		models.ChRecipe: {
			build: func(_, t, _, pb string) string { return RecipePrompt(t, pb) },
			schema: SchemaRecipe,
		},
		models.ChChat: {
			build: func(f, t, _, pb string) string { return ChatPrompt(f, t, pb) },
			schema: SchemaChat,
		},
		models.ChSocial: {
			build: func(f, t, _, pb string) string { return SocialPrompt(f, t, pb) },
			schema: SchemaSocial,
		},
	}
}

// GenerateAll fans out concurrent Gemini calls for every requested channel.
// Returns a map[channel] -> raw object (json-shaped) ready to persist.
//
// `variant` indexes A/B/C drafts. For variant > 0 we append a short hint to
// every prompt asking the model to take a meaningfully different angle, while
// keeping the structured output schema unchanged. Persisted under the same
// (suggestion, channel, variant) triple — see schema.surql.
func (s *ContentService) GenerateAll(
	ctx context.Context,
	farmer models.Farmer,
	event models.Event,
	products []models.Product,
	channels []models.Channel,
	variant int,
) (map[models.Channel]map[string]any, error) {
	if s.AI == nil || s.AI.APIKey == "" {
		return s.fallbackAll(farmer, event, products, channels), nil
	}
	gens := channelGenerators()
	farmerStr := farmer.ShopName
	productsBlock := productsBullet(products)

	type result struct {
		ch  models.Channel
		raw map[string]any
		err error
	}
	results := make(chan result, len(channels))
	var wg sync.WaitGroup
	for _, ch := range channels {
		gen, ok := gens[ch]
		if !ok {
			continue
		}
		wg.Add(1)
		go func(ch models.Channel, gen channelGen) {
			defer wg.Done()
			prompt := gen.build(farmerStr, event.Title, string(event.Type), productsBlock)
			if variant > 0 {
				prompt += variantHint(variant)
			}
			out := map[string]any{}
			if err := s.AI.GenerateJSON(ctx, SystemRU, prompt, gen.schema, &out); err != nil {
				log.Warn().Err(err).Str("channel", string(ch)).Msg("content generation failed; fallback")
				results <- result{ch: ch, raw: s.fallbackOne(ch, farmer, event, products), err: err}
				return
			}
			results <- result{ch: ch, raw: out}
		}(ch, gen)
	}
	wg.Wait()
	close(results)

	out := make(map[models.Channel]map[string]any, len(channels))
	for r := range results {
		out[r.ch] = r.raw
	}
	return out, nil
}

// fallbackAll returns deterministic content for every channel when the LLM is
// unavailable. Keeps the demo robust on flaky networks.
func (s *ContentService) fallbackAll(f models.Farmer, ev models.Event, ps []models.Product, channels []models.Channel) map[models.Channel]map[string]any {
	out := map[models.Channel]map[string]any{}
	for _, ch := range channels {
		out[ch] = s.fallbackOne(ch, f, ev, ps)
	}
	return out
}

func (s *ContentService) fallbackOne(ch models.Channel, f models.Farmer, ev models.Event, ps []models.Product) map[string]any {
	first := ""
	if len(ps) > 0 {
		first = ps[0].Name
	}
	switch ch {
	case models.ChPush:
		return map[string]any{
			"title": ev.Title,
			"body":  fmt.Sprintf("Подборка от %s к событию «%s»", f.ShopName, ev.Title),
		}
	case models.ChStory:
		return map[string]any{
			"caption":      fmt.Sprintf("К %s: %s от %s.", ev.Title, first, f.ShopName),
			"image_prompt": "Russian farmer market table, natural light, seasonal produce, warm tones",
		}
	case models.ChBlog:
		return map[string]any{
			"title": fmt.Sprintf("%s: что приготовить от фермера %s", ev.Title, f.ShopName),
			"lede":  "Сезонная подборка от проверенного фермера маркетплейса «Своё Родное».",
			"body":  fmt.Sprintf("К %s мы подобрали несколько товаров фермера %s. Среди них — %s. Каждый из них пригодится для праздничного стола или повседневного меню.", ev.Title, f.ShopName, productsBullet(ps)),
		}
	case models.ChRecipe:
		return map[string]any{
			"name":        fmt.Sprintf("Сезонное блюдо: %s", first),
			"yield":       "4 порции",
			"time":        "30 минут",
			"ingredients": []string{first, "соль", "перец", "масло"},
			"steps":       []string{"Подготовьте продукты.", "Приготовьте по вкусу.", "Подавайте сразу."},
		}
	case models.ChChat:
		return map[string]any{
			"segment": "repeat_buyers",
			"message": fmt.Sprintf("К %s у нас новая подборка. В прошлый раз вам понравился %s — посмотрите похожие товары.", ev.Title, first),
		}
	case models.ChSocial:
		return map[string]any{
			"title":    ev.Title,
			"text":     fmt.Sprintf("К %s выкладываю подборку. Лучшее — %s. Закажите на svoe-rodnoe.ru", ev.Title, first),
			"hashtags": []string{"#своёродное", "#фермерскиепродукты"},
		}
	}
	return map[string]any{}
}

// variantHint appends to the prompt for non-zero variants so the model takes
// a meaningfully different angle without breaking the JSON schema.
func variantHint(variant int) string {
	hints := []string{
		// variant 1
		"\n\nЭто ВАРИАНТ B. Возьми ДРУГОЙ угол: смести акцент с продукта на повод (или наоборот), используй другую структуру предложения, другую эмоцию. Не повторяй формулировки варианта A.",
		// variant 2
		"\n\nЭто ВАРИАНТ C. Попробуй провокационный угол: ставь под сомнение «обычные» подходы к этому событию, упирай на эксклюзивность или редкость предложения.",
	}
	if variant-1 < len(hints) {
		return hints[variant-1]
	}
	return fmt.Sprintf("\n\nЭто ВАРИАНТ %d. Сильно отличайся от вариантов 0..%d по тону и структуре.", variant, variant-1)
}

func productsBullet(ps []models.Product) string {
	if len(ps) == 0 {
		return "(нет товаров)"
	}
	parts := make([]string, 0, len(ps))
	for i, p := range ps {
		if i >= 5 {
			break
		}
		parts = append(parts, fmt.Sprintf("- %s (%s)", p.Name, p.Category))
	}
	return strings.Join(parts, "\n")
}
