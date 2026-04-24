'use client';
import { useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Users, Clock, ChevronRight } from 'lucide-react';
import type { Need, NeedsPage } from '@/lib/types/api';
import type { NeedStatus, Urgency } from '@/lib/types/enums';

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

const STATUS_FILTERS: { value: NeedStatus | 'all'; label: string }[] = [
  { value: 'all',             label: 'All' },
  { value: 'pending_review',  label: 'Pending review' },
  { value: 'published',       label: 'Published' },
  { value: 'assigned',        label: 'Assigned' },
  { value: 'in_progress',     label: 'In progress' },
  { value: 'completed',       label: 'Completed' },
];

const URGENCY_FILTERS: { value: Urgency | 'all'; label: string }[] = [
  { value: 'all',      label: 'All urgencies' },
  { value: 'critical', label: '🔴 Critical' },
  { value: 'high',     label: '🟠 High' },
  { value: 'medium',   label: '🟡 Medium' },
  { value: 'low',      label: '🟢 Low' },
];

function NeedCard({ need }: { need: Need }) {
  const deadline = need.deadline ? new Date(need.deadline) : null;
  const isOverdue = deadline && deadline < new Date();

  return (
    <Link href={`/needs/${need.id}`}>
      <Card className="hover:border-primary/40 transition-colors cursor-pointer group">
        <CardContent className="py-4 px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className={`text-xs ${URGENCY_STYLES[need.urgency]}`}>
                  {need.urgency}
                </Badge>
                <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[need.status]}`}>
                  {STATUS_LABELS[need.status]}
                </Badge>
                <span className="text-xs text-muted-foreground capitalize">{need.need_type}</span>
              </div>
              <p className="font-medium text-sm truncate">{need.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{need.description}</p>

              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                {need.location?.text && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {need.location.text}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {need.required_team_size} volunteer{need.required_team_size !== 1 ? 's' : ''}
                </span>
                {deadline && (
                  <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : ''}`}>
                    <Clock className="h-3 w-3" />
                    {isOverdue ? 'Overdue · ' : ''}{deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="text-right">
                <p className="text-lg font-semibold text-primary">
                  {need.priority_score?.toFixed(0) ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">priority</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function NeedCardSkeleton() {
  return (
    <Card>
      <CardContent className="py-4 px-5">
        <div className="flex gap-2 mb-2">
          <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
          <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="h-4 w-2/3 bg-muted animate-pulse rounded mb-2" />
        <div className="h-3 w-full bg-muted animate-pulse rounded" />
        <div className="h-3 w-4/5 bg-muted animate-pulse rounded mt-1" />
      </CardContent>
    </Card>
  );
}

function NeedsPageContent() {
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<NeedStatus | 'all'>(
    (searchParams.get('status') as NeedStatus) ?? 'all'
  );
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all');
  const [search, setSearch] = useState('');

  function buildQuery() {
    const params = new URLSearchParams();
    params.set('limit', '20');
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (urgencyFilter !== 'all') params.set('urgency', urgencyFilter);
    return params.toString();
  }

  const { data, isLoading } = useQuery<NeedsPage>({
    queryKey: ['needs', statusFilter, urgencyFilter],
    queryFn: () => apiFetch(`/needs?${buildQuery()}`),
  });

  const filtered = data?.items?.filter((n) =>
    search ? n.title.toLowerCase().includes(search.toLowerCase()) : true
  ) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Needs"
        subtitle={data ? `${data.items?.length ?? 0} needs` : undefined}
        action={
          <Button asChild size="sm">
            <Link href="/submissions/new">+ New submission</Link>
          </Button>
        }
      />

      {/* Filters */}
      <div className="space-y-3">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value as NeedStatus | 'all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Urgency + search row */}
        <div className="flex gap-3 items-center">
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value as Urgency | 'all')}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {URGENCY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search needs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <NeedCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No needs found"
          description={
            statusFilter !== 'all' || urgencyFilter !== 'all' || search
              ? 'Try adjusting your filters.'
              : 'Submit a field report to get started.'
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/submissions/new">New submission</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => <NeedCard key={n.id} need={n} />)}
        </div>
      )}
    </div>
  );
}

export default function NeedsPage() {
  return (
    <Suspense>
      <NeedsPageContent />
    </Suspense>
  );
}