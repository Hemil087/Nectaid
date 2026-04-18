import { cn } from '@/lib/utils/cn';
import type { Urgency } from '@/lib/types/enums';

const styles: Record<Urgency, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-green-100 text-green-700 border-green-200',
};

const labels: Record<Urgency, string> = {
  critical: 'Critical',
  high:     'High',
  medium:   'Medium',
  low:      'Low',
};

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium',
        styles[urgency],
      )}
    >
      {labels[urgency]}
    </span>
  );
}
