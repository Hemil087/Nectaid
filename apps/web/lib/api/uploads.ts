import { apiFetch } from './client';

export async function getSignedUrl(filename: string, purpose = 'submission') {
  return apiFetch<{ upload_url: string; public_url: string }>(
    `/uploads/signed-url?filename=${encodeURIComponent(filename)}&purpose=${purpose}`,
    { method: 'POST' },
  );
}

export async function uploadToGcs(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('Upload failed');
}
