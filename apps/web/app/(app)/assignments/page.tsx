'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Clock, ChevronRight, AlertTriangle } from 'lucide-react';
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

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  pending_accept: 'Action required',
  accepted:       'Accepted',
  declined:       'Declined',
  in_progress:    'In progress',
  completed:      'Completed',
  cancelled:      'Cancelled',
  no_show:        'No show',
  expired:        'Expired',
};

const URGENCY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-green-100 text-green-700 border-green-200',
};

const TABS: { value: AssignmentStatus | 'active' | 'all'; label: string }[] = [
  { value: 'active',         label: 'Active' },
  { value: 'pending_accept', label: 'Pending' },
  { value: 'completed',      label: 'Completed' },
  { value: 'all',            label: 'All' },
];

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const deadline = assignment.accept_deadline ? new Date(assignment.accept_deadline) : null;
  const isPending = assignment.status === 'pending_accept';
  const isExpiringSoon = deadline && isPending && (deadline.getTime() - Date.now()) < 5 * 60 * 1000;

  return (
    <Link href={`/assignments/${assignment.id}`}>
      <Card className={`hover:border-primary/40 transition-colors cursor-pointer group ${isPending ? 'border-yellow-300' : ''}`}>
        <CardContent className="py-4 px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className={`text-xs ${STATUS_STYLES[assignment.status]}`}>
                  {STATUS_LABELS[assignment.status]}
                </Badge>
                {assignment.need?.urgency && (
                  <Badge variant="outline" className={`text-xs ${URGENCY_STYLES[assignment.need.urgency]}`}>
                    {assignment.need.urgency}
                  </Badge>
                )}
                {isExpiringSoon && (
                  <span className="flex items-center gap-1 text-xs text-red-500">
                    <AlertTriangle className="h-3 w-3" /> Expiring soon
                  </span>
                )}
              </div>
              <p className="font-medium text-sm truncate">{assignment.need?.title ?? `Assignment #${assignment.id.slice(0,8)}`}</p>
              {assignment.role_in_team && (
                <p className="text-xs text-muted-foreground mt-0.5">Role: {assignment.role_in_team}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                {assignment.need?.location?.text && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {assignment.need.location.text}
                  </span>
                )}
                {isPending && deadline && (
                  <span className={`flex items-center gap-1 ${isExpiringSoon ? 'text-red-500' : ''}`}>
                    <Clock className="h-3 w-3" />
                    Accept by {deadline.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <p className="text-xs text-muted-foreground">
                {(assignment.match_score * 100).toFixed(0)}% match
              </p>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function AssignmentsPage() {
  const [tab, setTab] = useState<AssignmentStatus | 'active' | 'all'>('active');

  const { data, isLoading } = useQuery<{ items: Assignment[] }>({
    queryKey: ['assignments-me'],
    queryFn: () => apiFetch('/volunteers/me/assignments'),
  });

  const filtered = (data?.items ?? []).filter((a) => {
    if (tab === 'all') return true;
    if (tab === 'active') return ['pending_accept', 'accepted', 'in_progress'].includes(a.status);
    return a.status === tab;
  });

  const pendingCount = (data?.items ?? []).filter((a) => a.status === 'pending_accept').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assignments"
        subtitle={pendingCount > 0 ? `${pendingCount} assignment${pendingCount !== 1 ? 's' : ''} awaiting your response` : undefined}
      />

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {t.label}
            {t.value === 'pending_accept' && pendingCount > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-white rounded-full px-1.5 py-0.5 text-xs">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="py-4 px-5">
              <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
              <div className="h-4 w-2/3 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
            </CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'No active assignments' : 'No assignments here'}
          description={tab === 'active' ? "You'll be notified by email when you're matched to a need." : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
        </div>
      )}
    </div>
  );
}