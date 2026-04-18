export type Role = 'volunteer' | 'coordinator' | 'admin';
export type Urgency = 'critical' | 'high' | 'medium' | 'low';
export type NeedStatus =
  | 'pending_review'
  | 'published'
  | 'matching_complete'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';
export type AssignmentStatus =
  | 'pending_accept'
  | 'accepted'
  | 'declined'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'expired';
