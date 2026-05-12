package plan

import (
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

type Service struct {
	Repo *db.Repo
}

func New(repo *db.Repo) *Service { return &Service{Repo: repo} }

// AddCard persists a new plan_card (or refreshes an existing one) for a given
// suggestion. We also persist the suggestion itself if it hasn't been yet —
// the calendar endpoint hands back transient suggestions.
func (s *Service) AddCard(farmerID string, sug *models.Suggestion, column, note string) (*models.PlanCard, error) {
	sug.Status = column
	if sug.ID == "" {
		id, err := s.Repo.CreateSuggestion(sug)
		if err != nil {
			return nil, err
		}
		sug.ID = id
	}
	card := &models.PlanCard{
		FarmerID:     farmerID,
		SuggestionID: sug.ID,
		Column:       column,
		Note:         note,
	}
	id, err := s.Repo.UpsertPlanCard(card)
	if err != nil {
		return nil, err
	}
	card.ID = id
	return card, nil
}

// Move updates the kanban column / position for an existing card.
func (s *Service) Move(card *models.PlanCard) error {
	_, err := s.Repo.UpsertPlanCard(card)
	return err
}

// Board returns the full kanban grouped by column. Each card is hydrated with
// its Suggestion + nested Event in a single bulk query — avoids N+1 reads.
func (s *Service) Board(farmerID string) (map[string][]models.PlanCard, error) {
	cards, err := s.Repo.ListPlanByFarmer(farmerID)
	if err != nil {
		return nil, err
	}

	// Bulk-load all suggestions referenced by these cards.
	sugIDs := make([]string, 0, len(cards))
	seen := make(map[string]bool, len(cards))
	for _, c := range cards {
		if c.SuggestionID != "" && !seen[c.SuggestionID] {
			sugIDs = append(sugIDs, c.SuggestionID)
			seen[c.SuggestionID] = true
		}
	}
	sugMap, _ := s.Repo.GetSuggestionsByIDs(sugIDs)
	for i := range cards {
		if sug, ok := sugMap[cards[i].SuggestionID]; ok {
			cards[i].Suggestion = sug
		}
	}

	out := map[string][]models.PlanCard{
		"proposed": {}, "planned": {}, "live": {}, "completed": {},
	}
	for _, c := range cards {
		col := c.Column
		if col == "" {
			col = "proposed"
		}
		out[col] = append(out[col], c)
	}
	return out, nil
}
