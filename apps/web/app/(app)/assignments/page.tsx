import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function AssignmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Assignments" />
      <EmptyState title="Assignment list coming in Day 6" description="Your assigned volunteer tasks will appear here." />
    </div>
  );
}
