import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NeedsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Needs"
        action={<Button asChild><Link href="/submissions/new">+ New Submission</Link></Button>}
      />
      <EmptyState title="Needs list coming in Day 4" description="Filterable table of all field needs will appear here." />
    </div>
  );
}
