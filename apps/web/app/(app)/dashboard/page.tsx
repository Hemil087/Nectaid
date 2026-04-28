'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/providers/auth-provider';
import { useCoordinatorFeed } from '@/lib/hooks/use-coordinator-feed';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, Users, ClipboardList, Clock, Heart, ArrowRight, Bell
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { DashboardData, Need } from '@/lib/types/api';

const URGENCY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-green-100 text-green-700 border-green-200',
};

function StatCard({
  label, value, icon: Icon, highlight,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <Card className={`transition-all hover:shadow-md hover:-translate-y-0.5 ${highlight ? 'border-red-200 bg-red-50/50' : ''}`}>
      <CardContent className="py-5 flex items-center gap-4">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-red-100' : 'bg-muted'}`}>
          <Icon className={`h-5 w-5 ${highlight ? 'text-red-600' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <p className={`text-2xl font-semibold ${highlight ? 'text-red-700' : ''}`}>{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NeedRow({ need }: { need: Need }) {
  return (
    <Link
      href={`/needs/${need.id}`}
      className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Badge
          variant="outline"
          className={`text-xs shrink-0 ${URGENCY_STYLES[need.urgency] ?? ''}`}
        >
          {need.urgency}
        </Badge>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{need.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {need.location?.text ?? '—'} · {need.required_team_size} volunteer{need.required_team_size !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch('/analytics/dashboard'),
    refetchInterval: 60_000,
  });

  const { data: pendingReview } = useQuery<{ items: Need[] }>({
    queryKey: ['needs', 'pending_review'],
    queryFn: () => apiFetch('/needs?status=pending_review&limit=5'),
  });

  const { data: activeNeeds } = useQuery<{ items: Need[] }>({
    queryKey: ['needs', 'active'],
    queryFn: () => apiFetch('/needs?status=published&limit=5'),
  });

  // Firestore realtime feed — only fires when org_id is available
  const { events, unreadCount, markRead } = useCoordinatorFeed(user?.org_id ?? null);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of needs and volunteer activity"
        action={
          <Button asChild size="sm">
            <Link href="/submissions/new">+ New submission</Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-5">
                <div className="h-8 w-12 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Critical needs"
              value={stats?.critical_needs_count ?? 0}
              icon={AlertTriangle}
              highlight={(stats?.critical_needs_count ?? 0) > 0}
            />
            <StatCard
              label="Pending review"
              value={stats?.pending_review_count ?? 0}
              icon={ClipboardList}
            />
            <StatCard
              label="Open needs"
              value={stats?.open_needs_count ?? 0}
              icon={ClipboardList}
            />
            <StatCard
              label="Active volunteers"
              value={stats?.active_volunteers ?? 0}
              icon={Users}
            />
            <StatCard
              label="Avg response time"
              value={stats ? `${stats.avg_response_time_minutes}m` : '—'}
              icon={Clock}
            />
          </>
        )}
      </div>

      {/* Beneficiaries banner */}
      {stats && stats.beneficiaries_served_this_week > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="py-4 flex items-center gap-3">
            <Heart className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700">
              <span className="font-semibold">{stats.beneficiaries_served_this_week}</span>{' '}
              beneficiaries served this week
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending review */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Pending review</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/needs?status=pending_review">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {!pendingReview?.items?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No needs pending review — nice work.
              </p>
            ) : (
              <div className="divide-y divide-border -mx-4">
                {pendingReview.items.map((n) => (
                  <NeedRow key={n.id} need={n} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active needs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Active needs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/needs?status=published">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {!activeNeeds?.items?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No active needs right now.
              </p>
            ) : (
              <div className="divide-y divide-border -mx-4">
                {activeNeeds.items.map((n) => (
                  <NeedRow key={n.id} need={n} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live activity feed */}
      {events.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Live activity
              {unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                  {unreadCount} new
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 divide-y divide-border">
            {events.map((event) => (
              <div
                key={event.id}
                className={`py-3 flex items-start gap-3 rounded transition-colors hover:bg-muted/40 ${!event.read ? 'bg-primary/5 -mx-6 px-6' : ''}`}
              >
                <div className={`p-1.5 rounded-full shrink-0 mt-0.5 ${!event.read ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Bell className={`h-3 w-3 ${!event.read ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{event.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!event.read && (
                  <button
                    onClick={() => markRead(event.id)}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}