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
