import { PageHeader } from '@/components/shared/page-header';
import { SubmissionForm } from '@/components/submissions/submission-form';

export default function NewSubmissionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Report a Need"
        subtitle="Describe the situation and attach photos — AI extracts structured needs automatically"
      />
      <SubmissionForm />
    </div>
  );
}
