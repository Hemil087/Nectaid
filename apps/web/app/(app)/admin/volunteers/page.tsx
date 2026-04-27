'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { volunteersApi, type AdminVolunteer } from '@/lib/api/volunteers';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, CheckCircle2, Clock, Star, ShieldOff, AlertTriangle } from 'lucide-react';

type Filter = 'all' | 'verified' | 'unverified';

export default function AdminVolunteersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmSuspend, setConfirmSuspend] = useState<AdminVolunteer | null>(null);

  const params = new URLSearchParams();
  if (filter === 'verified') params.set('verified', 'true');
  if (filter === 'unverified') params.set('verified', 'false');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-volunteers', filter],
    queryFn: () => volunteersApi.adminList(params),
  });

  const verifyMutation = useMutation({
    mutationFn: (userId: string) => volunteersApi.verify(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-volunteers'] }),
  });

  const suspendMutation = useMutation({
    mutationFn: (userId: string) => volunteersApi.suspend(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-volunteers'] });
      setConfirmSuspend(null);
    },
  });

  const filtered = (data?.items ?? []).filter((v) =>
    search
      ? v.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        v.email?.toLowerCase().includes(search.toLowerCase())
      : true
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Volunteer Management"
        subtitle={data ? `${data.total} volunteers` : undefined}
      />

      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex gap-1">
          {(['all', 'verified', 'unverified'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-3 px-5">
                <Skeleton className="h-4 w-1/3 mb-1" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No volunteers found" />
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => (
            <Card key={v.user_id} className={v.deleted_at ? 'opacity-50' : ''}>
              <CardContent className="py-3 px-5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{v.full_name}</p>
                    {v.verified ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    )}
                    {v.deleted_at && (
                      <Badge variant="destructive" className="text-[10px] py-0">suspended</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{v.email}</p>
                  {v.skills?.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {v.skills.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                      {v.skills.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{v.skills.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-medium">{(v.reliability_score * 5).toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{v.total_tasks_completed} tasks</p>
                  </div>

                  {!v.deleted_at && (
                    <div className="flex gap-2">
                      {!v.verified && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 h-8"
                          disabled={verifyMutation.isPending && verifyMutation.variables === v.user_id}
                          onClick={() => verifyMutation.mutate(v.user_id)}
                        >
                          {verifyMutation.isPending && verifyMutation.variables === v.user_id
                            ? 'Verifying…'
                            : 'Verify'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8"
                        onClick={() => setConfirmSuspend(v)}
                      >
                        <ShieldOff className="h-3.5 w-3.5 mr-1" />
                        Suspend
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!confirmSuspend} onOpenChange={(open) => !open && setConfirmSuspend(null)}>
        <DialogContent className="sm:max-w-md border-destructive/20">
          <DialogHeader className="flex flex-col items-center sm:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-xl text-red-600">Suspend Volunteer?</DialogTitle>
            <DialogDescription className="text-center pt-2 text-muted-foreground text-base">
              Are you sure you want to suspend <strong className="text-foreground font-bold">{confirmSuspend?.full_name}</strong>?
              <br /><br />
              They will be soft-deleted and immediately logged out. This action can be reversed from the database but <span className="font-bold text-red-600">not from this UI</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0 w-full flex-col sm:flex-row mt-4">
            <Button variant="outline" onClick={() => setConfirmSuspend(null)} className="w-full">
              Cancel
            </Button>
            <Button
              disabled={suspendMutation.isPending}
              onClick={() => confirmSuspend && suspendMutation.mutate(confirmSuspend.user_id)}
              className="w-full bg-red-600 hover:bg-red-700 text-white shadow-sm"
            >
              {suspendMutation.isPending ? 'Suspending…' : 'Yes, Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
