import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function NewSubmissionPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Report a Need" subtitle="Describe the situation and attach photos" />
      <EmptyState title="Submission form coming in Day 3" />
    </div>
  );
}
