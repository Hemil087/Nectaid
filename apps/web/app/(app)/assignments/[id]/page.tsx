import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function AssignmentDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <PageHeader title={`Assignment #${params.id}`} />
      <EmptyState title="Assignment detail coming in Day 6" />
    </div>
  );
}
