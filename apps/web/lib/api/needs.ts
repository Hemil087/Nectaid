import { apiFetch } from './client';
import type { Need, NeedsPage } from '@/lib/types/api';

export interface NeedsFilters {
  status?: string;
  urgency?: string;
  need_type?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

function toQueryString(params: Record<string, string | number | undefined>) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}

export const needsApi = {
  list:    (filters: NeedsFilters = {}) =>
    apiFetch<NeedsPage>(`/needs?${toQueryString(filters as Record<string, string>)}`),
  get:     (id: string) => apiFetch<Need>(`/needs/${id}`),
  patch:   (id: string, body: Partial<Need>) =>
    apiFetch<Need>(`/needs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  publish: (id: string) =>
    apiFetch<Need>(`/needs/${id}/publish`, { method: 'POST' }),
  explain: (id: string) =>
    apiFetch<Record<string, unknown>>(`/needs/${id}/explain`),
};
