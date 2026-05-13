package plan

import (
	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

type Service struct {
	Repo *db.Repo
}

func New(repo *db.Repo) *Service { return &Service{Repo: repo} }

// memorySignal maps a kanban column to a normalized contextual-intelligence
// signal in [-1, 1]. The recommender reads these via EventBiasFromMemory.
var memorySignal = map[string]float64{
	"proposed":  0.05,
	"planned":   0.40,
	"live":      0.80,
	"completed": 1.00,
}

// AddCard persists a new plan_card (or refreshes an existing one) for a given
// suggestion. Side effect: writes a memory row so the recommender remembers
// what the farmer accepts and can bias future scoring.
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

	// Memory write: kind = "campaign_<column>", signal = column rank.
	s.appendMemory(farmerID, sug.ID, "campaign_"+column, memorySignal[column], map[string]any{
		"event_id": sug.EventID,
		"products": len(sug.Products),
		"score":    sug.Score,
	})
	return card, nil
}

// Move updates the kanban column / position for an existing card and writes
// a memory row reflecting the new state.
func (s *Service) Move(card *models.PlanCard) error {
	if _, err := s.Repo.UpsertPlanCard(card); err != nil {
		return err
	}
	if card.Column != "" && card.SuggestionID != "" {
		s.appendMemory(card.FarmerID, card.SuggestionID, "campaign_"+card.Column,
			memorySignal[card.Column], map[string]any{"position": card.Position})
	}
	return nil
}

// appendMemory is fire-and-forget; failures here never block user flow.
func (s *Service) appendMemory(farmerID, suggestionID, kind string, signal float64, ctx map[string]any) {
	err := s.Repo.AppendMemory(&models.AIMemory{
		FarmerID:  farmerID,
		Kind:      kind,
		SubjectID: suggestionID,
		Signal:    signal,
		Context:   ctx,
	})
	if err != nil {
		log.Warn().Err(err).Str("kind", kind).Msg("ai_memory write failed (non-fatal)")
	}
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
