'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  collection, query, orderBy, limit,
  onSnapshot, doc, updateDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import type { FeedEvent } from '@/lib/types/firestore';

export function useCoordinatorFeed(orgId: string | null, maxEvents = 20) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(orgId !== null);

  useEffect(() => {
    if (!orgId) {
      return;
    }

    setLoading(true);
    const feedRef = collection(db, 'coordinator_feed', orgId, 'feed');
    const q = query(feedRef, orderBy('created_at', 'desc'), limit(maxEvents));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: FeedEvent[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FeedEvent, 'id'>),
        }));
        setEvents(items);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orgId, maxEvents]);

  const markRead = useCallback(
    async (eventId: string) => {
      if (!orgId) return;
      const ref = doc(db, 'coordinator_feed', orgId, 'feed', eventId);
      await updateDoc(ref, { read: true });
    },
    [orgId]
  );

  const unreadCount = events.filter((e) => !e.read).length;

  return { events, unreadCount, markRead, loading };
}