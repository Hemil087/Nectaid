/**
 * lib/api/needs.ts
 *
 * Needs queries + mutations with toast feedback.
 */
'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { QK } from '@/lib/api/query-keys';
import { t } from '@/lib/utils/toast';

// ── Types ──────────────────────────────────────────────────────────────────

export interface NeedLocation {
  lat: number;
  lng: number;
  text: string;
}

export interface PriorityBreakdown {
  urgency_component: number;
  severity_component: number;
  beneficiary_component: number;
  time_pressure_component: number;
  resource_difficulty_component: number;
}

export interface Need {
  id: string;
  title: string;
  description: string;
  need_type: string;
  category: string | null;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  priority_score: number;
  priority_breakdown: PriorityBreakdown;
  location: NeedLocation | null;
  beneficiary_count: number;
  required_skills: string[];
  required_team_size: number;
  resources_needed: string[];
  deadline: string | null;
  window_start: string | null;
  window_end: string | null;
  status: string;
  raw_submission_id: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  published_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NeedsPage {
  items: Need[];
  next_cursor: string | null;
}

export interface NeedsFilters {
  status?: string;
  urgency?: string;
  need_type?: string;
  limit?: number;
}

export interface NeedExplain {
  priority_score: number;
  breakdown: PriorityBreakdown;
  formula: string;
  weights: Record<string, number>;
}

// ── Queries ────────────────────────────────────────────────────────────────

export function useNeeds(filters: NeedsFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.urgency) params.set('urgency', filters.urgency);
  if (filters.need_type) params.set('need_type', filters.need_type);
  params.set('limit', String(filters.limit ?? 20));

  return useInfiniteQuery({
    queryKey: QK.needs(filters),
    queryFn: ({ pageParam }) => {
      if (pageParam) params.set('cursor', pageParam as string);
      return apiFetch<NeedsPage>(`/needs?${params.toString()}`);
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,
  });
}

export function useNeed(id: string) {
  return useQuery({
    queryKey: QK.need(id),
    queryFn: () => apiFetch<Need>(`/needs/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useNeedExplain(id: string, enabled = false) {
  return useQuery({
    queryKey: QK.needExplain(id),
    queryFn: () => apiFetch<NeedExplain>(`/needs/${id}/explain`),
    enabled: !!id && enabled,
    staleTime: 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

export function usePatchNeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Need> }) =>
      apiFetch<Need>(`/needs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      t.needSaved();
      qc.invalidateQueries({ queryKey: QK.need(id) });
      qc.invalidateQueries({ queryKey: QK.needs() });
    },
    onError: (err: Error) => t.generic(err.message),
  });
}

export function usePublishNeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Need>(`/needs/${id}/publish`, { method: 'POST' }),
    onSuccess: (_, id) => {
      t.needPublished();
      qc.invalidateQueries({ queryKey: QK.need(id) });
      qc.invalidateQueries({ queryKey: QK.needs() });
      qc.invalidateQueries({ queryKey: QK.dashboard() });
    },
    onError: (err: Error & { status?: number }) => {
      if (err.status === 403) t.forbidden();
      else t.generic(err.message);
    },
  });
}

export function useCancelNeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<Need>(`/needs/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (_, { id }) => {
      t.needCancelled();
      qc.invalidateQueries({ queryKey: QK.need(id) });
      qc.invalidateQueries({ queryKey: QK.needs() });
      qc.invalidateQueries({ queryKey: QK.dashboard() });
    },
    onError: (err: Error) => t.generic(err.message),
  });
}