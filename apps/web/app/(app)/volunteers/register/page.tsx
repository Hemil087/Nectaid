import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function VolunteerRegisterPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Volunteer Registration" subtitle="Complete your profile to get started" />
      <EmptyState title="Multi-step registration form coming in Day 6" />
    </div>
  );
}
