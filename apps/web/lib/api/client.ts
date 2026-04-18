import { getToken } from '@/lib/firebase/auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1${path}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.error?.code, err?.error?.message);
  }
  return res.json() as Promise<T>;
}
