import type { NeedStatus, AssignmentStatus } from './enums';

export interface NeedRealtime {
  status: NeedStatus;
  priority_score: number;
  updated_at: string;
}

export interface TaskStatus {
  status: AssignmentStatus;
  updated_at: string;
}

export interface FeedEvent {
  id: string;
  type: string;
  message: string;
  need_id?: string;
  created_at: string;
  read : boolean;
}
