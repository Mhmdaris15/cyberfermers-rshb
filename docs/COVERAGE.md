# Coverage matrix — Case 1 scoring criteria

Each row maps to a rubric line and points at the file(s) that earn it.

## Business (12 pts)

| # | Criterion | Max | Status | Evidence |
|---|---|---|---|---|
| 1 | Relevance to task — seasonality, holidays, info-posts, marketplace trends | 3 | ✅ | `data/seed/events.yml` covers all six event types; `Landing.tsx` + `Dashboard.tsx` show them visibly |
| 2 | UX — intuitive UI, low-friction, hints, adapts to farmer | 3 | ✅ | Single click from calendar → action sheet → "generate" → "add to plan"; `EmptyState` hints for novices |
| 3 | Completeness — event types coverage | 3 | ✅ | 40+ events, 6 categories; see "Event categories covered" below |
| 4 | Business value — sales growth, ROI, examples per category | 3 | ✅ | `recommendation/roi.go`; `RoiPanel.tsx` shows formula + assumption tooltips on each number |

### Event categories covered

- ✅ State holidays — New Year, 23 Feb, 8 March, Victory Day, Russia Day, Unity Day, Cosmonautics, Family Day, Knowledge Day…
- ✅ Orthodox holidays — Christmas, Maslenitsa, Easter (Bright Week), three Spases, Tatiana Day, Great Lent
- ✅ Professional days — Chef's Day, Farmer's Day, World Vegan Day, World Bread Day
- ✅ Seasons — Spring greens, Summer berries, Mushroom season, Autumn harvest, Winter pickles
- ✅ Themed weeks — Cheese, Ferment, Healthy breakfast, BBQ, Vegan
- ✅ Marketplace trends — Subscription launch, Regional spotlight (Moscow), Gift collection, Kids snacks

### Categories from `farmers_sku.xlsx` handled by the matcher

All 11 categories are covered by at least one rule-based tag bucket in `tagging/tagger.go`:
Сладости, Бакалея, Мясо и птица, Овощи и фрукты, Сыры, Яйца и молочные продукты, Заморозка, Рыба и морепродукты, Мёд и пчеловодство, Хлеб и выпечка, Напитки.

## Technical (17 pts)

| # | Criterion | Max | Status | Evidence |
|---|---|---|---|---|
| 1 | Event-marketing solution quality | 6 | ✅ | 3-tier matcher in `recommendation/match.go` + 6-channel structured fan-out in `services/ai/content.go` |
| 2 | Code/architecture quality | 4 | ✅ | Hexagonal split: handlers → services → repo; DTOs in `models`; prompts versioned via `PromptVersion` |
| 3 | Additional functionality | 4 | 🟡 | Implemented: A/B-ready variant column, deterministic fallback, embedding cache scaffold. Roadmap: subscription nudge, Telegram bot, bundle generator, calendar export |
| 4 | Presentation | 3 | ✅ | `docs/DEMO_SCRIPT.md`; landing page with cinematic scroll + seasonality ring as the hero |

## Differentiators worth mentioning in the deck

1. **Deterministic ROI engine** — every number on the screen ties back to an Assumption row. Judges love to poke at it.
2. **Dual tagging** — rules first (cheap, debuggable), LLM only when rules underperform; LLM tags stored with `source="llm"` so they can be reviewed.
3. **Structured JSON everywhere** — no `gpt.then(text)` parsing; `responseSchema` enforces shape server-side.
4. **Visual identity** — hand-rolled SVG seasonality ring; dark agri-tech palette tuned to look unmistakably *not* a generic dashboard template.
5. **Robust demo** — every Gemini call has a deterministic fallback. Demo never hangs on flaky Wi-Fi.
