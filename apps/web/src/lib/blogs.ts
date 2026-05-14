import { api } from "./api";
import type { ContentStatus, GeneratedContent } from "./types";

// ============================================================
//   Blogs client (phase 5).
//   Blogs are generated_content rows with channel='blog'. Same
//   lifecycle endpoints as content/stories; this file just sugars the
//   blogs-specific routes and re-uses Phase-2 content lifecycle for edits.
// ============================================================

export interface BlogBody {
  title?: string;
  lede?: string;
  body?: string;
  cover_image_url?: string;
  seo_keywords?: string[];
  meta_description?: string;
  audience_tags?: string[];
  hashtags?: string[];
}

export interface CreateBlogBody {
  title: string;
  lede?: string;
  body?: string;
  cover_image_url?: string;
  seo_keywords?: string[];
  meta_description?: string;
  audience_tags?: string[];
  hashtags?: string[];
  create_plan_card?: boolean;
}

export interface CreateBlogResponse {
  blog: GeneratedContent;
  plan_card_id?: string;
}

export const listFarmerBlogs = (farmerID: string, status?: ContentStatus) =>
  api
    .get<{ blogs: GeneratedContent[] }>(`/api/farmers/${farmerID}/blogs`, {
      params: status ? { status } : undefined,
    })
    .then((r) => r.data.blogs);

export const createFarmerBlog = (farmerID: string, body: CreateBlogBody) =>
  api
    .post<CreateBlogResponse>(`/api/farmers/${farmerID}/blogs`, body)
    .then((r) => r.data);

export const getBlog = (id: string) =>
  api.get<GeneratedContent>(`/api/blogs/${id}`).then((r) => r.data);

// ─── helpers ─────────────────────────────────────────────────────────────

export function blogTitle(b: GeneratedContent): string {
  const body = b.body as BlogBody | undefined;
  return body?.title?.trim() || "Без названия";
}

export function blogLede(b: GeneratedContent): string {
  const body = b.body as BlogBody | undefined;
  return body?.lede?.trim() || "";
}

export function blogBodyText(b: GeneratedContent): string {
  const body = b.body as BlogBody | undefined;
  return body?.body?.trim() || "";
}

export function blogCoverImage(b: GeneratedContent): string | undefined {
  const body = b.body as BlogBody | undefined;
  return body?.cover_image_url?.trim() || undefined;
}

/**
 * Reading time estimate at ~200 wpm (Russian + English mixed; rough but
 * consistent). Computed on the FE every render, never stored — wpm
 * conventions change and so does what counts as a "word" when SEO tools
 * trim/strip markdown later.
 */
export function readingMinutes(b: GeneratedContent): number {
  const text = blogBodyText(b);
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
