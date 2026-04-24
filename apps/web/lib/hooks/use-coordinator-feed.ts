'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  collection, query, orderBy, limit,
  onSnapshot, doc, updateDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import type { FeedEvent } from '@/lib/types/firestore';

/**
 * Listens to /coordinator_feed/{orgId}/feed in Firestore.
 * Returns live feed events for the coordinator dashboard.
 * Provides a markRead() helper to flip event.read = true.
 *
 * Usage:
 *   const { events, unreadCount, markRead } = useCoordinatorFeed(user.org_id);
 */
export function useCoordinatorFeed(orgId: string | null, maxEvents = 20) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

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

  const unreadCount = events.filter((e) => !(e as FeedEvent & { read?: boolean }).read).length;

  return { events, unreadCount, markRead, loading };
}