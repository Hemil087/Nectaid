'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/providers/auth-provider';
import type { Role } from '@/lib/types/enums';

export { useAuth };

export function useRequireRole(...roles: Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user && !roles.includes(user.role)) {
      router.replace('/dashboard');
    }
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router, roles]);
}
