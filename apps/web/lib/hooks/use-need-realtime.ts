'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import type { NeedRealtime } from '@/lib/types/firestore';

/**
 * Listens to /needs_realtime/{needId} in Firestore.
 * Returns the latest realtime snapshot of a need's status and priority score.
 * Falls back gracefully if the document doesn't exist yet.
 */
export function useNeedRealtime(needId: string | null) {
  const [data, setData] = useState<NeedRealtime | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!needId) {
      setLoading(false);
      return;
    }

    const ref = doc(db, 'needs_realtime', needId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setData(snap.data() as NeedRealtime);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      () => {
        // Firestore permission error or offline — degrade silently
        setLoading(false);
      }
    );

    return () => unsub();
  }, [needId]);

  return { data, loading };
}