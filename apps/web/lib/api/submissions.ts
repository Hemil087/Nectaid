import { getToken } from '@/lib/firebase/auth';

export interface SubmissionCreatePayload {
  raw_text?: string;
  files?: File[];
}

/**
 * POST /submissions — multipart/form-data
 *
 * The backend uses FastAPI Form() + File() params, so we must send
 * multipart/form-data. Do NOT set Content-Type manually — the browser
 * must set it (including the boundary) when using FormData.
 */
export const submissionsApi = {
  async create(payload: SubmissionCreatePayload): Promise<{ id: string; status: string; created_at: string }> {
    const token = await getToken();

    const form = new FormData();
    if (payload.raw_text) {
      form.append('raw_text', payload.raw_text);
    }
    for (const file of payload.files ?? []) {
      form.append('files', file, file.name);
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/submissions`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
        // ⚠️ Do NOT set Content-Type — FormData needs to set its own boundary
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail ?? `Upload failed (${res.status})`);
    }
    return res.json();
  },
};

