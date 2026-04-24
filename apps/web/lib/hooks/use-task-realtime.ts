'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import type { TaskStatus } from '@/lib/types/firestore';

export function useTaskStatus(assignmentId: string | null) {
  const [data, setData] = useState<TaskStatus | null>(null);
  const [loading, setLoading] = useState(assignmentId !== null);

  useEffect(() => {
    if (!assignmentId) {
      return;
    }

    setLoading(true);
    const ref = doc(db, 'task_status', assignmentId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? (snap.data() as TaskStatus) : null);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [assignmentId]);

  return { data, loading };
}