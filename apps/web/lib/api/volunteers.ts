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
  adminList: (params: URLSearchParams) =>
    apiFetch<{ items: AdminVolunteer[]; total: number; next_cursor: string | null }>(
      `/admin/volunteers?${params.toString()}`
    ),
  verify: (userId: string) =>
    apiFetch<{ user_id: string; verified: boolean }>(`/admin/volunteers/${userId}/verify`, { method: 'PATCH' }),
  suspend: (userId: string) =>
    apiFetch<{ user_id: string; suspended_at: string }>(`/admin/users/${userId}/suspend`, { method: 'POST' }),
};

export interface AdminVolunteer {
  user_id: string;
  full_name: string;
  email: string;
  skills: string[];
  verified: boolean;
  reliability_score: number;
  total_tasks_completed: number;
  deleted_at: string | null;
}
