'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuth, syncSessionCookie } from '@/lib/firebase/auth';
import { apiFetch } from '@/lib/api/client';
import type { AppUser } from '@/lib/types/api';

interface AuthCtx {
  user: AppUser | null;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuth(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          await syncSessionCookie(idToken);
          const me = await apiFetch<AppUser>('/auth/session', { method: 'POST' });
          setUser(me);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
