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
}

export interface CalendarBuild {
  from: string;
  to: string;
  events: CalendarEvent[];
  suggestions: Suggestion[];
}

export type Channel = "push" | "story" | "blog" | "recipe" | "chat" | "social" | "email";

export interface GeneratedContent {
  id?: string;
  suggestion_id: string;
  channel: Channel;
  variant: number;
  body: Record<string, any>;
  model?: string;
  prompt_version?: string;
}

export interface PlanCard {
  id?: string;
  farmer_id: string;
  suggestion_id: string;
  column: "proposed" | "planned" | "live" | "completed";
  position: number;
  note?: string;
  scheduled_for?: string;
  suggestion?: Suggestion;
}
