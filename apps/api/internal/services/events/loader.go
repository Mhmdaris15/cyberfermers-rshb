package events

import (
	"os"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

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
func defaultSS(v, d []string) []string {
	if len(v) == 0 {
		return d
	}
	return v
}
