/**
 * components/layout/sidebar.tsx
 *
 * Desktop sidebar (fixed, 240 px) + Sheet nav for tablet/mobile (<1024 px).
 * Nav items are role-filtered — volunteers never see coordinator routes
 * and vice versa.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import {
  AlertCircle,
  BarChart3,
  Bell,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  User,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/lib/providers/auth-provider';
import { cn } from '@/lib/utils/cn';

// ── Nav items per role ─────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const COORDINATOR_NAV: NavItem[] = [
  { label: 'Dashboard',       href: '/dashboard',        icon: LayoutDashboard },
  { label: 'New Submission',  href: '/submissions/new',  icon: ClipboardList },
  { label: 'Needs',           href: '/needs',            icon: AlertCircle },
  { label: 'Reports',         href: '/reports',          icon: BarChart3 },
  { label: 'Notifications',   href: '/notifications',    icon: Bell },
  { label: 'Settings',        href: '/settings',         icon: Settings },
];

const VOLUNTEER_NAV: NavItem[] = [
  { label: 'My Assignments',  href: '/assignments',      icon: ClipboardList },
  { label: 'My Profile',      href: '/volunteers/me',    icon: User },
  { label: 'Notifications',   href: '/notifications',    icon: Bell },
  { label: 'Settings',        href: '/settings',         icon: Settings },
];

const ADMIN_EXTRA: NavItem[] = [
  { label: 'Manage Volunteers', href: '/admin/volunteers', icon: Users },
];

function getNavItems(role: string | undefined): NavItem[] {
  if (role === 'volunteer') return VOLUNTEER_NAV;
  if (role === 'admin') return [...COORDINATOR_NAV, ...ADMIN_EXTRA];
  return COORDINATOR_NAV; // coordinator + default
}

// ── Single nav link ────────────────────────────────────────────────────────

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const active =
    item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

// ── Shared nav body ────────────────────────────────────────────────────────

function NavBody({
  onLinkClick,
}: {
  onLinkClick?: () => void;
}) {
  const { user, signOut } = useAuth();
  const items = getNavItems(user?.role);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold text-foreground"
          onClick={onLinkClick}
        >
          <Shield className="h-5 w-5 text-primary" />
          <span>Nectaid</span>
        </Link>
      </div>

      {/* Nav links */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {items.map((item) => (
            <NavLink key={item.href} item={item} onClick={onLinkClick} />
          ))}

          {/* Admin section label */}
          {user?.role === 'admin' && (
            <>
              <Separator className="my-2" />
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin
              </p>
              {ADMIN_EXTRA.map((item) => (
                <NavLink key={item.href} item={item} onClick={onLinkClick} />
              ))}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {user?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.full_name}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {user?.role}
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Sign out</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

// ── Desktop sidebar ────────────────────────────────────────────────────────

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-background lg:flex lg:flex-col">
      <NavBody />
    </aside>
  );
}

// ── Mobile / tablet hamburger trigger ─────────────────────────────────────

export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <NavBody onLinkClick={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}