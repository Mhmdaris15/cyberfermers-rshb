import { api } from "./api";
import type { ContentStatus, GeneratedContent } from "./types";

// ============================================================
//   Social client (phase 7).
//   Social posts are generated_content rows with channel='social'.
//   Body is a structured JSON document with platforms + slides +
//   captions; the helpers below normalise both new + legacy shapes.
// ============================================================

export type SocialPlatform = "instagram" | "telegram" | "vk";

export interface Slide {
  image_url: string;
  alt?: string;
}

export interface SocialBody {
  // New structured shape
  title?: string;
  platforms?: SocialPlatform[];
  caption?: string;
  hashtags?: string[];
  cta?: string;
  slides?: Slide[];
  scheduled_for?: string;
  audience_tags?: string[];

  // Legacy AI shape (read-only — channel='social' Gemini output uses these)
  text?: string;       // → mapped to caption
  // (legacy AI also sometimes emits `image_prompt` and `title` which we
  // preserve verbatim via the title helper)
}

export interface CreateSocialBody {
  title: string;
  platforms?: SocialPlatform[];
  caption?: string;
  hashtags?: string[];
  cta?: string;
  slides?: Slide[];
  scheduled_for?: string;
  audience_tags?: string[];
  create_plan_card?: boolean;
}

export interface CreateSocialResponse {
  post: GeneratedContent;
  plan_card_id?: string;
}

export const listFarmerSocialPosts = (farmerID: string, status?: ContentStatus) =>
  api
    .get<{ posts: GeneratedContent[] }>(`/api/farmers/${farmerID}/social-posts`, {
      params: status ? { status } : undefined,
    })
    .then((r) => r.data.posts);

export const createFarmerSocialPost = (farmerID: string, body: CreateSocialBody) =>
  api
    .post<CreateSocialResponse>(`/api/farmers/${farmerID}/social-posts`, body)
    .then((r) => r.data);

export const getSocialPost = (id: string) =>
  api.get<GeneratedContent>(`/api/social-posts/${id}`).then((r) => r.data);

// ─── shape-normalising helpers ─────────────────────────────────────────

export function socialTitle(p: GeneratedContent): string {
  const b = p.body as SocialBody | undefined;
  return b?.title?.trim() || (b?.caption || b?.text || "").split("\n")[0]?.slice(0, 80) || "Без названия";
}

export function socialCaption(p: GeneratedContent): string {
  const b = p.body as SocialBody | undefined;
  return (b?.caption ?? b?.text ?? "").trim();
}

export function socialPlatforms(p: GeneratedContent): SocialPlatform[] {
  const b = p.body as SocialBody | undefined;
  const list = b?.platforms ?? [];
  // Filter to known platforms — legacy rows may have garbage.
  return list.filter((x) => x === "instagram" || x === "telegram" || x === "vk");
}

export function socialSlides(p: GeneratedContent): Slide[] {
  const b = p.body as SocialBody | undefined;
  return (b?.slides ?? []).filter((s) => s.image_url?.trim());
}

export function socialScheduledFor(p: GeneratedContent): Date | null {
  const b = p.body as SocialBody | undefined;
  if (!b?.scheduled_for) return null;
  const d = new Date(b.scheduled_for);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── platform metadata (FE-only constants) ─────────────────────────────

export const PLATFORMS: { id: SocialPlatform; label: string; charLimit: number; tone: string }[] = [
  { id: "instagram", label: "Instagram", charLimit: 2200, tone: "from-amber via-rust to-plum" },
  { id: "telegram",  label: "Telegram",  charLimit: 4096, tone: "from-sky to-leaf" },
  { id: "vk",        label: "VK",        charLimit: 4096, tone: "from-sky to-plum" },
];

export function platformMeta(p: SocialPlatform) {
  return PLATFORMS.find((x) => x.id === p) ?? PLATFORMS[0];
}

/** Returns the count by which a caption exceeds the given platform's
 *  limit, or 0 if it fits. */
export function platformOverflow(caption: string, p: SocialPlatform): number {
  return Math.max(0, caption.length - platformMeta(p).charLimit);
}
