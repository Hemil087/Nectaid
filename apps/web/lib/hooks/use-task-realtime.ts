'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirestoreRealtimeEnabled } from '@/lib/firebase/firestore';
import type { TaskStatus } from '@/lib/types/firestore';

export function useTaskStatus(assignmentId: string | null) {
  const [data, setData] = useState<TaskStatus | null>(null);

  useEffect(() => {
    if (!assignmentId || !db || !isFirestoreRealtimeEnabled) return;
    const ref = doc(db, 'task_status', assignmentId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? (snap.data() as TaskStatus) : null);
      },
      (error) => {
        console.warn('Firestore task realtime unavailable:', error.message);
        setData(null);
      },
    );
    return () => unsub();
  }, [assignmentId]);

  return { data };
}
