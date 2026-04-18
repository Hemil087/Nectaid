import { apiFetch } from './client';
import type { Assignment } from '@/lib/types/api';

export const assignmentsApi = {
  mine:    () => apiFetch<Assignment[]>('/volunteers/me/assignments'),
  get:     (id: string) => apiFetch<Assignment>(`/assignments/${id}`),
  accept:  (id: string) => apiFetch<Assignment>(`/assignments/${id}/accept`, { method: 'POST' }),
  decline: (id: string, reason: string) =>
    apiFetch<Assignment>(`/assignments/${id}/decline`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  status:  (id: string, status: string, notes?: string, photo_urls?: string[]) =>
    apiFetch<Assignment>(`/assignments/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, notes, photo_urls }),
    }),
};
