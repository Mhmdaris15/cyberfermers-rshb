import { api } from "./api";
import type { ContentStatus, GeneratedContent } from "./types";

// ============================================================
//   Push notifications client (phase 8).
//   Channel='push'. Body shape carries a `dispatch` object that the
//   runtime scheduler mutates queued → sent.
// ============================================================

export type Urgency = "normal" | "high" | "critical";
export type DispatchStatus = "queued" | "sending" | "sent" | "failed";

export interface PushDispatch {
  status?: DispatchStatus;
  sent_at?: string;
  attempts?: number;
  error?: string;
}

export interface PushBody {
  // new structured shape
  title?: string;              // internal label
  headline?: string;           // visible push title
  body?: string;               // visible push body
  deep_link?: string;
  icon_emoji?: string;
  preview_image_url?: string;
  segments?: string[];
  urgency?: Urgency;
  scheduled_for?: string;
  dispatch?: PushDispatch;
}

export interface CreatePushBody {
  title: string;
  headline: string;
  body: string;
  deep_link?: string;
  icon_emoji?: string;
  preview_image_url?: string;
  segments?: string[];
  urgency?: Urgency;
  scheduled_for?: string;
  create_plan_card?: boolean;
}

export interface CreatePushResponse {
  push: GeneratedContent;
  plan_card_id?: string;
}

export const listFarmerPushes = (farmerID: string, status?: ContentStatus) =>
  api
    .get<{ pushes: GeneratedContent[] }>(`/api/farmers/${farmerID}/push`, {
      params: status ? { status } : undefined,
    })
    .then((r) => r.data.pushes);

export const createFarmerPush = (farmerID: string, body: CreatePushBody) =>
  api
    .post<CreatePushResponse>(`/api/farmers/${farmerID}/push`, body)
    .then((r) => r.data);

export const getPush = (id: string) =>
  api.get<GeneratedContent>(`/api/push/${id}`).then((r) => r.data);

// ─── shape-normalising helpers ─────────────────────────────────────────

export function pushHeadline(p: GeneratedContent): string {
  const b = p.body as PushBody | undefined;
  return (b?.headline ?? b?.title ?? "").trim() || "Без заголовка";
}

export function pushBodyText(p: GeneratedContent): string {
  const b = p.body as PushBody | undefined;
  return (b?.body ?? "").trim();
}

export function pushIconEmoji(p: GeneratedContent): string {
  const b = p.body as PushBody | undefined;
  return b?.icon_emoji?.trim() || "";
}

export function pushUrgency(p: GeneratedContent): Urgency {
  const b = p.body as PushBody | undefined;
  return b?.urgency ?? "normal";
}

export function pushSegments(p: GeneratedContent): string[] {
  const b = p.body as PushBody | undefined;
  return b?.segments ?? [];
}

export function pushScheduledFor(p: GeneratedContent): Date | null {
  const b = p.body as PushBody | undefined;
  if (!b?.scheduled_for) return null;
  const d = new Date(b.scheduled_for);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function pushDispatchStatus(p: GeneratedContent): DispatchStatus {
  const b = p.body as PushBody | undefined;
  return (b?.dispatch?.status ?? "queued") as DispatchStatus;
}

export function pushDispatchSentAt(p: GeneratedContent): Date | null {
  const b = p.body as PushBody | undefined;
  const s = b?.dispatch?.sent_at;
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── constants ─────────────────────────────────────────────────────────

// Approximate visible-on-lock-screen char counts per platform. Real
// numbers vary with device + font scale; these are operator-facing
// budgets that match what professional copy guides recommend.
export const PUSH_LIMITS = {
  ios: { headline: 30, body: 178 },
  android: { headline: 65, body: 240 },
};

export const URGENCY_META: Record<Urgency, { label: string; tone: string; iconTint: string }> = {
  normal:   { label: "обычный",        tone: "border-line bg-bg-subtle text-ink-dim",   iconTint: "text-ink-mute" },
  high:     { label: "высокий",        tone: "border-amber/40 bg-amber/10 text-amber",  iconTint: "text-amber" },
  critical: { label: "критический",    tone: "border-rust/40 bg-rust/10 text-rust",     iconTint: "text-rust" },
};

export const DISPATCH_META: Record<DispatchStatus, { label: string; tone: string }> = {
  queued:  { label: "в очереди", tone: "border-line bg-bg-subtle text-ink-mute" },
  sending: { label: "отправка",  tone: "border-amber/40 bg-amber/10 text-amber" },
  sent:    { label: "отправлено", tone: "border-leaf/40 bg-leaf/10 text-leaf" },
  failed:  { label: "ошибка",     tone: "border-rust/40 bg-rust/10 text-rust" },
};

// Known audience segments — the editor offers these as multi-select chips.
// Matches the seeds in data/seed/audiences.yml.
export const SEGMENTS: { slug: string; label: string }[] = [
  { slug: "zozh",       label: "ЗОЖ" },
  { slug: "parents",    label: "Родители" },
  { slug: "gourmets",   label: "Гурманы" },
  { slug: "gift_buyers", label: "Подарки" },
  { slug: "fitness",    label: "Фитнес" },
  { slug: "students",   label: "Студенты" },
];
