import { apiFetch } from './client';
import type { VolunteerProfile } from '@/lib/types/api';

export const volunteersApi = {
  me:     () => apiFetch<VolunteerProfile>('/volunteers/me'),
  update: (data: Partial<VolunteerProfile>) =>
    apiFetch<VolunteerProfile>('/volunteers/me', { method: 'PATCH', body: JSON.stringify(data) }),
  create: (data: Partial<VolunteerProfile>) =>
    apiFetch<VolunteerProfile>('/volunteers', { method: 'POST', body: JSON.stringify(data) }),
  get:    (id: string) => apiFetch<VolunteerProfile>(`/volunteers/${id}`),
  list:   (filters?: Record<string, string>) =>
    apiFetch<VolunteerProfile[]>(`/volunteers?${new URLSearchParams(filters).toString()}`),
  verify: (id: string) =>
    apiFetch<void>(`/volunteers/${id}/verify`, { method: 'POST' }),
};
