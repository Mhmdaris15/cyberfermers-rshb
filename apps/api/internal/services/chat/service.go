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
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/services/plan"
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

// SystemRU is the strategist persona prompt. It is intentionally long
// — the LLM's character is set here, not by client wrappers. The prompt
// is dynamic: per-turn session state (events/SKUs/numbers surfaced by
// earlier tool calls) is appended live in buildTurnSystem().
const SystemRU = `Ты — AI-маркетинг-стратег маркетплейса «Своё Родное», встроенный в кабинет фермера.
Думай как маркетолог его магазина. Помогаешь продавать больше с минимумом усилий.

ТВОЯ РОЛЬ
— стратег, а не справочник: в каждом ответе предлагай следующий шаг
— консультант, а не автоответчик: оперируй конкретными цифрами, датами, slug'ами SKU и событий
— на стороне фермера: говори по-деловому, как партнёр

ИНСТРУМЕНТЫ (ВСЕГДА используй перед любыми утверждениями о данных)
• find_events_semantic — для тематических, синонимических и сокращённых запросов:
    "НГ" → Новый год, "зимние праздники" → Святки/Рождество, "медовая тема" → Спас, Пасечник
• get_upcoming_events — когда задано прямое окно ("что в мае?", "ближайшие 30 дней")
• get_skus_matching — какие SKU фермера подходят под событие или тег
• get_insights — где пробелы/риски в каталоге
• get_plan_status — что уже в работе на канбане
• simulate_promo — what-if по скидке/каналам
• create_plan_card_for_event — РЕАЛЬНО создаёт карточку плана. Зови только когда
  фермер явно согласен ("да", "добавь", "запланируй", "берём", "ок")

ПАМЯТЬ И КОНТЕКСТ
— в начале каждого ответа держи в голове, что уже обсуждали в этом диалоге
— команды "ещё", "следующий", "а если..." — продолжение прошлого контекста, не новый поиск
— если на прошлых шагах поднимался slug/SKU id — используй его сразу, не переспрашивай

СТИЛЬ И ТОН
— по-русски, 2-5 предложений, без воды и формальностей ("уважаемый" — нет)
— конкретно: "Пасха 16 апреля. У вас 4 SKU подходят. Прогноз +28 заказов / +43 200 ₽"
— если у инструмента нет данных — честно скажи и предложи, что уточнить
— списки максимум 5 пунктов, иначе сворачивай

СЛЕДУЮЩИЕ ШАГИ (followups)
В конце КАЖДОГО ответа (если уместно) добавляй 2-3 коротких следующих действия,
строго в формате — каждое с новой строки, начинается с символа ▸ и до 6 слов:
▸ Сгенерировать пуш для Пасхи
▸ Добавить карточку в план
▸ Сравнить с 15% скидкой
Эти строки UI отрендерит как кнопки. Не нумеруй их, не объясняй.

ЗАПРЕЩЕНО
— выдумывать числа, события, SKU, "+25 заказов", "10%" без вызова инструмента
— отвечать "не знаю, спросите в поддержке" — лучше вызови подходящий tool
— говорить вне домена (политика, погода, IT) — мягко переадресуй маркетинговым вопросом
— повторять текст вопроса дословно`

type Service struct {
	Repo     *db.Repo
	AI       *ai.Client
	Insights *insights.Engine
	Plan     *plan.Service
	tools    []Tool
}

func New(repo *db.Repo, aiClient *ai.Client, ins *insights.Engine, plansvc *plan.Service) *Service {
	return &Service{Repo: repo, AI: aiClient, Insights: ins, Plan: plansvc, tools: Registry()}
}

