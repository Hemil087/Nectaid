'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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

// Where each role lands after login
const ROLE_HOME: Record<string, string> = {
  coordinator: '/dashboard',
  admin:       '/dashboard',
  volunteer:   '/assignments',
};

// Pages that don't need a redirect (auth pages)
const AUTH_PAGES = ['/login', '/register', '/'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    return onAuth(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          await syncSessionCookie(idToken);
          const me = await apiFetch<AppUser>('/auth/session', { method: 'POST' });
          setUser(me);

          // Redirect to role home if on an auth page or wrong dashboard
          const home = ROLE_HOME[me.role] ?? '/assignments';
          const onAuthPage = AUTH_PAGES.some((p) => pathname === p);
          const onWrongDashboard =
            me.role === 'volunteer' && pathname === '/dashboard';

          if (onAuthPage || onWrongDashboard) {
            router.replace(home);
          }
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