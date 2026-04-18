import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of active needs and volunteer activity" />
      <EmptyState title="Dashboard coming in Day 8" description="Stats, heatmap, and activity feed will appear here." />
    </div>
  );
}
