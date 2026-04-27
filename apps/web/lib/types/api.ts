import type { Role, Urgency, NeedStatus, AssignmentStatus } from './enums';

export type { Role, Urgency, NeedStatus, AssignmentStatus };

export interface PriorityBreakdown {
  urgency_component: number;
  severity_component: number;
  beneficiary_component: number;
  time_pressure_component: number;
  resource_difficulty_component: number;
}

export interface MatchBreakdown {
  similarity: number;
  location_score: number;
  reliability: number;
  experience: number;
  recency_penalty: number;
}

export interface Need {
  id: string;
  title: string;
  description: string;
  description_original?: string;
  original_language?: string;
  need_type: string;
  category?: string;
  urgency: Urgency;
  priority_score: number;
  priority_breakdown: PriorityBreakdown;
  location: { lat: number; lng: number; text: string };
  beneficiary_count: number;
  required_skills: string[];
  required_team_size: number;
  resources_needed: string[];
  deadline?: string;
  window_start?: string;
  window_end?: string;
  status: NeedStatus;
  created_at: string;
}

export interface Assignment {
  id: string;
  need_id: string;
  need: Pick<Need, 'id' | 'title' | 'location' | 'urgency' | 'deadline'>;
  volunteer_id: string;
  volunteer_name?: string;
  volunteer_email?: string;
  role_in_team: string;
  match_score: number;
  match_breakdown: MatchBreakdown;
  status: AssignmentStatus;
  assigned_at: string;
  accept_deadline: string;
  completion_notes?: string;
  completion_photo_urls?: string[];
}

export interface VolunteerProfile {
  user_id: string;
  full_name?: string;
  skills: string[];
  certifications?: string[];
  home_address?: string;
  max_travel_km: number;
  verified: boolean;
  reliability_score: number;
  total_tasks_completed: number;
  notification_prefs: { email: boolean; in_app: boolean };
  preferred_language: 'en' | 'hi' | 'gu';
}

export interface DashboardData {
  open_needs_count: number;
  critical_needs_count: number;
  pending_review_count: number;
  active_volunteers: number;
  avg_response_time_minutes: number;
  beneficiaries_served_this_week: number;
  heatmap: { lat: number; lng: number; count: number }[];
}

export interface AppUser {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  org_id: string;
}

export interface Notification {
  id: string;
  subject: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
}

export interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  headline: string;
  metrics: Record<string, number>;
  pdf_url?: string;
  needs_by_type?: Record<string, number>;
  needs_by_urgency?: Record<string, number>;
  top_locations?: { location_text: string; count: number }[];
  narrative_paragraphs?: string[] | null;
}

export interface NeedsPage {
  items: Need[];
  next_cursor?: string;
  total: number;
}
