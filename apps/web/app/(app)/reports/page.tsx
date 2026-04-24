'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, TrendingUp } from 'lucide-react';
import type { WeeklyReport } from '@/lib/types/api';
import { format } from 'date-fns';

export default function ReportsPage() {
  const { data, isLoading } = useQuery<WeeklyReport>({
    queryKey: ['weekly-report'],
    queryFn: () => apiFetch('/reports/weekly'),
  });

  const { data: pdfData } = useQuery<{ url: string }>({
    queryKey: ['weekly-report-pdf'],
    queryFn: () => apiFetch('/reports/weekly.pdf'),
    enabled: !!data,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Weekly Reports"
        subtitle="AI-generated impact summaries for your organisation"
        action={
          pdfData?.url ? (
            <Button size="sm" asChild>
              <a href={pdfData.url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </a>
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Card><CardContent className="py-6">
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-4 bg-muted animate-pulse rounded" style={{width: `${60 + i * 10}%`}} />)}
            </div>
          </CardContent></Card>
        </div>
      ) : !data ? (
        <EmptyState
          title="No reports yet"
          description="Weekly reports are generated every Monday at 6:00 AM IST."
        />
      ) : (
        <div className="space-y-6">
          {/* Headline */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-5 flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Week of {format(new Date(data.week_start), 'MMM d')} – {format(new Date(data.week_end), 'MMM d, yyyy')}
                </p>
                <p className="font-semibold">{data.headline}</p>
              </div>
            </CardContent>
          </Card>

          {/* Metrics */}
          {data.metrics && Object.keys(data.metrics).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Key metrics</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Object.entries(data.metrics).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-2xl font-semibold">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {key.replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* PDF download */}
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