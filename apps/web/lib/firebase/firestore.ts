import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseApp } from './config';

export const isFirestoreRealtimeEnabled =
  process.env.NEXT_PUBLIC_ENABLE_FIRESTORE_REALTIME === 'true';

export const db: Firestore | null = isFirestoreRealtimeEnabled
  ? getFirestore(firebaseApp)
  : null;
