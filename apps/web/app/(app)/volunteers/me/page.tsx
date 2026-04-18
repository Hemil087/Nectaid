import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function MyProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" subtitle="Manage your skills, availability, and preferences" />
      <EmptyState title="Profile editor coming in Day 9" />
    </div>
  );
}
