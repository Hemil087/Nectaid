'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import type { VolunteerProfile } from '@/lib/types/api';
import { Star } from 'lucide-react';

export default function AdminVolunteersPage() {
  const [search, setSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');

  const { data, isLoading } = useQuery<{ items: (VolunteerProfile & { full_name: string; email: string })[] }>({
    queryKey: ['admin-volunteers', verifiedFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (verifiedFilter === 'verified') params.set('verified', 'true');
      if (verifiedFilter === 'unverified') params.set('verified', 'false');
      return apiFetch(`/volunteers?${params.toString()}`);
    },
  });

  const filtered = (data?.items ?? []).filter((v) =>
    search ? v.full_name?.toLowerCase().includes(search.toLowerCase()) || v.email?.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Volunteer Management"
        subtitle={data ? `${data.items?.length ?? 0} volunteers` : undefined}
      />

      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex gap-1">
          {(['all', 'verified', 'unverified'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setVerifiedFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                verifiedFilter === f
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
            <Card key={i}><CardContent className="py-3 px-5">
              <div className="h-4 w-1/3 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
            </CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No volunteers found" />
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => (
            <Link key={v.user_id} href={`/admin/volunteers/${v.user_id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer group">
                <CardContent className="py-3 px-5 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{v.full_name}</p>
                      {v.verified ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
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
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium">{(v.reliability_score * 5).toFixed(1)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{v.total_tasks_completed} tasks</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}