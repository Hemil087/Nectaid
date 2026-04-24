'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import type { TaskStatus } from '@/lib/types/firestore';

/**
 * Listens to /task_status/{assignmentId} in Firestore.
 * Returns the latest realtime status of a volunteer's assignment.
 * Used on the assignment detail page so status updates without refresh.
 */
export function useTaskStatus(assignmentId: string | null) {
  const [data, setData] = useState<TaskStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assignmentId) {
      setLoading(false);
      return;
    }

    const ref = doc(db, 'task_status', assignmentId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setData(snap.data() as TaskStatus);
        } else {
          setData(null);
        }
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