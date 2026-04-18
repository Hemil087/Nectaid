'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, Plus, Users, FileText,
  Bell, Settings, LogOut, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/lib/providers/auth-provider';
import { signOut } from '@/lib/firebase/auth';
import type { Role } from '@/lib/types/enums';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',         icon: LayoutDashboard, roles: ['coordinator', 'admin'] },
  { label: 'New Submission', href: '/submissions/new',   icon: Plus,            roles: ['coordinator', 'admin'] },
  { label: 'Needs',          href: '/needs',             icon: ClipboardList,   roles: ['coordinator', 'admin'] },
  { label: 'My Assignments', href: '/assignments',       icon: ClipboardList,   roles: ['volunteer'] },
  { label: 'My Profile',     href: '/volunteers/me',     icon: Users,           roles: ['volunteer'] },
  { label: 'Reports',        href: '/reports',           icon: FileText,        roles: ['coordinator', 'admin'] },
  { label: 'Notifications',  href: '/notifications',     icon: Bell,            roles: ['coordinator', 'admin', 'volunteer'] },
  { label: 'Settings',       href: '/settings',          icon: Settings,        roles: ['coordinator', 'admin', 'volunteer'] },
  { label: 'Volunteers',     href: '/admin/volunteers',  icon: ShieldCheck,     roles: ['admin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const visible = NAV.filter((n) => user && n.roles.includes(user.role));

  async function handleLogout() {
    await signOut();
    router.replace('/login');
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-card">
      <div className="px-6 py-5 border-b">
        <span className="text-lg font-semibold text-primary">Nectaid</span>
        {user?.org_id && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.org_id}</p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-3 py-4">
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.full_name}</div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
