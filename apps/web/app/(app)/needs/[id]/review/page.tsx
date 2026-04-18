import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function NeedReviewPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Need"
        subtitle="Verify AI extraction before publishing"
      />
      <EmptyState title={`Review editor for need ${params.id} coming in Day 4`} />
    </div>
  );
}
