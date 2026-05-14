// Domain types — mirror api/internal/models. Kept narrow on the FE side.

export type EventType =
  | "holiday"
  | "season"
  | "themed_week"
  | "trend"
  | "professional";

export interface Farmer {
  id: string;
  organization_id: number;
  shop_name: string;
  description?: string;
  region: string;
  url?: string;
  channels?: string[];
  audience_focus?: string[];
  risk_appetite?: string;
  /** Populated when the list was fetched via `listFarmers({ withCounts: true })`. */
  product_count?: number;
  categories?: string[];
}

export interface Product {
  id: string;
  product_id: number;
  farmer_id: string;
  name: string;
  description?: string;
  category: string;
  url?: string;
  tags?: string[];
}

export interface CalendarEvent {
  id: string;
  slug: string;
  title: string;
  type: EventType;
  type_detail?: string;
  start_date: string;
  end_date: string;
  recurrence?: string;
  prep_window_days?: number;
  audience?: string[];
  product_tags?: string[];
  categories?: string[];
  channels?: string[];
  themes?: string[];
  color?: string;
  icon?: string;
}

export interface Assumption {
  label: string;
  value: number;
  unit: string;
  note?: string;
}

export interface PredictedLift {
  orders_delta: number;
  revenue_delta: number;
  confidence: number;
  assumptions: Assumption[];
  /** Per-channel Δorders attribution; values sum to orders_delta. */
  channel_mix?: Record<string, number>;
}

export interface Promo {
  discount_pct: number;
  promo_code?: string;
  bundle_size?: number;
}

export interface Suggestion {
  id?: string;
  farmer_id: string;
  event_id: string;
  event?: CalendarEvent;
  products?: Product[];
  product_ids?: string[];
  channels: string[];
  date_window_start: string;
  date_window_end: string;
  promo: Promo;
  predicted_lift: PredictedLift;
  score: number;
  status: "proposed" | "planned" | "live" | "completed";
  /** Map keyed by product.id (full record id, e.g. "product:abc"). */
  product_reasons?: Record<string, string[]>;
}

export interface CalendarBuild {
  from: string;
  to: string;
  events: CalendarEvent[];
  suggestions: Suggestion[];
}

export type Channel = "push" | "story" | "blog" | "recipe" | "chat" | "social" | "email";

export type ContentStatus = "draft" | "published" | "archived";

export interface GeneratedContent {
  id?: string;
  suggestion_id: string;
  channel: Channel;
  variant: number;
  body: Record<string, any>;
  model?: string;
  prompt_version?: string;
  // Phase-2 lifecycle (all optional for backwards-compat with old API responses).
  status?: ContentStatus;
  current_revision?: number;
  is_user_edited?: boolean;
  published_at?: string | null;
  archived_at?: string | null;
  updated_at?: string;
  created_at?: string;
}

export interface ContentRevision {
  id: string;
  content_id: string;
  revision_number: number;
  body: Record<string, any>;
  model?: string | null;
  prompt_version?: string | null;
  is_user_edited: boolean;
  author_id?: string | null;
  author_username?: string | null;
  note?: string | null;
  created_at: string;
}

export type BoardType =
  | "campaign"
  | "seasonal"
  | "social"
  | "launch"
  | "event"
  | "recipe"
  | "storytelling"
  | "push"
  | "community";

export type CardPriority = "low" | "normal" | "high" | "urgent";

export interface PlanCard {
  id?: string;
  farmer_id: string;
  suggestion_id: string;
  column: "proposed" | "planned" | "live" | "completed";
  position: number;
  note?: string;
  scheduled_for?: string;
  suggestion?: Suggestion;

  // ── Phase-3 rich-card fields (all optional for compat) ───────
  board_type?: BoardType;
  title?: string;
  description?: string;
  priority?: CardPriority;
  due_date?: string | null;
  audience_tags?: string[];
  channels?: string[];
  hashtags?: string[];
  cta?: string;
  attachments?: unknown[];
  product_refs?: string[];
  assignee_id?: string | null;
  created_by?: string | null;
  updated_at?: string;
  created_at?: string;
}

export interface PlanCardComment {
  id: string;
  card_id: string;
  author_id?: string | null;
  author_username?: string | null;
  body: string;
  created_at: string;
}

export type ActivityKind =
  | "created"
  | "moved"
  | "edited"
  | "commented"
  | "archived"
  | "linked_content_published";

export interface PlanCardActivity {
  id: string;
  card_id: string;
  author_id?: string | null;
  author_username?: string | null;
  kind: ActivityKind;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface BoardSummary {
  board_type: BoardType;
  total: number;
  active: number;
  completed: number;
  overdue: number;
}
