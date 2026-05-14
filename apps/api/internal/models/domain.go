package models

import "time"

// ---- core ----------------------------------------------------------

type Farmer struct {
	ID             string    `json:"id"`
	OrganizationID int       `json:"organization_id"`
	ShopName       string    `json:"shop_name"`
	Description    string    `json:"description,omitempty"`
	Region         string    `json:"region"`
	URL            string    `json:"url,omitempty"`
	Channels       []string  `json:"channels"`
	AudienceFocus  []string  `json:"audience_focus"`
	RiskAppetite   string    `json:"risk_appetite"`
	CreatedAt      time.Time `json:"created_at"`
	ProductCount   int       `json:"product_count,omitempty"`
	Categories     []string  `json:"categories,omitempty"`
	// AIReadinessScore 0-100 — % of SKUs with ≥3 distinct tags.
	AIReadinessScore int `json:"ai_readiness_score,omitempty"`
	// SeasonalOpportunityScore 0-100 — events in next 60 days that overlap
	// with the farmer's categories (capped at 20 events = 100%).
	SeasonalOpportunityScore int `json:"seasonal_opportunity_score,omitempty"`
}

type Product struct {
	ID          string    `json:"id"`
	ProductID   int       `json:"product_id"`
	FarmerID    string    `json:"farmer_id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Category    string    `json:"category"`
	URL         string    `json:"url,omitempty"`
	Tags        []string  `json:"tags,omitempty"`
	Embedding   []float64 `json:"embedding,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type ProductTag struct {
	Product    string  `json:"product"`
	Tag        string  `json:"tag"`
	Source     string  `json:"source"`
	Confidence float64 `json:"confidence"`
}

// ---- events --------------------------------------------------------

type EventType string

const (
	EventHoliday      EventType = "holiday"
	EventSeason       EventType = "season"
	EventThemedWeek   EventType = "themed_week"
	EventTrend        EventType = "trend"
	EventProfessional EventType = "professional"
)

type Event struct {
	ID              string    `json:"id"`
	Slug            string    `json:"slug"`
	Title           string    `json:"title"`
	Type            EventType `json:"type"`
	TypeDetail      string    `json:"type_detail,omitempty"`
	StartDate       time.Time `json:"start_date"`
	EndDate         time.Time `json:"end_date"`
	Recurrence      string    `json:"recurrence"`
	PrepWindowDays  int       `json:"prep_window_days"`
	Audience        []string  `json:"audience"`
	ProductTags     []string  `json:"product_tags"`
	Categories      []string  `json:"categories"`
	Channels        []string  `json:"channels"`
	Themes          []string  `json:"themes,omitempty"`
	Color           string    `json:"color,omitempty"`
	Icon            string    `json:"icon,omitempty"`
	Embedding       []float64 `json:"embedding,omitempty"`
}

// ---- suggestions / actions ----------------------------------------

type Promo struct {
	DiscountPct int    `json:"discount_pct"`
	PromoCode   string `json:"promo_code,omitempty"`
	BundleSize  int    `json:"bundle_size,omitempty"`
}

type Assumption struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
	Unit  string  `json:"unit"`
	Note  string  `json:"note,omitempty"`
}

type PredictedLift struct {
	OrdersDelta  float64      `json:"orders_delta"`
	RevenueDelta float64      `json:"revenue_delta"`
	Confidence   float64      `json:"confidence"`
	Assumptions  []Assumption `json:"assumptions"`
	// ChannelMix[channel] = absolute Δorders attributable to that channel.
	// Summed across channels equals OrdersDelta. Powers the per-channel
	// breakdown bar in the FE RoiPanel.
	ChannelMix map[string]float64 `json:"channel_mix,omitempty"`
}

type Suggestion struct {
	ID              string              `json:"id"`
	FarmerID        string              `json:"farmer_id"`
	EventID         string              `json:"event_id"`
	Event           *Event              `json:"event,omitempty"`
	Products        []Product           `json:"products,omitempty"`
	ProductIDs      []string            `json:"product_ids"`
	Channels        []string            `json:"channels"`
	DateWindowStart time.Time           `json:"date_window_start"`
	DateWindowEnd   time.Time           `json:"date_window_end"`
	Promo           Promo               `json:"promo"`
	PredictedLift   PredictedLift       `json:"predicted_lift"`
	Score           float64             `json:"score"`
	Status          string              `json:"status"`
	CreatedAt       time.Time           `json:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at"`
	// ProductReasons[product_id] = ["tag-match:3","category:Сыры",…] — emitted
	// by the matcher and shown under each SKU as small chips on the FE.
	ProductReasons map[string][]string `json:"product_reasons,omitempty"`
}

// ---- generated content --------------------------------------------

type Channel string

const (
	ChPush   Channel = "push"
	ChStory  Channel = "story"
	ChBlog   Channel = "blog"
	ChRecipe Channel = "recipe"
	ChChat   Channel = "chat"
	ChSocial Channel = "social"
	ChEmail  Channel = "email"
)

type PushContent struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}
type StoryContent struct {
	Caption     string `json:"caption"`
	ImagePrompt string `json:"image_prompt"`
}
type BlogContent struct {
	Title   string   `json:"title"`
	Lede    string   `json:"lede"`
	Body    string   `json:"body"`
	Hashtag []string `json:"hashtags,omitempty"`
}
type RecipeContent struct {
	Name        string   `json:"name"`
	Yield       string   `json:"yield"`
	Time        string   `json:"time"`
	Ingredients []string `json:"ingredients"`
	Steps       []string `json:"steps"`
}
type ChatContent struct {
	Segment string `json:"segment"`
	Message string `json:"message"`
}
type SocialContent struct {
	Title    string   `json:"title"`
	Text     string   `json:"text"`
	Hashtags []string `json:"hashtags"`
}

