import { apiFetch } from './client';
import type { Notification } from '@/lib/types/api';

export const notificationsApi = {
  list:    () => apiFetch<Notification[]>('/notifications'),
  read:    (id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => apiFetch<void>('/notifications/read-all', { method: 'POST' }),
};
