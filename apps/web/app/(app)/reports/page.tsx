import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Weekly Reports" />
      <EmptyState title="Weekly reports and PDF downloads coming in Day 8" />
    </div>
  );
}