// Content lifecycle values. Mirrors the SurrealDB ASSERT.
const (
	ContentStatusDraft     = "draft"
	ContentStatusPublished = "published"
	ContentStatusArchived  = "archived"
)

type GeneratedContent struct {
	ID            string         `json:"id"`
	SuggestionID  string         `json:"suggestion_id"`
	Channel       Channel        `json:"channel"`
	Variant       int            `json:"variant"`
	Body          map[string]any `json:"body"`
	Model         string         `json:"model"`
	PromptVersion string         `json:"prompt_version"`
	CreatedAt     time.Time      `json:"created_at"`

	// Phase-2 lifecycle additions. Pointer-time fields are nil when the
	// transition has not happened yet (e.g. PublishedAt nil while status=draft).
	Status          string     `json:"status"`
	CurrentRevision int        `json:"current_revision"`
	IsUserEdited    bool       `json:"is_user_edited"`
	PublishedAt     *time.Time `json:"published_at,omitempty"`
	ArchivedAt      *time.Time `json:"archived_at,omitempty"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ContentRevision is an append-only audit log of every write to a
// generated_content row. author == nil means AI-generated; concrete
// author means human edit/restore.
type ContentRevision struct {
	ID             string         `json:"id"`
	ContentID      string         `json:"content_id"`
	RevisionNumber int            `json:"revision_number"`
	Body           map[string]any `json:"body"`
	Model          *string        `json:"model,omitempty"`
	PromptVersion  *string        `json:"prompt_version,omitempty"`
	IsUserEdited   bool           `json:"is_user_edited"`
	AuthorID       *string        `json:"author_id,omitempty"`
	AuthorUsername *string        `json:"author_username,omitempty"` // joined for display
	Note           *string        `json:"note,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
}

// ---- plan board ----------------------------------------------------

// =====================================================================
//   Knowledge-graph nodes added in the v2 schema rewrite.
//   Each is a first-class SurrealDB SCHEMAFULL table; many also carry
//   a `Embedding` field for Gemini KNN.
// =====================================================================

type Audience struct {
	ID          string    `json:"id"`
	Slug        string    `json:"slug"`
	Label       string    `json:"label"`
	Description string    `json:"description,omitempty"`
	IncomeBand  string    `json:"income_band,omitempty"`
	Interests   []string  `json:"interests,omitempty"`
	AvgBasket   float64   `json:"avg_basket_rub,omitempty"`
	Embedding   []float64 `json:"embedding,omitempty"`
}

type Trend struct {
	ID            string    `json:"id"`
	Slug          string    `json:"slug"`
	Title         string    `json:"title"`
	Description   string    `json:"description,omitempty"`
	Source        string    `json:"source"`
	Strength      float64   `json:"strength"`
	StartedAt     time.Time `json:"started_at"`
	HorizonDays   int       `json:"horizon_days"`
	AudienceTags  []string  `json:"audience_tags,omitempty"`
	ProductTags   []string  `json:"product_tags,omitempty"`
	Embedding     []float64 `json:"embedding,omitempty"`
}

type SeasonalWindow struct {
	ID             string   `json:"id"`
	Label          string   `json:"label"`
	ProductConcept string   `json:"product_concept"`
	Months         []int    `json:"months"`
	Scope          []string `json:"scope,omitempty"`
	Status         string   `json:"status"`
	Note           string   `json:"note,omitempty"`
}

// AIMemory is the contextual-intelligence layer. Every relevant user
// interaction (accept/reject/launch/regenerate/etc.) is appended; the
// recommender reads back to bias future scoring toward what works.
type AIMemory struct {
	ID        string         `json:"id"`
	FarmerID  string         `json:"farmer_id"`
	Kind      string         `json:"kind"`
	SubjectID string         `json:"subject_id,omitempty"`
	Signal    float64        `json:"signal"`
	Context   map[string]any `json:"context,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
}

// Insight is a proactive recommendation emitted by the insights engine.
// It is rendered as a card on the "AI Insights" page. Each rule produces
// 0..1 of these per run; the engine ranks them by `score` and trims to top N.
type Insight struct {
	Kind     string         `json:"kind"`     // gift_gap | season_opening | premium_gap | category_strength | channel_gap | match_gap
	Title    string         `json:"title"`    // headline; ≤72 chars
	Body     string         `json:"body"`     // expanded paragraph; 1-3 sentences
	Tone     string         `json:"tone"`     // leaf | amber | plum | sky | rust
	Score    float64        `json:"score"`    // 0..1, higher = more urgent / impactful
	Evidence map[string]any `json:"evidence"` // raw counters for the FE / debugging
}

type PlanCard struct {
	ID            string     `json:"id"`
	FarmerID      string     `json:"farmer_id"`
	SuggestionID  string     `json:"suggestion_id"`
	Suggestion    *Suggestion `json:"suggestion,omitempty"`
	Column        string     `json:"column"`
	Position      int        `json:"position"`
	Note          string     `json:"note,omitempty"`
	ScheduledFor  *time.Time `json:"scheduled_for,omitempty"`
	LaunchedAt    *time.Time `json:"launched_at,omitempty"`
	ResultOrders  *int       `json:"result_orders,omitempty"`
	ResultRevenue *float64   `json:"result_revenue,omitempty"`
}
