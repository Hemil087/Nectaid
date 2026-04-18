'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuth } from '@/lib/firebase/auth';
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
          const me = await apiFetch<AppUser>('/auth/me');
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
