package events

import (
	"os"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// ----- events.yml -----------------------------------------------------

type yamlEvent struct {
	Slug           string    `yaml:"slug"`
	Title          string    `yaml:"title"`
	Type           string    `yaml:"type"`
	TypeDetail     string    `yaml:"type_detail"`
	StartDate      time.Time `yaml:"start_date"`
	EndDate        time.Time `yaml:"end_date"`
	Recurrence     string    `yaml:"recurrence"`
	PrepWindowDays int       `yaml:"prep_window_days"`
	Audience       []string  `yaml:"audience"`
	ProductTags    []string  `yaml:"product_tags"`
	Categories     []string  `yaml:"categories"`
	Channels       []string  `yaml:"channels"`
	Themes         []string  `yaml:"themes"`
	Color          string    `yaml:"color"`
	Icon           string    `yaml:"icon"`
}

func LoadFromYAML(path string) ([]models.Event, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var raw []yamlEvent
	if err := yaml.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	out := make([]models.Event, 0, len(raw))
	for _, y := range raw {
		out = append(out, models.Event{
			Slug:           y.Slug,
			Title:          y.Title,
			Type:           models.EventType(y.Type),
			TypeDetail:     y.TypeDetail,
			StartDate:      y.StartDate,
			EndDate:        endOrStart(y.EndDate, y.StartDate),
			Recurrence:     defaultS(y.Recurrence, "annual"),
			PrepWindowDays: defaultI(y.PrepWindowDays, 7),
			Audience:       y.Audience,
			ProductTags:    y.ProductTags,
			Categories:     y.Categories,
			Channels:       defaultSS(y.Channels, []string{"storefront", "story", "blog"}),
			Themes:         y.Themes,
			Color:          y.Color,
			Icon:           y.Icon,
		})
	}
	return out, nil
}

// ----- audiences.yml --------------------------------------------------

type yamlAudience struct {
	Slug        string   `yaml:"slug"`
	Label       string   `yaml:"label"`
	Description string   `yaml:"description"`
	IncomeBand  string   `yaml:"income_band"`
	Interests   []string `yaml:"interests"`
	AvgBasket   float64  `yaml:"avg_basket_rub"`
}

func LoadAudiences(path string) ([]models.Audience, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var raw []yamlAudience
	if err := yaml.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	out := make([]models.Audience, 0, len(raw))
	for _, y := range raw {
		out = append(out, models.Audience{
			Slug: y.Slug, Label: y.Label, Description: y.Description,
			IncomeBand: y.IncomeBand, Interests: y.Interests,
			AvgBasket: y.AvgBasket,
		})
	}
	return out, nil
}

// ----- trends.yml -----------------------------------------------------

// TrendInfluence is a small struct exported so cmd/seed can build the
// trend→event edges directly without reaching into the loader internals.
type TrendInfluence struct {
	Event    string  `yaml:"event"`
	Strength float64 `yaml:"strength"`
}

type yamlTrend struct {
	Slug         string           `yaml:"slug"`
	Title        string           `yaml:"title"`
	Description  string           `yaml:"description"`
	Source       string           `yaml:"source"`
	Strength     float64          `yaml:"strength"`
	StartedAt    time.Time        `yaml:"started_at"`
	HorizonDays  int              `yaml:"horizon_days"`
	AudienceTags []string         `yaml:"audience_tags"`
	ProductTags  []string         `yaml:"product_tags"`
	Influences   []TrendInfluence `yaml:"influences"`
}

type TrendWithEdges struct {
	Trend      models.Trend
	Influences []TrendInfluence
}

func LoadTrends(path string) ([]TrendWithEdges, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var raw []yamlTrend
	if err := yaml.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	out := make([]TrendWithEdges, 0, len(raw))
	for _, y := range raw {
		out = append(out, TrendWithEdges{
			Trend: models.Trend{
				Slug: y.Slug, Title: y.Title, Description: y.Description,
				Source: defaultS(y.Source, "editorial"),
				Strength: defaultF(y.Strength, 0.5),
				StartedAt: y.StartedAt,
				HorizonDays: defaultI(y.HorizonDays, 60),
				AudienceTags: y.AudienceTags, ProductTags: y.ProductTags,
			},
			Influences: y.Influences,
		})
	}
	return out, nil
}

// ----- seasonal_windows.yml ------------------------------------------

type yamlSeasonalWindow struct {
	ProductConcept string   `yaml:"product_concept"`
	Label          string   `yaml:"label"`
	Months         []int    `yaml:"months"`
	Scope          []string `yaml:"scope"`
	Status         string   `yaml:"status"`
	Note           string   `yaml:"note"`
	Covers         []string `yaml:"covers"`
}

type SeasonalWindowWithEdges struct {
	Window models.SeasonalWindow
	Covers []string // event slugs
}

func LoadSeasonalWindows(path string) ([]SeasonalWindowWithEdges, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var raw []yamlSeasonalWindow
	if err := yaml.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	out := make([]SeasonalWindowWithEdges, 0, len(raw))
	for _, y := range raw {
		out = append(out, SeasonalWindowWithEdges{
			Window: models.SeasonalWindow{
				Label: y.Label, ProductConcept: y.ProductConcept,
				Months: y.Months, Scope: y.Scope,
				Status: defaultS(y.Status, "peak"),
				Note:   y.Note,
			},
			Covers: y.Covers,
		})
	}
	return out, nil
}

// ----- helpers --------------------------------------------------------

func endOrStart(end, start time.Time) time.Time {
	if end.IsZero() {
		return start.Add(24 * time.Hour)
	}
	return end
}
func defaultS(v, d string) string {
	if v == "" {
		return d
	}
	return v
}
func defaultI(v, d int) int {
	if v == 0 {
		return d
	}
	return v
}
func defaultF(v, d float64) float64 {
	if v == 0 {
		return d
	}
	return v
}
func defaultSS(v, d []string) []string {
	if len(v) == 0 {
		return d
	}
	return v
}
