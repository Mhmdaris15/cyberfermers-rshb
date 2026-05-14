import { api } from "./api";
import type { ContentStatus, GeneratedContent } from "./types";

// ============================================================
//   Stories client (phase 4).
//   Stories are generated_content rows with channel='story' — the
//   client just sugars the dedicated /farmers/:id/stories endpoints
//   and re-uses the Phase-2 content lifecycle endpoints for edits.
// ============================================================

// StoryBody is the canonical shape for a story's generated_content.body.
// Older AI-generated stories may only have `caption + image_prompt`;
// the editor reads both and writes the extended shape.
export interface StoryBody {
  title?: string;
  body?: string;
  caption?: string;           // legacy AI shape
  hero_image_url?: string;
  image_prompt?: string;
  audience_tags?: string[];
  hashtags?: string[];
}

export interface CreateStoryBody {
  title: string;
  body?: string;
  hero_image_url?: string;
  image_prompt?: string;
  audience_tags?: string[];
  hashtags?: string[];
  create_plan_card?: boolean;
}

export interface CreateStoryResponse {
  story: GeneratedContent;
  plan_card_id?: string;
}

export const listFarmerStories = (farmerID: string, status?: ContentStatus) =>
  api
    .get<{ stories: GeneratedContent[] }>(`/api/farmers/${farmerID}/stories`, {
      params: status ? { status } : undefined,
    })
    .then((r) => r.data.stories);

export const createFarmerStory = (farmerID: string, body: CreateStoryBody) =>
  api
    .post<CreateStoryResponse>(`/api/farmers/${farmerID}/stories`, body)
    .then((r) => r.data);

export const getStory = (id: string) =>
  api.get<GeneratedContent>(`/api/stories/${id}`).then((r) => r.data);

// ─── helpers ────────────────────────────────────────────────────────────

/** Read a story's display title across both old and new body shapes. */
export function storyTitle(s: GeneratedContent): string {
  const b = s.body as StoryBody | undefined;
  return b?.title?.trim() || b?.caption?.trim()?.split("\n")[0] || "Без названия";
}

/** Read the narrative body across both shapes. Falls back to caption. */
export function storyBody(s: GeneratedContent): string {
  const b = s.body as StoryBody | undefined;
  return b?.body?.trim() || b?.caption?.trim() || "";
}

export function storyHeroImage(s: GeneratedContent): string | undefined {
  const b = s.body as StoryBody | undefined;
  return b?.hero_image_url?.trim() || undefined;
}
