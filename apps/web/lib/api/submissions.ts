import { apiFetch } from './client';

export interface SubmissionPayload {
  raw_text?: string;
  image_urls?: string[];
}

export const submissionsApi = {
  create: (payload: SubmissionPayload) =>
    apiFetch<{ id: string; status: string }>('/submissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
