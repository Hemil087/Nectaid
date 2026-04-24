'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  collection, query, orderBy, limit,
  onSnapshot, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import type { FeedEvent } from '@/lib/types/firestore';

export function useCoordinatorFeed(orgId: string | null, maxEvents = 20) {
  const [events, setEvents] = useState<FeedEvent[]>([]);

  useEffect(() => {
    if (!orgId) return;
    const feedRef = collection(db, 'coordinator_feed', orgId, 'feed');
    const q = query(feedRef, orderBy('created_at', 'desc'), limit(maxEvents));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedEvent, 'id'>) })));
    });
    return () => unsub();
  }, [orgId, maxEvents]);

  const markRead = useCallback(async (eventId: string) => {
    if (!orgId) return;
    await updateDoc(doc(db, 'coordinator_feed', orgId, 'feed', eventId), { read: true });
  }, [orgId]);

  const unreadCount = events.filter((e) => !e.read).length;

  return { events, unreadCount, markRead };
}