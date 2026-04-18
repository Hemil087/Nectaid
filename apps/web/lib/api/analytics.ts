import { apiFetch } from './client';
import type { DashboardData } from '@/lib/types/api';

export const analyticsApi = {
  dashboard: () => apiFetch<DashboardData>('/analytics/dashboard'),
};
