/**
 * lib/api/reports.ts
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from './client';
import { QK } from '@/lib/api/query-keys';
import type { WeeklyReport } from '@/lib/types/api';

// ── Existing ───────────────────────────────────────────────────────────────

export const reportsApi = {
  list: () => apiFetch<WeeklyReport[]>('/reports'),
};

// ── Hook ───────────────────────────────────────────────────────────────────

export function useWeeklyReport(week: string) {
  return useQuery({
    queryKey: QK.reports(week),
    queryFn: () => apiFetch<WeeklyReport>(`/reports/weekly?week=${week}`),
    enabled: !!week,
    staleTime: 5 * 60_000,
  });
}

// ── Week helpers ───────────────────────────────────────────────────────────

/** Returns ISO week string for the given Monday-based offset.
 *  offset=0 → current week, offset=-1 → last week */
export function isoWeek(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = Math.ceil(
    ((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7,
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Formats "2026-W16" → "Apr 13 – Apr 19, 2026" */
export function formatWeekLabel(isoWeekStr: string): string {
  const [year, w] = isoWeekStr.split('-W').map(Number);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4.getTime());
  monday.setDate(jan4.getDate() - jan4.getDay() + 1 + (w - 1) * 7);
  const sunday = new Date(monday.getTime());
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(sunday)}, ${year}`;
}