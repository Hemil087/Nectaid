'use client';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from 'firebase/auth';
import { firebaseApp } from './config';

let _auth: Auth | null = null;
function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(firebaseApp);
  return _auth;
}

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signOut() {
  return firebaseSignOut(getFirebaseAuth());
}

export function onAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function getToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}
