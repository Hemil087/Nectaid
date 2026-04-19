import 'server-only';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function parseServiceAccount(raw: string): ServiceAccount {
  const trimmed = raw.trim();
  const normalized =
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ? trimmed.slice(1, -1)
      : trimmed;

  try {
    const parsed = JSON.parse(normalized) as ServiceAccount | string;
    return typeof parsed === 'string'
      ? (JSON.parse(parsed) as ServiceAccount)
      : parsed;
  } catch (error) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON with double-quoted keys and values. ' +
        'In apps/web/.env.local, set it to the full service account JSON contents as one string.',
      { cause: error },
    );
  }
}

function getServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
  }

  const parsed = parseServiceAccount(raw);

  return {
    ...parsed,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
  };
}

function getFirebaseAdminApp() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(getServiceAccount()),
    });
  }

  return getApps()[0]!;
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}
