package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/ai"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/insights"
)

// =====================================================================
//   Chat service — grounded Q&A over the farmer's own data.
//
//   Flow per user message:
//     1. user msg → LLM (with tool decls)
//     2. if response is FunctionCall → execute → append functionResponse
//     3. LLM again → expect text
//     4. parse text + emit chips deep-linking into the app
//
//   We cap the agent loop at 3 tool turns to bound latency and cost.
// =====================================================================

const SystemRU = `Ты — AI-маркетинг-ассистент маркетплейса «Своё Родное», встроенный в кабинет фермера.
Отвечай только на русском, кратко (≤3 предложения).
Опирайся на инструменты — не выдумывай ни события, ни товары, ни числа.
Если вопрос вне твоего домена (политика, погода, IT-поддержка) — вежливо переадресуй.
Когда есть конкретные SKU/события/инсайты — обязательно вызывай инструмент, не отвечай по памяти.
В конце ответа допустимо предложить 1-2 следующих действия (chip) — но только тех, что реально полезны.`

type Service struct {
	Repo     *db.Repo
	AI       *ai.Client
	Insights *insights.Engine
	tools    []Tool
}

func New(repo *db.Repo, aiClient *ai.Client, ins *insights.Engine) *Service {
	return &Service{Repo: repo, AI: aiClient, Insights: ins, tools: Registry()}
}

// Reply is one chat turn's outbound payload to the FE.
type Reply struct {
	Text     string         `json:"text"`
	Actions  []Action       `json:"actions"`
	Used     []string       `json:"used"`     // tool names invoked
	Evidence map[string]any `json:"evidence"` // raw tool results, for transparency
}

// Action is a deep-link chip rendered next to the chat reply.
type Action struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

// Message is a single transcript entry from the FE.
type Message struct {
	Role string `json:"role"` // user | model
	Text string `json:"text"`
}

const maxToolTurns = 3

// Answer drives the agentic loop. Returns the final assistant reply + any
// chips synthesized from the tools that were called.
func (s *Service) Answer(ctx context.Context, farmerID string, history []Message, userText string) (*Reply, error) {
	if s.AI == nil || s.AI.APIKey == "" {
		return &Reply{
			Text:    "AI-ассистент не подключён (нет GEMINI_API_KEY). Спросите ещё раз после конфигурации.",
			Actions: []Action{},
		}, nil
	}

	// Build the Gemini-shaped history.
	conv := make([]ai.Content, 0, len(history)+1)
	for _, m := range history {
		role := m.Role
		if role == "assistant" {
			role = "model"
		}
		conv = append(conv, ai.Content{Role: role, Parts: []ai.Part{{Text: m.Text}}})
	}
	conv = append(conv, ai.Content{Role: "user", Parts: []ai.Part{{Text: userText}}})

	tctx := ToolCtx{FarmerID: farmerID, Repo: s.Repo, Insights: s.Insights}
	decls := Declarations(s.tools)
	used := []string{}
	evidence := map[string]any{}

	for turn := 0; turn < maxToolTurns; turn++ {
		callCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
		resp, err := s.AI.ChatTurn(callCtx, SystemRU, conv, decls)
		cancel()
		if err != nil {
			log.Warn().Err(err).Msg("chat turn failed")
			return &Reply{
				Text:    "Не получилось получить ответ от AI. Попробуйте переформулировать вопрос.",
				Actions: []Action{},
			}, nil
		}
		// Find a functionCall in the parts; if none, take text and we're done.
		var fc *ai.FunctionCall
		var text string
		for _, p := range resp.Parts {
			if p.FunctionCall != nil {
				fc = p.FunctionCall
			}
			if p.Text != "" {
				text += p.Text
			}
		}
		conv = append(conv, resp)

		if fc == nil {
			// Reached final text answer.
			return &Reply{
				Text:     strings.TrimSpace(text),
				Actions:  s.synthesizeActions(farmerID, used, evidence),
				Used:     used,
				Evidence: evidence,
			}, nil
		}

		// Execute the tool.
		t, ok := s.toolByName(fc.Name)
		if !ok {
			conv = append(conv, ai.Content{Role: "function", Parts: []ai.Part{{
				FunctionResponse: &ai.FunctionResponse{Name: fc.Name, Response: map[string]any{"error": "tool not found"}},
			}}})
			continue
		}
		result, err := t.Run(tctx, fc.Args)
		if err != nil {
			result = map[string]any{"error": err.Error()}
		}
		used = append(used, fc.Name)
		evidence[fc.Name] = result
		conv = append(conv, ai.Content{Role: "function", Parts: []ai.Part{{
			FunctionResponse: &ai.FunctionResponse{Name: fc.Name, Response: result},
		}}})
	}

	// Hit the loop cap — return whatever the model said in the last text Part.
	last := ""
	for _, p := range conv[len(conv)-1].Parts {
		if p.Text != "" {
			last = p.Text
		}
	}
	if last == "" {
		last = "Не получилось довести ответ до конца (превышен лимит шагов). Попробуйте более узкий вопрос."
	}
	return &Reply{Text: last, Actions: s.synthesizeActions(farmerID, used, evidence), Used: used, Evidence: evidence}, nil
}

// synthesizeActions inspects the evidence to surface deep-link chips. Heuristic:
// if the model invoked get_skus_matching with an event_slug → chip into calendar
// for that slug. If insights tool was used → chip into the insights page.
func (s *Service) synthesizeActions(farmerID string, used []string, evidence map[string]any) []Action {
	out := []Action{}
	for _, name := range used {
		switch name {
		case "get_skus_matching":
			if r, ok := evidence[name].(map[string]any); ok {
				if slug, _ := r["event_slug"].(string); slug != "" {
					out = append(out, Action{
						Label: "Открыть событие",
						Href:  fmt.Sprintf("/farmer/%s/calendar?event=%s", farmerID, slug),
					})
				}
			}
		case "get_insights":
			out = append(out, Action{
				Label: "Все инсайты",
				Href:  fmt.Sprintf("/farmer/%s/ai", farmerID),
			})
		case "get_plan_status":
			out = append(out, Action{
				Label: "План кампаний",
				Href:  fmt.Sprintf("/farmer/%s/plan", farmerID),
			})
		case "get_upcoming_events":
			out = append(out, Action{
				Label: "Календарь",
				Href:  fmt.Sprintf("/farmer/%s/calendar", farmerID),
			})
		case "simulate_promo":
			out = append(out, Action{
				Label: "Открыть кампанию",
				Href:  fmt.Sprintf("/farmer/%s/dashboard", farmerID),
			})
		}
	}
	// Deduplicate by href (keep first).
	seen := map[string]bool{}
	dedup := []Action{}
	for _, a := range out {
		if seen[a.Href] {
			continue
		}
		seen[a.Href] = true
		dedup = append(dedup, a)
	}
	return dedup
}

func (s *Service) toolByName(name string) (Tool, bool) {
	for _, t := range s.tools {
		if t.Decl.Name == name {
			return t, true
		}
	}
	return Tool{}, false
}

// debug helper, intentionally unexported
var _ = json.Marshal
