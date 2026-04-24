'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, Clock, Star } from 'lucide-react';
import type { VolunteerProfile } from '@/lib/types/api';

export default function AdminVolunteerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: volunteer, isLoading } = useQuery<VolunteerProfile & { full_name: string; email: string }>({
    queryKey: ['admin-volunteer', id],
    queryFn: () => apiFetch(`/volunteers/${id}`),
  });

  const verifyMutation = useMutation({
    mutationFn: () => apiFetch(`/volunteers/${id}/verify`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-volunteer', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-volunteers'] });
    },
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

  if (!volunteer) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/volunteers"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Volunteer not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/volunteers"><ArrowLeft className="h-4 w-4 mr-2" /> All volunteers</Link>
      </Button>

      <PageHeader
        title={volunteer.full_name}
        subtitle={volunteer.email}
        action={
          !volunteer.verified ? (
            <Button
              size="sm"
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {verifyMutation.isPending ? 'Verifying…' : 'Verify volunteer'}
            </Button>
          ) : (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Verified
            </Badge>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-semibold">{volunteer.total_tasks_completed}</p>
            <p className="text-xs text-muted-foreground mt-1">Tasks done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <p className="text-2xl font-semibold">{(volunteer.reliability_score * 5).toFixed(1)}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Reliability</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center">
              {volunteer.verified
                ? <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                : <Clock className="h-6 w-6 text-yellow-500" />
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {volunteer.verified ? 'Verified' : 'Pending'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Skills</CardTitle></CardHeader>
        <CardContent>
          {volunteer.skills?.length ? (
            <div className="flex flex-wrap gap-2">
              {volunteer.skills.map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No skills listed.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Home address</span>
            <span>{volunteer.home_address || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max travel</span>
            <span>{volunteer.max_travel_km} km</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Language</span>
            <span className="uppercase">{volunteer.preferred_language}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email notifications</span>
            <span>{volunteer.notification_prefs?.email ? 'On' : 'Off'}</span>
          </div>
        </CardContent>
      </Card>

      {verifyMutation.isError && (
        <p className="text-sm text-destructive">Failed to verify. Please try again.</p>
      )}
    </div>
  );
}