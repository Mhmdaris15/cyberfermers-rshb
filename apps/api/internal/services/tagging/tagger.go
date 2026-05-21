package tagging

import (
	"context"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/ai"
)

// Tagger fans tag candidates from rule-based extraction + a Gemini LLM pass.
type Tagger struct {
	Repo   *db.Repo
	AI     *ai.Client
	DryRun bool
}

func New(repo *db.Repo, client *ai.Client, dryRun bool) *Tagger {
	return &Tagger{Repo: repo, AI: client, DryRun: dryRun}
}

// TagOne tags a single product using rules first (cheap, deterministic), then LLM if rules
// produced fewer than 3 tags. Tags are persisted with source="rule" or "llm".
func (t *Tagger) TagOne(ctx context.Context, p models.Product) ([]string, error) {
	ruleTags := RuleTags(p)
	combined := dedup(ruleTags)

	if !t.DryRun {
		for _, tag := range ruleTags {
			_ = t.Repo.UpsertTag(p.ID, tag, "rule", 1.0)
		}
	}

	if len(ruleTags) >= 3 || t.AI == nil || t.AI.APIKey == "" {
		return combined, nil
	}

	cctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var out struct {
		Tags       []string `json:"tags"`
		Confidence float64  `json:"confidence"`
	}
	err := t.AI.GenerateJSON(cctx, ai.SystemRU, ai.TaggingPrompt(p.Name, p.Description, p.Category), ai.SchemaTagging, &out)
	if err != nil {
		log.Warn().Err(err).Str("product", p.Name).Msg("llm tag failed; falling back to rules")
		return combined, nil
	}
	if !t.DryRun {
		for _, tag := range out.Tags {
			_ = t.Repo.UpsertTag(p.ID, tag, "llm", out.Confidence)
		}
	}
	return dedup(append(combined, out.Tags...)), nil
}

// Suggestion is one candidate tag returned by SuggestForProduct.
// `Source` is "rule" (deterministic match) or "llm" (Gemini), `Confidence`
// is 1.0 for rules and the model's self-reported number for LLM.
// `Existing` is true if the tag is already persisted on this product —
// the FE uses it to render the chip as "already applied" so the user
// doesn't double-add.
type Suggestion struct {
	Tag        string  `json:"tag"`
	Source     string  `json:"source"`
	Confidence float64 `json:"confidence"`
	Existing   bool    `json:"existing"`
}

// SuggestForProduct returns tag suggestions WITHOUT persisting them.
// Powers the suggest-then-approve UX: rule tags come back first (free,
// instant), LLM tags fill the rest up to ~6 total suggestions. The FE
// renders them as chips the user clicks to accept.
//
// Existing-on-product tags are included with Existing=true so the FE
// can grey them out — useful when the user wants "more like this".
func (t *Tagger) SuggestForProduct(ctx context.Context, p models.Product) ([]Suggestion, error) {
	existing, _ := t.Repo.ListTagsForProduct(p.ID)
	existingSet := map[string]bool{}
	for _, e := range existing {
		existingSet[strings.ToLower(e)] = true
	}

	out := make([]Suggestion, 0, 8)
	for _, tag := range RuleTags(p) {
		out = append(out, Suggestion{
			Tag:        tag,
			Source:     "rule",
			Confidence: 1.0,
			Existing:   existingSet[tag],
		})
	}

	if t.AI == nil || t.AI.APIKey == "" {
		return out, nil
	}

	cctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var resp struct {
		Tags       []string `json:"tags"`
		Confidence float64  `json:"confidence"`
	}
	if err := t.AI.GenerateJSON(cctx, ai.SystemRU, ai.TaggingPrompt(p.Name, p.Description, p.Category), ai.SchemaTagging, &resp); err != nil {
		log.Warn().Err(err).Str("product", p.Name).Msg("llm suggest failed; returning rule tags only")
		return out, nil
	}
	conf := resp.Confidence
	if conf <= 0 || conf > 1 {
		conf = 0.7
	}
	seen := map[string]bool{}
	for _, s := range out {
		seen[s.Tag] = true
	}
	for _, tag := range resp.Tags {
		norm := strings.ToLower(strings.TrimSpace(tag))
		if norm == "" || seen[norm] {
			continue
		}
		seen[norm] = true
		out = append(out, Suggestion{
			Tag:        norm,
			Source:     "llm",
			Confidence: conf,
			Existing:   existingSet[norm],
		})
	}
	return out, nil
}

// AutoTagMissingResult reports the bulk-tagging pass for one farmer.
type AutoTagMissingResult struct {
	ProductsConsidered int `json:"products_considered"`
	ProductsTouched    int `json:"products_touched"`
	TagsAdded          int `json:"tags_added"`
	LLMCalls           int `json:"llm_calls"`
}

