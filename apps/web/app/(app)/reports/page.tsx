'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Download, FileText, TrendingUp,
  Clock, Heart, Users, AlertCircle,
} from 'lucide-react';

import { apiFetch } from '@/lib/api/client';
import { isoWeek, formatWeekLabel } from '@/lib/api/reports';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { WeeklyReport } from '@/lib/types/api';

// ── Week picker options (current + last 8 weeks) ───────────────────────────

const WEEK_OPTIONS = Array.from({ length: 9 }, (_, i) => ({
  value: isoWeek(-i),
  label: i === 0 ? `This week (${isoWeek(0)})` : formatWeekLabel(isoWeek(-i)),
}));

// ── Urgency colours ────────────────────────────────────────────────────────

const URGENCY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-yellow-400',
  low:      'bg-green-500',
};

// ── Sub-components ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="py-5">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="py-6">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function NeedsByTypeChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count,
  }));

  if (chartData.length === 0) return (
    <p className="text-sm text-muted-foreground py-8 text-center">No data for this week</p>
  );

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))' }}
          contentStyle={{
            background: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function UrgencyBreakdown({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([urgency, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={urgency} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="capitalize text-muted-foreground">{urgency}</span>
              <span className="font-medium">{count}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${URGENCY_COLORS[urgency] ?? 'bg-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  // Default to last week so there's likely data to show
  const [selectedWeek, setSelectedWeek] = useState(WEEK_OPTIONS[1].value);

  const { data, isLoading } = useQuery<WeeklyReport>({
    queryKey: ['weekly-report', selectedWeek],
    queryFn: () => apiFetch(`/reports/weekly?week=${selectedWeek}`),
  });

  const { data: pdfData } = useQuery<{ url: string }>({
    queryKey: ['weekly-report-pdf', selectedWeek],
    queryFn: () => apiFetch(`/reports/weekly.pdf?week=${selectedWeek}`),
    enabled: !!data,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="space-y-6 w-full max-w-3xl">
      <PageHeader
        title="Weekly Reports"
        subtitle="AI-generated impact summaries for your organisation"
        action={
          <div className="flex items-center gap-3 flex-wrap">
            {/* Week picker */}
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {WEEK_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {pdfData?.url && (
              <Button size="sm" asChild>
                <a href={pdfData.url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </a>
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <LoadingSkeleton />
      ) : !data ? (
        <EmptyState
          title="No report for this week"
          description="Weekly reports are generated every Monday at 6:00 AM IST. Try selecting a past week."
        />
      ) : (
        <div className="space-y-6">

          {/* Headline card — existing pattern kept */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-5 flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Week of {format(new Date(data.week_start), 'MMM d')} –{' '}
                  {format(new Date(data.week_end), 'MMM d, yyyy')}
                </p>
                <p className="font-semibold">{data.headline}</p>
              </div>
            </CardContent>
          </Card>

          {/* KPI metrics — existing pattern kept */}
          {data.metrics && Object.keys(data.metrics).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Key metrics</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Object.entries(data.metrics).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-2xl font-semibold">{String(value)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {key.replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Charts row — new */}
          {(data.needs_by_type || data.needs_by_urgency) && (
            <div className="grid gap-6 sm:grid-cols-2">
              {data.needs_by_type && Object.keys(data.needs_by_type).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Needs by type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <NeedsByTypeChart data={data.needs_by_type} />
                  </CardContent>
                </Card>
              )}
              {data.needs_by_urgency && Object.keys(data.needs_by_urgency).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Needs by urgency</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <UrgencyBreakdown data={data.needs_by_urgency} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Top locations — new */}
          {data.top_locations && data.top_locations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top locations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.top_locations.slice(0, 8).map(loc => (
                    <Badge key={loc.location_text} variant="secondary">
                      {loc.location_text}
                      <span className="ml-1 font-semibold">{loc.count}</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Narrative paragraphs — new */}
          {data.narrative_paragraphs && data.narrative_paragraphs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Impact summary</CardTitle>
                <p className="text-xs text-muted-foreground">AI-generated narrative</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {data.narrative_paragraphs.map((para, i) => (
                    <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                      {para}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* PDF download card — existing pattern kept */}
          <Card>
            <CardContent className="py-5 flex items-center gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Full report PDF</p>
                <p className="text-xs text-muted-foreground">
                  Detailed breakdown with charts — valid for 15 minutes
                </p>
              </div>
              {pdfData?.url ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={pdfData.url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" /> Download
                  </a>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>Generating…</Button>
              )}
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}