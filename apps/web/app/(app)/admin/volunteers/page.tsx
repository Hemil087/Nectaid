import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function AdminVolunteersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Volunteer Management" />
      <EmptyState title="Volunteer admin table coming in Day 9" />
    </div>
  );
}
