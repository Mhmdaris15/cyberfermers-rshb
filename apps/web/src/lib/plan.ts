import { api } from "./api";
import type {
  BoardSummary, BoardType, CardPriority,
  PlanCard, PlanCardActivity, PlanCardComment,
} from "./types";

// ============================================================
//   Plan client (phase 3).
//   Backward-compatible extensions to /api/farmers/:id/plan (board filter)
//   plus seven brand-new endpoints under /api/plan/cards/:id/* and
//   /api/farmers/:id/plan/boards.
// ============================================================

export const getPlan = (farmerId: string, board?: BoardType) =>
  api
    .get<Record<string, PlanCard[]>>(`/api/farmers/${farmerId}/plan`, {
      params: board ? { board } : undefined,
    })
    .then((r) => r.data);

export const listBoards = (farmerId: string) =>
  api
    .get<{ boards: BoardSummary[] }>(`/api/farmers/${farmerId}/plan/boards`)
    .then((r) => r.data.boards);

export const getPlanCard = (id: string) =>
  api.get<PlanCard>(`/api/plan/cards/${id}`).then((r) => r.data);

export interface UpdateCardPatch {
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
  board_type?: BoardType;
  note?: string;
}

export const updatePlanCard = (id: string, patch: UpdateCardPatch) =>
  api.patch<PlanCard>(`/api/plan/cards/${id}`, patch).then((r) => r.data);

export const deletePlanCard = (id: string) =>
  api.delete(`/api/plan/cards/${id}`).then(() => undefined);

export const listPlanCardComments = (id: string) =>
  api
    .get<{ comments: PlanCardComment[] }>(`/api/plan/cards/${id}/comments`)
    .then((r) => r.data.comments);

export const addPlanCardComment = (id: string, body: string) =>
  api
    .post<PlanCardComment>(`/api/plan/cards/${id}/comments`, { body })
    .then((r) => r.data);

export const listPlanCardActivity = (id: string) =>
  api
    .get<{ activity: PlanCardActivity[] }>(`/api/plan/cards/${id}/activity`)
    .then((r) => r.data.activity);

// ── Board catalog — single source of truth for the FE switcher ──────────
// Icons live in components; this exports the order + label only so we
// don't introduce a lucide-react dep at the lib layer.
export interface BoardMeta {
  type: BoardType;
  label: string;
  short: string; // smallcaps marker shown on cards (e.g. "сезон")
}

export const BOARDS: BoardMeta[] = [
  { type: "campaign",     label: "Маркетинг",       short: "кампании" },
  { type: "seasonal",     label: "Сезонные акции",  short: "сезон" },
  { type: "social",       label: "Соцсети",         short: "social" },
  { type: "launch",       label: "Запуски",         short: "launch" },
  { type: "event",        label: "События",         short: "event" },
  { type: "recipe",       label: "Рецепты",         short: "recipe" },
  { type: "storytelling", label: "Сторителлинг",    short: "history" },
  { type: "push",         label: "Push-уведомления", short: "push" },
  { type: "community",    label: "Комьюнити",       short: "club" },
];
