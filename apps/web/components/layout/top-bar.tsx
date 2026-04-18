'use client';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAuth } from '@/lib/providers/auth-provider';

export function TopBar() {
  const { user } = useAuth();

  return (
    <header className="flex h-14 items-center justify-end gap-4 border-b bg-card px-6">
      <Link
        href="/notifications"
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
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
