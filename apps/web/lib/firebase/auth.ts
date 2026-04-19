'use client';
import {
  getAuth,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
  type Auth,
} from 'firebase/auth';
import { firebaseApp } from './config';

let _auth: Auth | null = null;
function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(firebaseApp);
  return _auth;
}

async function setSessionCookie(idToken: string) {
  const res = await fetch('/api/auth/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    throw new Error('Failed to set session cookie');
  }
}

async function clearSessionCookie() {
  const res = await fetch('/api/auth/callback', {
    method: 'DELETE',
    credentials: 'same-origin',
  });

  if (!res.ok) {
    throw new Error('Failed to clear session cookie');
  }
}

export async function signIn(email: string, password: string) {
  const credentials = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  const idToken = await credentials.user.getIdToken();
  await setSessionCookie(idToken);
  return credentials;
}

export async function signOut() {
  await clearSessionCookie();
  return firebaseSignOut(getFirebaseAuth());
}

export function onAuth(callback: (user: User | null) => void) {
  return onIdTokenChanged(getFirebaseAuth(), callback);
}

export async function getToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}

export async function syncSessionCookie(idToken: string) {
  await setSessionCookie(idToken);
}
