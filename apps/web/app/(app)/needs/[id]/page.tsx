'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MapPin, Users, Clock, AlertTriangle, CheckCircle2,
  ArrowLeft, Pencil, Send, X
} from 'lucide-react';
import type { Need, Assignment } from '@/lib/types/api';
import type { NeedStatus, Urgency, AssignmentStatus } from '@/lib/types/enums';
import { useNeedRealtime } from '@/lib/hooks/use-need-realtime';

const URGENCY_STYLES: Record<Urgency, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-green-100 text-green-700 border-green-200',
};

const STATUS_STYLES: Record<NeedStatus, string> = {
  pending_review:    'bg-zinc-100 text-zinc-600',
  published:         'bg-blue-100 text-blue-700',
  matching_complete: 'bg-purple-100 text-purple-700',
  assigned:          'bg-indigo-100 text-indigo-700',
  in_progress:       'bg-amber-100 text-amber-700',
  completed:         'bg-emerald-100 text-emerald-700',
  cancelled:         'bg-zinc-100 text-zinc-400',
  expired:           'bg-zinc-100 text-zinc-400',
};

const STATUS_LABELS: Record<NeedStatus, string> = {
  pending_review:    'Pending review',
  published:         'Published',
  matching_complete: 'Matching complete',
  assigned:          'Assigned',
  in_progress:       'In progress',
  completed:         'Completed',
  cancelled:         'Cancelled',
  expired:           'Expired',
};

const ASSIGNMENT_STATUS_STYLES: Record<AssignmentStatus, string> = {
  pending_accept: 'bg-yellow-100 text-yellow-700',
  accepted:       'bg-blue-100 text-blue-700',
  declined:       'bg-red-100 text-red-600',
  in_progress:    'bg-amber-100 text-amber-700',
  completed:      'bg-emerald-100 text-emerald-700',
  cancelled:      'bg-zinc-100 text-zinc-400',
  no_show:        'bg-red-100 text-red-400',
  expired:        'bg-zinc-100 text-zinc-400',
};

function PriorityTooltip({ need }: { need: Need }) {
  const b = need.priority_breakdown;
  if (!b) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Urgency</span>
        <span className="font-medium">+{b.urgency_component.toFixed(1)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Severity</span>
        <span className="font-medium">+{b.severity_component.toFixed(1)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Beneficiaries</span>
        <span className="font-medium">+{b.beneficiary_component.toFixed(1)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Time pressure</span>
        <span className="font-medium">+{b.time_pressure_component.toFixed(1)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Resource difficulty</span>
        <span className="font-medium text-red-500">{b.resource_difficulty_component.toFixed(1)}</span>
      </div>
      <div className="flex justify-between text-xs border-t pt-1.5 mt-1.5">
        <span className="font-semibold">Total</span>
        <span className="font-semibold text-primary">{need.priority_score.toFixed(1)}</span>
      </div>
    </div>
  );
}

export default function NeedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPriority, setShowPriority] = useState(false);

  // REST data
  const { data: need, isLoading } = useQuery<Need>({
    queryKey: ['need', id],
    queryFn: () => apiFetch(`/needs/${id}`),
  });

  // Firestore realtime — liveStatus overrides REST status when available
  const { data: realtime } = useNeedRealtime(id);
  const liveStatus = (realtime?.status ?? need?.status) as NeedStatus;

  const { data: assignmentsData } = useQuery<{ items: Assignment[] }>({
    queryKey: ['need-assignments', id],
    queryFn: () => apiFetch(`/needs/${id}/assignments`),
    enabled: !!liveStatus && ['matching_complete', 'assigned', 'in_progress', 'completed'].includes(liveStatus),
  });

  const publishMutation = useMutation({
    mutationFn: () => apiFetch(`/needs/${id}/publish`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['need', id] });
      queryClient.invalidateQueries({ queryKey: ['needs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`/needs/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Cancelled by coordinator' }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['need', id] });
      queryClient.invalidateQueries({ queryKey: ['needs'] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <Card><CardContent className="py-8">
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-4 bg-muted animate-pulse rounded" style={{width: `${70 + i * 5}%`}} />)}
          </div>
        </CardContent></Card>
      </div>
    );
  }

  if (!need) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <p className="text-muted-foreground text-sm">Need not found.</p>
      </div>
    );
  }

  const canPublish = liveStatus === 'pending_review';
  const canCancel = !['completed', 'cancelled', 'expired'].includes(liveStatus);
  const deadline = need.deadline ? new Date(need.deadline) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/needs"><ArrowLeft className="h-4 w-4 mr-2" /> All needs</Link>
        </Button>
        <div className="flex gap-2">
          {canPublish && (
            <Button
              size="sm"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {publishMutation.isPending ? 'Publishing…' : 'Publish'}
            </Button>
          )}
          {canPublish && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/needs/${id}/review`}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </Link>
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" /> Cancel
            </Button>
          )}
        </div>
      </div>

      <PageHeader
        title={need.title}
        subtitle={need.location?.text}
      />

      {/* Status + urgency row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={URGENCY_STYLES[need.urgency]}>
          {need.urgency}
        </Badge>
        <Badge variant="secondary" className={STATUS_STYLES[liveStatus]}>
          {STATUS_LABELS[liveStatus]}
        </Badge>
        <span className="text-xs text-muted-foreground capitalize">{need.need_type}</span>
        {need.category && <span className="text-xs text-muted-foreground">· {need.category}</span>}
      </div>

      {publishMutation.isError && (
        <p className="text-sm text-destructive">Failed to publish. Please try again.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main detail */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">{need.description}</p>
            {need.description_original && need.description_original !== need.description && (
              <div className="border-l-2 border-muted pl-3">
                <p className="text-xs text-muted-foreground mb-1">Original ({need.original_language})</p>
                <p className="text-sm text-muted-foreground">{need.description_original}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side info */}
        <div className="space-y-4">
          {/* Priority score */}
          <Card className="cursor-pointer" onClick={() => setShowPriority(!showPriority)}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Priority score</p>
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-3xl font-semibold text-primary">{need.priority_score?.toFixed(1) ?? '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">Click to {showPriority ? 'hide' : 'see'} breakdown</p>
              {showPriority && (
                <div className="mt-3 pt-3 border-t">
                  <PriorityTooltip need={need} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick facts */}
          <Card>
            <CardContent className="py-4 space-y-3">
              {need.location?.text && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{need.location.text}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{need.beneficiary_count} beneficiar{need.beneficiary_count !== 1 ? 'ies' : 'y'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{need.required_team_size} volunteer{need.required_team_size !== 1 ? 's' : ''} needed</span>
              </div>
              {deadline && (
                <div className={`flex items-center gap-2 text-sm ${deadline < new Date() ? 'text-red-500' : ''}`}>
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    {deadline < new Date() ? 'Overdue · ' : 'Due '}
                    {deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Required skills */}
          {need.required_skills?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Required skills</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 flex flex-wrap gap-1.5">
                {need.required_skills.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Assignments */}
      {assignmentsData?.items?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned volunteers ({assignmentsData.items.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 divide-y divide-border">
            {assignmentsData.items.map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.volunteer_name ?? 'Unknown volunteer'}</p>
                  <p className="text-xs text-muted-foreground">{a.volunteer_email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.role_in_team} · {(a.match_score * 100).toFixed(0)}% match
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className={`text-xs ${ASSIGNMENT_STATUS_STYLES[a.status]}`}>
                    {a.status.replace(/_/g, ' ')}
                  </Badge>
                  {a.status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}