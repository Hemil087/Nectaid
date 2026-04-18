import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" />
      <EmptyState title="Notification inbox coming in Day 7" />
    </div>
  );
}
