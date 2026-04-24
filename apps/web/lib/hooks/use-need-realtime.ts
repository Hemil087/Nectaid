'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import type { NeedRealtime } from '@/lib/types/firestore';

export function useNeedRealtime(needId: string | null) {
  const [data, setData] = useState<NeedRealtime | null>(null);
  // Start as false when needId is null — no loading needed
  const [loading, setLoading] = useState(needId !== null);

  useEffect(() => {
    if (!needId) {
      return;
    }

    setLoading(true);
    const ref = doc(db, 'needs_realtime', needId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? (snap.data() as NeedRealtime) : null);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [needId]);

  return { data, loading };
}