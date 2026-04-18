import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function NeedDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <PageHeader title={`Need #${params.id}`} />
      <EmptyState title="Need detail view coming in Day 5" />
    </div>
  );
}