// Reply is one chat turn's outbound payload to the FE.
type Reply struct {
	Text      string         `json:"text"`
	Followups []string       `json:"followups"` // suggested next prompts, parsed from ▸ lines
	Actions   []Action       `json:"actions"`
	Used      []string       `json:"used"`     // tool names invoked
	Evidence  map[string]any `json:"evidence"` // raw tool results, for transparency
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
func (s *Service) Answer(ctx context.Context, farmerID, userID string, history []Message, userText string) (*Reply, error) {
	if s.AI == nil || s.AI.APIKey == "" {
		return &Reply{
			Text:      "AI-ассистент не подключён (нет GEMINI_API_KEY). Спросите ещё раз после конфигурации.",
			Followups: []string{},
			Actions:   []Action{},
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

	tctx := ToolCtx{
		FarmerID: farmerID,
		UserID:   userID,
		Repo:     s.Repo,
		AI:       s.AI,
		Insights: s.Insights,
		Plan:     s.Plan,
		ctx:      ctx,
	}
	decls := Declarations(s.tools)
	used := []string{}
	evidence := map[string]any{}

	for turn := 0; turn < maxToolTurns; turn++ {
		// Dynamic system prompt: base persona + session-state derived from
		// evidence accumulated by tools so far. This is what makes the
		// assistant "remember" things across the tool loop without a DB.
		sysPrompt := SystemRU + sessionStateBlock(evidence)

		callCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
		resp, err := s.AI.ChatTurn(callCtx, sysPrompt, conv, decls)
		cancel()
		if err != nil {
			log.Warn().Err(err).Msg("chat turn failed")
			return &Reply{
				Text:      "Не получилось получить ответ от AI. Попробуйте переформулировать вопрос.",
				Followups: []string{},
				Actions:   []Action{},
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
			clean, followups := extractFollowups(text)
			return &Reply{
				Text:      clean,
				Followups: followups,
				Actions:   s.synthesizeActions(farmerID, used, evidence),
				Used:      used,
				Evidence:  evidence,
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
	clean, followups := extractFollowups(last)
	return &Reply{
		Text:      clean,
		Followups: followups,
		Actions:   s.synthesizeActions(farmerID, used, evidence),
		Used:      used,
		Evidence:  evidence,
	}, nil
}

// extractFollowups pulls out ▸-prefixed lines and returns the cleaned
// body plus the list of followups (max 4, each ≤80 chars). Followups
// can appear anywhere in the reply but conventionally are at the end.
func extractFollowups(text string) (string, []string) {
	lines := strings.Split(text, "\n")
	body := make([]string, 0, len(lines))
	fups := make([]string, 0, 4)
	for _, ln := range lines {
		trim := strings.TrimSpace(ln)
		// Tolerate a few common bullet glyphs the model might pick.
		for _, p := range []string{"▸ ", "▸", "▶ ", "→ ", "• ", "- ▸ "} {
			if strings.HasPrefix(trim, p) {
				cand := strings.TrimSpace(strings.TrimPrefix(trim, p))
				if cand != "" && len(cand) <= 80 && len(fups) < 4 {
					fups = append(fups, cand)
				}
				trim = "" // mark as consumed
				break
			}
		}
		if trim != "" {
			body = append(body, ln)
		}
	}
	return strings.TrimSpace(strings.Join(body, "\n")), fups
}

// sessionStateBlock condenses evidence collected from prior tool calls
// into a compact RU-formatted block so the LLM can ground follow-ups
// against state from earlier turns without re-running tools.
//
// Kept under ~400 chars: only the most-recent slug, event title, matched
// SKU sample, and lift numbers — enough to answer "ещё один" or "а если".
func sessionStateBlock(evidence map[string]any) string {
	if len(evidence) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n\nСОСТОЯНИЕ СЕССИИ (используй для follow-up без повторного поиска):\n")
	added := 0
	pull := func(toolName, label string, extract func(map[string]any) string) {
		raw, ok := evidence[toolName].(map[string]any)
		if !ok {
			return
		}
		line := extract(raw)
		if line == "" {
			return
		}
		b.WriteString("• ")
		b.WriteString(label)
		b.WriteString(": ")
		b.WriteString(line)
		b.WriteString("\n")
		added++
	}
	pull("find_events_semantic", "найдены события", func(r map[string]any) string {
		evs, _ := r["events"].([]any)
		var parts []string
		for i, ev := range evs {
			if i >= 3 {
				break
			}
			if m, ok := ev.(map[string]any); ok {
				slug, _ := m["slug"].(string)
				title, _ := m["title"].(string)
				if slug != "" {
					parts = append(parts, title+" ("+slug+")")
				}
			}
		}
		return strings.Join(parts, ", ")
	})
	pull("get_upcoming_events", "ближайшие события", func(r map[string]any) string {
		evs, _ := r["events"].([]any)
		var parts []string
		for i, ev := range evs {
			if i >= 3 {
				break
			}
			if m, ok := ev.(map[string]any); ok {
				title, _ := m["title"].(string)
				slug, _ := m["slug"].(string)
				start, _ := m["start_date"].(string)
				if slug != "" {
					parts = append(parts, fmt.Sprintf("%s (%s, %s)", title, slug, start))
				}
			}
		}
		return strings.Join(parts, ", ")
	})
	pull("get_skus_matching", "подобранные SKU", func(r map[string]any) string {
		evs, _ := r["matched"].([]any)
		var parts []string
		for i, ev := range evs {
			if i >= 4 {
				break
			}
			if m, ok := ev.(map[string]any); ok {
				name, _ := m["name"].(string)
				if name != "" {
					parts = append(parts, name)
				}
			}
		}
		slug, _ := r["event_slug"].(string)
		if slug != "" {
			parts = append(parts, "для "+slug)
		}
		return strings.Join(parts, ", ")
	})
	pull("simulate_promo", "симуляция", func(r map[string]any) string {
		ev, _ := r["event"].(string)
		if base, ok := r["baseline"].(map[string]any); ok {
			od, _ := base["orders_delta"]
			rd, _ := base["revenue_delta"]
			return fmt.Sprintf("%s — baseline +%v заказов / +%v ₽", ev, od, rd)
		}
		return ev
	})
	pull("create_plan_card_for_event", "создана карточка", func(r map[string]any) string {
		title, _ := r["event_title"].(string)
		col, _ := r["column"].(string)
		id, _ := r["plan_card_id"].(string)
		return fmt.Sprintf("%s → колонка %s (id %s)", title, col, id)
	})
	if added == 0 {
		return ""
	}
	return b.String()
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
		case "find_events_semantic":
			if r, ok := evidence[name].(map[string]any); ok {
				if evs, ok := r["events"].([]any); ok && len(evs) > 0 {
					if first, ok := evs[0].(map[string]any); ok {
						if slug, _ := first["slug"].(string); slug != "" {
							out = append(out, Action{
								Label: "Открыть событие",
								Href:  fmt.Sprintf("/farmer/%s/calendar?event=%s", farmerID, slug),
							})
						}
					}
				}
			}
		case "simulate_promo":
			out = append(out, Action{
				Label: "Открыть кампанию",
				Href:  fmt.Sprintf("/farmer/%s/dashboard", farmerID),
			})
		case "create_plan_card_for_event":
			out = append(out, Action{
				Label: "Открыть план",
				Href:  fmt.Sprintf("/farmer/%s/plan", farmerID),
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
