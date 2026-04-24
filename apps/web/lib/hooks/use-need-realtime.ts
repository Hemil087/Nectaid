'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import type { NeedRealtime } from '@/lib/types/firestore';

export function useNeedRealtime(needId: string | null) {
  const [data, setData] = useState<NeedRealtime | null>(null);

  useEffect(() => {
    if (!needId) return;
    const ref = doc(db, 'needs_realtime', needId);
    const unsub = onSnapshot(ref, (snap) => {
      setData(snap.exists() ? (snap.data() as NeedRealtime) : null);
    });
    return () => unsub();
  }, [needId]);

  return { data };
}