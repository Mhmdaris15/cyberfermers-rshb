import { api } from "./api";
import type { ContentRevision, GeneratedContent } from "./types";

// ============================================================
//   Content lifecycle client (phase 2).
//   All endpoints require auth; the axios interceptor in lib/auth.ts
//   attaches the Bearer token automatically.
// ============================================================

export const getContent = (id: string) =>
  api.get<GeneratedContent>(`/api/content/${id}`).then((r) => r.data);

export interface UpdateContentBody {
  body: Record<string, unknown>;
  note?: string;
}

export const updateContent = (id: string, payload: UpdateContentBody) =>
  api.patch<GeneratedContent>(`/api/content/${id}`, payload).then((r) => r.data);

export const publishContent = (id: string) =>
  api.post<GeneratedContent>(`/api/content/${id}/publish`).then((r) => r.data);

export const archiveContent = (id: string) =>
  api.post<GeneratedContent>(`/api/content/${id}/archive`).then((r) => r.data);

export const unarchiveContent = (id: string) =>
  api.post<GeneratedContent>(`/api/content/${id}/unarchive`).then((r) => r.data);

export const listContentRevisions = (id: string) =>
  api
    .get<{ revisions: ContentRevision[] }>(`/api/content/${id}/revisions`)
    .then((r) => r.data.revisions);

export const restoreContentRevision = (
  id: string,
  revisionNumber: number,
  note?: string,
) =>
  api
    .post<GeneratedContent>(`/api/content/${id}/revisions/${revisionNumber}/restore`, {
      note,
    })
    .then((r) => r.data);
