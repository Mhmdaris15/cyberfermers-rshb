import axios from "axios";
import type {
  CalendarBuild, CalendarEvent, Farmer, GeneratedContent, PlanCard,
  Product, Suggestion,
} from "./types";
import { LANG_STORAGE_KEY } from "./i18n";

// In dev, Vite proxies /api → backend. In docker, nginx does the same.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: { "Content-Type": "application/json" },
});

// ── language interceptor ──────────────────────────────────────────────
// Every API call carries the user's current UI language so the backend
// can adapt Gemini prompts (RU output for RU users, EN for EN). The
// header name is deliberately custom — `Accept-Language` mirrors HTTP
// content-negotiation while `X-UI-Language` is the canonical signal we
// read in Go handlers (smaller, no quality values to parse).
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const lang = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (lang) {
      config.headers = config.headers ?? {};
      config.headers["X-UI-Language"] = lang;
      config.headers["Accept-Language"] = lang;
    }
  }
  return config;
});

// ------ farmers ----------------------------------------------------------
export const listFarmers = (opts?: { withCounts?: boolean }) =>
  api
    .get<{ farmers: Farmer[] }>("/api/farmers", {
      params: opts?.withCounts ? { with_counts: 1 } : undefined,
    })
    .then((r) => r.data.farmers);

export const getFarmer = (id: string) =>
  api.get<Farmer>(`/api/farmers/${id}`).then((r) => r.data);

export const getFarmerProducts = (id: string) =>
  api.get<{ products: Product[]; count: number }>(`/api/farmers/${id}/products`).then((r) => r.data);

// ------ product tags ------------------------------------------------------

export interface TagSuggestion {
  tag: string;
  source: "rule" | "llm";
  confidence: number;
  existing: boolean;
}

export interface AutoTagResult {
  products_considered: number;
  products_touched: number;
  tags_added: number;
  llm_calls: number;
}

export const addProductTag = (farmerId: string, productId: string, tag: string) =>
  api
    .post<{ tags: string[] }>(`/api/farmers/${farmerId}/products/${productId}/tags`, { tag })
    .then((r) => r.data.tags);

export const addProductTagsBatch = (farmerId: string, productId: string, tags: string[]) =>
  api
    .post<{ tags: string[]; added: number }>(
      `/api/farmers/${farmerId}/products/${productId}/tags/batch`,
      { tags },
    )
    .then((r) => r.data);

export const removeProductTag = (farmerId: string, productId: string, tag: string) =>
  api
    .delete<{ tags: string[] }>(
      `/api/farmers/${farmerId}/products/${productId}/tags/${encodeURIComponent(tag)}`,
    )
    .then((r) => r.data.tags);

export const suggestProductTags = (farmerId: string, productId: string) =>
  api
    .post<{ suggestions: TagSuggestion[]; count: number }>(
      `/api/farmers/${farmerId}/products/${productId}/tags/suggest`,
    )
    .then((r) => r.data.suggestions);

export const autoTagMissing = (farmerId: string) =>
  api
    .post<AutoTagResult>(`/api/farmers/${farmerId}/products/tags/auto-tag-missing`)
    .then((r) => r.data);

export const getTagVocabulary = (farmerId: string) =>
  api
    .get<{ tags: string[]; count: number }>(`/api/farmers/${farmerId}/products/tags/vocabulary`)
    .then((r) => r.data.tags);

// ------ events -----------------------------------------------------------
export const listEvents = (from?: string, to?: string) =>
  api.get<{ events: CalendarEvent[] }>("/api/events", { params: { from, to } }).then((r) => r.data.events);

// ------ calendar (events + suggestions for a farmer) ---------------------
export const getCalendar = (farmerId: string, from?: string, to?: string) =>
  api.get<CalendarBuild>(`/api/farmers/${farmerId}/calendar`, { params: { from, to } }).then((r) => r.data);

// ------ suggestion -------------------------------------------------------
export const getSuggestion = (id: string) =>
  api.get<Suggestion>(`/api/suggestions/${id}`).then((r) => r.data);

// Persist a transient suggestion (one returned by /calendar but not yet saved).
// FE calls this once before requesting content generation so each generation
// has a stable suggestion_id to attach to.
export const persistSuggestion = (farmer_id: string, suggestion: Suggestion) =>
  api.post<Suggestion>("/api/suggestions", { farmer_id, suggestion }).then((r) => r.data);

export const generateContent = (
  id: string,
  channels?: string[],
  variant: number = 0,
) =>
  api
    .post<{ content: GeneratedContent[] }>(`/api/suggestions/${id}/generate`, {
      channels,
      variant,
    })
    .then((r) => r.data.content);

export const listContent = (id: string) =>
  api.get<{ content: GeneratedContent[] }>(`/api/suggestions/${id}/content`).then((r) => r.data.content);

// ------ plan -------------------------------------------------------------
export const getPlan = (farmerId: string) =>
  api.get<Record<string, PlanCard[]>>(`/api/farmers/${farmerId}/plan`).then((r) => r.data);

export const addPlanCard = (payload: { farmer_id: string; suggestion: Suggestion; column?: string; note?: string }) =>
  api.post<PlanCard>("/api/plan/cards", payload).then((r) => r.data);

export const movePlanCard = (payload: { card_id: string; farmer_id: string; suggestion_id: string; column: string; position: number }) =>
  api.post<{ ok: boolean }>("/api/plan/cards/move", payload).then((r) => r.data);

// ------ chat -------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant" | "model";
  text: string;
}
export interface ChatAction {
  label: string;
  href: string;
}
export interface ChatReply {
  text: string;
  followups: string[];
  actions: ChatAction[];
  used: string[];
  evidence: Record<string, any>;
}

export const chatTurn = (
  farmerId: string,
  message: string,
  history: ChatMessage[] = [],
) =>
  api
    .post<ChatReply>(`/api/farmers/${farmerId}/chat`, { message, history })
    .then((r) => r.data);

// ------ insights ---------------------------------------------------------

export interface Insight {
  kind: string;
  title: string;
  body: string;
  tone: "leaf" | "amber" | "plum" | "sky" | "rust";
  score: number;
  evidence: Record<string, any>;
}

export const getInsights = (farmerId: string) =>
  api.get<{ insights: Insight[] }>(`/api/farmers/${farmerId}/insights`).then((r) => r.data.insights);
