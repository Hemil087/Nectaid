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
import { Label } from '@/components/ui/label';
import { ArrowLeft, MapPin, Clock, Users, CheckCircle2, XCircle, Play } from 'lucide-react';
import type { Assignment } from '@/lib/types/api';
import type { AssignmentStatus } from '@/lib/types/enums';

const STATUS_STYLES: Record<AssignmentStatus, string> = {
  pending_accept: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  accepted:       'bg-blue-100 text-blue-700 border-blue-200',
  declined:       'bg-red-100 text-red-600 border-red-200',
  in_progress:    'bg-amber-100 text-amber-700 border-amber-200',
  completed:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled:      'bg-zinc-100 text-zinc-400 border-zinc-200',
  no_show:        'bg-red-100 text-red-400 border-red-200',
  expired:        'bg-zinc-100 text-zinc-400 border-zinc-200',
};

const URGENCY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-green-100 text-green-700 border-green-200',
};

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [showCompleteForm, setShowCompleteForm] = useState(false);

  const { data: assignment, isLoading } = useQuery<Assignment>({
    queryKey: ['assignment', id],
    queryFn: () => apiFetch<{ items: Assignment[] }>(`/volunteers/me/assignments`).then(
      (res) => {
        const found = res.items.find((a) => a.id === id);
        if (!found) throw new Error('Not found');
        return found;
      }
    ),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['assignment', id] });
    queryClient.invalidateQueries({ queryKey: ['assignments-me'] });
  }

  const acceptMutation = useMutation({
    mutationFn: () => apiFetch(`/assignments/${id}/accept`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  const declineMutation = useMutation({
    mutationFn: () => apiFetch(`/assignments/${id}/decline`, {
      method: 'POST',
      body: JSON.stringify({ reason: declineReason }),
    }),
    onSuccess: () => { invalidate(); router.push('/assignments'); },
  });

  const startMutation = useMutation({
    mutationFn: () => apiFetch(`/assignments/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: 'in_progress' }),
    }),
    onSuccess: invalidate,
  });

  const completeMutation = useMutation({
    mutationFn: () => apiFetch(`/assignments/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: 'completed', notes: completionNotes }),
    }),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <Card><CardContent className="py-8">
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-4 bg-muted animate-pulse rounded" />)}
          </div>
        </CardContent></Card>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/assignments"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Assignment not found.</p>
      </div>
    );
  }

  const isPending = assignment.status === 'pending_accept';
  const isAccepted = assignment.status === 'accepted';
  const isInProgress = assignment.status === 'in_progress';
  const deadline = assignment.accept_deadline ? new Date(assignment.accept_deadline) : null;
  const isExpired = deadline && deadline < new Date();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/assignments"><ArrowLeft className="h-4 w-4 mr-2" /> All assignments</Link>
      </Button>

      <PageHeader title={assignment.need?.title ?? 'Assignment'} />

      {/* Status badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={STATUS_STYLES[assignment.status]}>
          {assignment.status.replace('_', ' ')}
        </Badge>
        {assignment.need?.urgency && (
          <Badge variant="outline" className={URGENCY_STYLES[assignment.need.urgency]}>
            {assignment.need.urgency}
          </Badge>
        )}
        {assignment.role_in_team && (
          <span className="text-xs text-muted-foreground">Role: {assignment.role_in_team}</span>
        )}
      </div>

      {/* Need details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Task details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {assignment.need?.location?.text && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{assignment.need.location.text}</span>
            </div>
          )}
          {assignment.need?.deadline && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Due {new Date(assignment.need.deadline).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>Match score: {(assignment.match_score * 100).toFixed(0)}%</span>
          </div>
          {isPending && deadline && (
            <div className={`flex items-center gap-2 text-sm ${isExpired ? 'text-red-500' : 'text-yellow-600'}`}>
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                {isExpired ? 'Acceptance deadline passed' : `Accept by ${deadline.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {isPending && !isExpired && (
        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {acceptMutation.isPending ? 'Accepting…' : 'Accept assignment'}
          </Button>
          {!showDeclineForm ? (
            <Button variant="outline" className="w-full" onClick={() => setShowDeclineForm(true)}>
              <XCircle className="h-4 w-4 mr-2" /> Decline
            </Button>
          ) : (
            <Card className="border-red-200">
              <CardContent className="py-4 space-y-3">
                <div className="space-y-2">
                  <Label>Reason for declining (optional)</Label>
                  <input
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="e.g. Out of station, schedule conflict"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive" size="sm" className="flex-1"
                    onClick={() => declineMutation.mutate()}
                    disabled={declineMutation.isPending}
                  >
                    {declineMutation.isPending ? 'Declining…' : 'Confirm decline'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeclineForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {acceptMutation.isError && <p className="text-sm text-destructive">Failed to accept. Please try again.</p>}
        </div>
      )}

      {isAccepted && (
        <Button
          className="w-full"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          <Play className="h-4 w-4 mr-2" />
          {startMutation.isPending ? 'Starting…' : 'Mark as in progress'}
        </Button>
      )}

      {isInProgress && (
        <div className="space-y-3">
          {!showCompleteForm ? (
            <Button className="w-full" onClick={() => setShowCompleteForm(true)}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as completed
            </Button>
          ) : (
            <Card className="border-emerald-200">
              <CardContent className="py-4 space-y-3">
                <div className="space-y-2">
                  <Label>Completion notes (optional)</Label>
                  <textarea
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    placeholder="e.g. Checked 23 children, 3 referred to district hospital"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm" className="flex-1"
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                  >
                    {completeMutation.isPending ? 'Saving…' : 'Submit completion'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowCompleteForm(false)}>
                    Cancel
                  </Button>
                </div>
                {completeMutation.isError && <p className="text-sm text-destructive">Failed to complete. Please try again.</p>}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {assignment.status === 'completed' && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-700">Task completed</p>
              {assignment.completion_notes && (
                <p className="text-xs text-emerald-600 mt-0.5">{assignment.completion_notes}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}