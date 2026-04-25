'use client';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/providers/auth-provider';
import { apiFetch } from '@/lib/api/client';

export function TopBar() {
  const { user } = useAuth();

  const { data } = useQuery<{ unread_count: number }>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/notifications'),
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const unread = data?.unread_count ?? 0;

  return (
    <header className="flex h-14 items-center justify-end gap-4 border-b bg-card px-6">
      <Link
        href="/notifications"
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary uppercase">
          {user?.full_name?.[0] ?? '?'}
        </div>
        <span className="text-sm font-medium hidden sm:block">{user?.full_name}</span>
      </div>
    </header>
  );
}