// AutoTagMissing runs TagOne on every product that currently has fewer
// than `minTags` tags. Persists the new tags as the underlying TagOne
// already does. Returns counts so the FE can show the user a meaningful
// confirmation toast ("36 products tagged, 84 new tags").
func (t *Tagger) AutoTagMissing(ctx context.Context, products []models.Product, minTags int) (AutoTagMissingResult, error) {
	if minTags <= 0 {
		minTags = 3
	}
	res := AutoTagMissingResult{ProductsConsidered: len(products)}
	for _, p := range products {
		existing, _ := t.Repo.ListTagsForProduct(p.ID)
		if len(existing) >= minTags {
			continue
		}
		before := len(existing)
		newTags, err := t.TagOne(ctx, p)
		if err != nil {
			continue
		}
		added := len(newTags) - before
		if added > 0 {
			res.ProductsTouched++
			res.TagsAdded += added
		}
		if before < 3 {
			res.LLMCalls++
		}
	}
	return res, nil
}

// RuleTags is a deterministic baseline. Lightweight Cyrillic substring matching;
// good enough to cover ~70% of obvious cases (honey → "honey", "пасха" → "easter", …).
func RuleTags(p models.Product) []string {
	hay := strings.ToLower(p.Name + " " + p.Description)
	out := []string{}

	add := func(tags ...string) { out = append(out, tags...) }

	// category baselines
	switch p.Category {
	case "Мёд и пчеловодство":
		add("honey")
	case "Сыры":
		add("cheese")
	case "Хлеб и выпечка":
		add("bread_artisan")
	case "Мясо и птица":
		add("meat")
	case "Рыба и морепродукты":
		add("fish_fresh")
	case "Яйца и молочные продукты":
		add("dairy")
	case "Сладости":
		add("sweets")
	case "Овощи и фрукты":
		add("fresh", "vegetables")
	case "Заморозка":
		add("frozen")
	case "Напитки":
		add("beverage")
	case "Бакалея":
		add("pantry")
	}

	matchers := map[string][]string{
		"premium":             {"премиум", "premium", "выдержанн", "элитн"},
		"organic":             {"органическ", "био-", "без хими", "без пестицид"},
		"vegan":               {"веган"},
		"easter":              {"пасх", "кулич"},
		"christmas":           {"рожд"},
		"maslenitsa":          {"масленищ", "блин"},
		"new_year":            {"новогодн", "новый год"},
		"gift":                {"подароч", "подарок", "набор"},
		"kids_friendly":       {"детск", "малыш", "для детей"},
		"no_sugar":            {"без сахара"},
		"honey":               {"мёд", "медов"},
		"propolis":            {"прополис"},
		"mead":                {"медовух"},
		"cheese_aged":         {"выдержанн сыр", "пармезан", "грюйер"},
		"cheese_blue":         {"плесен", "blue", "горгонзол"},
		"cheese_fresh":        {"моцарел", "рикотт", "феттa"},
		"cottage_cheese":      {"творог"},
		"sour_cream":          {"сметан"},
		"butter":              {"масло сливочн"},
		"yogurt_live":         {"йогурт"},
		"kefir":               {"кефир"},
		"sausage_dry":         {"сыровял", "колбаса вяленая"},
		"smoked_meat":         {"копчен"},
		"smoked_fish":         {"копчен рыб"},
		"caviar":              {"икр"},
		"strawberry":          {"клубник", "земляник"},
		"raspberry":           {"малин"},
		"blueberry":           {"черник", "голубик"},
		"cherry":              {"вишн", "черешн"},
		"apple":               {"яблок", "яблочн"},
		"pumpkin":             {"тыкв"},
		"cranberry":           {"клюкв"},
		"lingonberry":         {"брусник"},
		"mushroom_dried":      {"сушен гриб"},
		"sauerkraut":          {"квашен капуст"},
		"pickled_cucumber":    {"солен огурец", "малосольн огурец"},
		"jam":                 {"варен", "конфитюр", "джем"},
		"granola":             {"гранола"},
		"nuts":                {"орех", "фундук", "миндаль", "кешью"},
		"dried_fruits":        {"сухофрукт", "финик", "курага", "чернослив"},
		"wine":                {"вино"},
		"kvass":               {"квас"},
		"kombucha":            {"комбуч", "чайн гриб"},
		"cider":               {"сидр"},
		"herbal_blend":        {"травян сбор", "травяной"},
		"tea":                 {"чай"},
		"plant_milk":          {"растительн молок"},
		"goose":               {"гусь", "гусятин"},
		"duck":                {"утк", "утин"},
		"lamb":                {"баран", "ягнятин"},
		"sturgeon":            {"осетр"},
		"sorrel":              {"щавел"},
		"nettle":              {"крапив"},
		"ramson":              {"черемш"},
		"radish":              {"редис"},
		"green_onion":         {"зелён лук"},
		"regional_specialty":  {"подмосков", "региональн"},
	}
	for tag, needles := range matchers {
		for _, n := range needles {
			if strings.Contains(hay, n) {
				add(tag)
				break
			}
		}
	}
	return dedup(out)
}

func dedup(in []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, s := range in {
		s = strings.ToLower(strings.TrimSpace(s))
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}
