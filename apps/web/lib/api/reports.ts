import { apiFetch } from './client';
import type { WeeklyReport } from '@/lib/types/api';

export const reportsApi = {
  list: () => apiFetch<WeeklyReport[]>('/reports'),
};
