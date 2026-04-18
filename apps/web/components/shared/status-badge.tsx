import { cn } from '@/lib/utils/cn';
import type { NeedStatus, AssignmentStatus } from '@/lib/types/enums';

const needStyles: Record<NeedStatus, string> = {
  pending_review:    'bg-yellow-100 text-yellow-700',
  published:         'bg-blue-100 text-blue-700',
  matching_complete: 'bg-purple-100 text-purple-700',
  assigned:          'bg-indigo-100 text-indigo-700',
  in_progress:       'bg-cyan-100 text-cyan-700',
  completed:         'bg-green-100 text-green-700',
  cancelled:         'bg-gray-100 text-gray-500',
  expired:           'bg-gray-100 text-gray-400',
};

const assignmentStyles: Record<AssignmentStatus, string> = {
  pending_accept: 'bg-yellow-100 text-yellow-700',
  accepted:       'bg-blue-100 text-blue-700',
  in_progress:    'bg-cyan-100 text-cyan-700',
  completed:      'bg-green-100 text-green-700',
  declined:       'bg-red-100 text-red-700',
  expired:        'bg-gray-100 text-gray-400',
  no_show:        'bg-red-100 text-red-700',
  cancelled:      'bg-gray-100 text-gray-500',
};

function formatLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function NeedStatusBadge({ status }: { status: NeedStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', needStyles[status])}>
      {formatLabel(status)}
    </span>
  );
}

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', assignmentStyles[status])}>
      {formatLabel(status)}
    </span>
  );
}
