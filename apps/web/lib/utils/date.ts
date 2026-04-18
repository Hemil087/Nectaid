import { formatDistanceToNow, format, isAfter } from 'date-fns';

export function relativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy') {
  return format(new Date(date), fmt);
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'MMM d, yyyy HH:mm');
}

export function isExpired(date: string | Date) {
  return !isAfter(new Date(date), new Date());
}
