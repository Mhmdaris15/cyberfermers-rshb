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
// suggestion. Side effects:
//   - writes an ai_memory row so the recommender remembers what the farmer
//     accepts and can bias future scoring
//   - emits a `created` plan_card_activity event for the audit timeline
//
// `userID` is the authenticated caller (empty string is acceptable for
// pre-auth code paths) — recorded as the activity author.
func (s *Service) AddCard(farmerID, userID string, sug *models.Suggestion, card *models.PlanCard) (*models.PlanCard, error) {
	sug.Status = card.Column
	if sug.ID == "" {
		id, err := s.Repo.CreateSuggestion(sug)
		if err != nil {
			return nil, err
		}
		sug.ID = id
	}
	// Stitch the suggestion + farmer onto the caller-supplied card; the
	// rest of the rich fields (board_type, title, due_date, ...) flow
	// through untouched.
	card.FarmerID = farmerID
	card.SuggestionID = sug.ID
	if card.CreatedBy == nil && userID != "" {
		uid := userID
		card.CreatedBy = &uid
	}
	id, err := s.Repo.UpsertPlanCard(card)
	if err != nil {
		return nil, err
	}
	card.ID = id

	// Memory write: kind = "campaign_<column>", signal = column rank.
	s.appendMemory(farmerID, sug.ID, "campaign_"+card.Column, memorySignal[card.Column], map[string]any{
		"event_id": sug.EventID,
		"products": len(sug.Products),
		"score":    sug.Score,
	})

	// Activity: `created` — fire-and-forget like the memory write.
	go func(cid, uid, board, col string) {
		if err := s.Repo.AppendPlanCardActivity(cid, "created", uid, map[string]any{
			"board_type": board,
			"column":     col,
		}); err != nil {
			log.Warn().Err(err).Str("card_id", cid).Msg("activity write failed (non-fatal)")
		}
	}(id, userID, card.BoardType, card.Column)

	return card, nil
}

// Move updates the kanban column / position for an existing card.
// Side effects:
//   - writes an ai_memory row reflecting the new state
//   - emits a `moved` plan_card_activity event (payload includes the
//     prior column when the caller supplies it via card.previousColumn —
//     today the FE passes only the new column, so `from` may be empty)
//
// `userID` is the authenticated caller; recorded as the activity author.
// `previousColumn` is optional and surfaces in the audit payload when known.
func (s *Service) Move(card *models.PlanCard, userID, previousColumn string) error {
	if _, err := s.Repo.UpsertPlanCard(card); err != nil {
		return err
	}
	if card.Column != "" && card.SuggestionID != "" {
		s.appendMemory(card.FarmerID, card.SuggestionID, "campaign_"+card.Column,
			memorySignal[card.Column], map[string]any{"position": card.Position})
	}

	go func(cid, uid, from, to string) {
		if err := s.Repo.AppendPlanCardActivity(cid, "moved", uid, map[string]any{
			"from": from,
			"to":   to,
		}); err != nil {
			log.Warn().Err(err).Str("card_id", cid).Msg("activity write failed (non-fatal)")
		}
	}(card.ID, userID, previousColumn, card.Column)

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
//
// `boardType` filters to a single board (campaign/seasonal/social/...).
// Pass "" to return all boards combined (legacy behavior).
func (s *Service) Board(farmerID, boardType string) (map[string][]models.PlanCard, error) {
	cards, err := s.Repo.ListPlanByFarmer(farmerID, boardType)
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
