import axios from "axios";
import type {
  CalendarBuild, CalendarEvent, Farmer, GeneratedContent, PlanCard,
  Product, Suggestion,
} from "./types";

// In dev, Vite proxies /api → backend. In docker, nginx does the same.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: { "Content-Type": "application/json" },
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

export const generateContent = (id: string, channels?: string[]) =>
  api.post<{ content: GeneratedContent[] }>(`/api/suggestions/${id}/generate`, { channels }).then((r) => r.data.content);

export const listContent = (id: string) =>
  api.get<{ content: GeneratedContent[] }>(`/api/suggestions/${id}/content`).then((r) => r.data.content);

// ------ plan -------------------------------------------------------------
export const getPlan = (farmerId: string) =>
  api.get<Record<string, PlanCard[]>>(`/api/farmers/${farmerId}/plan`).then((r) => r.data);

export const addPlanCard = (payload: { farmer_id: string; suggestion: Suggestion; column?: string; note?: string }) =>
  api.post<PlanCard>("/api/plan/cards", payload).then((r) => r.data);

export const movePlanCard = (payload: { card_id: string; farmer_id: string; suggestion_id: string; column: string; position: number }) =>
  api.post<{ ok: boolean }>("/api/plan/cards/move", payload).then((r) => r.data);
