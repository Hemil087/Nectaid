import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function AdminVolunteerDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <PageHeader title={`Volunteer #${params.id}`} />
      <EmptyState title="Volunteer detail + verify/suspend coming in Day 9" />
    </div>
  );
}
