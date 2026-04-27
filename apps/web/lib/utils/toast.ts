/**
 * lib/utils/toast.ts
 *
 * Thin wrapper around sonner so every toast in the app has
 * consistent copy and styling. Import `t` instead of `toast`
 * directly so we can swap the provider in one place if needed.
 */
import { toast } from 'sonner';

export const t = {
  // ── Successes ──────────────────────────────────────────────
  assignmentAccepted: () =>
    toast.success('Assignment accepted', {
      description: 'You will receive a reminder before the task window.',
    }),

  assignmentDeclined: () =>
    toast.success('Assignment declined', {
      description: 'The coordinator has been notified.',
    }),

  taskStarted: () =>
    toast.success('Task marked as in progress'),

  taskCompleted: () =>
    toast.success('Task completed!', {
      description: 'The coordinator will review and rate your work.',
    }),

  needPublished: () =>
    toast.success('Need published', {
      description: 'Volunteer matching will start shortly.',
    }),

  needCancelled: () =>
    toast.success('Need cancelled'),

  needSaved: () =>
    toast.success('Changes saved'),

  notificationRead: () =>
    toast.success('Marked as read'),

  allNotificationsRead: () =>
    toast.success('All notifications marked as read'),

  profileUpdated: () =>
    toast.success('Profile updated'),

  submissionCreated: () =>
    toast.success('Report submitted', {
      description: 'AI extraction will run in the background.',
    }),

  photoUploaded: () =>
    toast.success('Photo uploaded'),

  // ── Errors ────────────────────────────────────────────────
  deadlineExpired: () =>
    toast.error('Deadline has passed', {
      description: 'This assignment can no longer be accepted.',
    }),

  alreadyResponded: () =>
    toast.error('Already responded to this assignment'),

  forbidden: () =>
    toast.error('You do not have permission to do that'),

  networkError: () =>
    toast.error('Network error', {
      description: 'Check your connection and try again.',
    }),

  generic: (message?: string) =>
    toast.error(message ?? 'Something went wrong', {
      description: 'Please try again or refresh the page.',
    }),
};