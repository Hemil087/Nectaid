'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuth, syncSessionCookie } from '@/lib/firebase/auth';
import { apiFetch } from '@/lib/api/client';
import type { AppUser } from '@/lib/types/api';

interface AuthCtx {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  signOut: async () => {},
});

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

  async function signOut() {
    const { getAuth, signOut: firebaseSignOut } = await import('firebase/auth');
    await firebaseSignOut(getAuth());
    // Clear session cookie
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <Ctx.Provider value={{ user, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}