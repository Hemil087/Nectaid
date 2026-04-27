/**
 * lib/api/assignments.ts
 *
 * All assignment mutations. Toasts are fired here so every
 * caller (accept button, completion form, etc.) gets consistent
 * feedback without duplicating toast calls in components.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { QK } from '@/lib/api/query-keys';
import { t } from '@/lib/utils/toast';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AssignmentNeed {
  id: string;
  title: string;
  description: string;
  need_type: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  priority_score: number;
  location: { lat: number; lng: number; text: string } | null;
  beneficiary_count: number;
  required_skills: string[];
  required_team_size: number;
  deadline: string | null;
  status: string;
}

export interface Assignment {
  id: string;
  need_id: string;
  volunteer_id: string;
  role_in_team: string | null;
  match_score: number | null;
  match_breakdown: Record<string, number> | null;
  status:
    | 'pending_accept'
    | 'accepted'
    | 'declined'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show'
    | 'expired';
  assigned_at: string;
  accept_deadline: string | null;
  responded_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  coordinator_rating: number | null;
  volunteer_feedback: string | null;
  completion_notes: string | null;
  completion_photo_urls: string[] | null;
  need?: AssignmentNeed;
}

export interface MyAssignmentsPage {
  items: Assignment[];
  next_cursor: string | null;
}

// ── Queries ────────────────────────────────────────────────────────────────

export function useMyAssignments() {
  return useQuery({
    queryKey: QK.myAssignments(),
    queryFn: () => apiFetch<MyAssignmentsPage>('/volunteers/me/assignments?limit=50'),
    staleTime: 30_000,
  });
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: QK.assignment(id),
    queryFn: () => apiFetch<Assignment>(`/assignments/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

export function useAcceptAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Assignment>(`/assignments/${id}/accept`, { method: 'POST' }),
    onSuccess: (_, id) => {
      t.assignmentAccepted();
      qc.invalidateQueries({ queryKey: QK.myAssignments() });
      qc.invalidateQueries({ queryKey: QK.assignment(id) });
    },
    onError: (err: Error & { status?: number }) => {
      if (err.status === 409) t.alreadyResponded();
      else if (err.status === 422) t.deadlineExpired();
      else t.generic(err.message);
    },
  });
}

export function useDeclineAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<Assignment>(`/assignments/${id}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (_, { id }) => {
      t.assignmentDeclined();
      qc.invalidateQueries({ queryKey: QK.myAssignments() });
      qc.invalidateQueries({ queryKey: QK.assignment(id) });
    },
    onError: (err: Error & { status?: number }) => {
      if (err.status === 403) t.forbidden();
      else t.generic(err.message);
    },
  });
}

export function useUpdateAssignmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      notes,
      photo_urls,
    }: {
      id: string;
      status: 'in_progress' | 'completed';
      notes?: string;
      photo_urls?: string[];
    }) =>
      apiFetch<Assignment>(`/assignments/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, notes, photo_urls }),
      }),
    onSuccess: (_, { id, status }) => {
      if (status === 'in_progress') t.taskStarted();
      else t.taskCompleted();
      qc.invalidateQueries({ queryKey: QK.myAssignments() });
      qc.invalidateQueries({ queryKey: QK.assignment(id) });
    },
    onError: (err: Error & { status?: number }) => {
      if (err.status === 403) t.forbidden();
      else t.generic(err.message);
    },
  });
}

export function useRateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      rating,
      feedback,
    }: {
      id: string;
      rating: number;
      feedback?: string;
    }) =>
      apiFetch<void>(`/assignments/${id}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating, feedback }),
      }),
    onSuccess: (_, { id }) => {
      toast_success_rating();
      qc.invalidateQueries({ queryKey: QK.assignment(id) });
      qc.invalidateQueries({ queryKey: QK.myAssignments() });
    },
    onError: (err: Error) => t.generic(err.message),
  });
}

// internal helper so the file doesn't import toast twice
function toast_success_rating() {
  const { toast } = require('sonner') as typeof import('sonner');
  toast.success('Rating submitted — thank you!');
}