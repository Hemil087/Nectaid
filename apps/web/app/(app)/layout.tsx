/**
 * app/(app)/layout.tsx
 *
 * App shell: Sidebar (desktop) + TopBar with hamburger (mobile/tablet).
 * The Sidebar is hidden on <1024px; the MobileSidebarTrigger lives in
 * the TopBar and shows as a Sheet on smaller screens.
 */
import type { ReactNode } from 'react';

import { MobileSidebarTrigger, Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Fixed desktop sidebar */}
      <Sidebar />

      {/* Right side: top bar + scrollable content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar mobileTrigger={<MobileSidebarTrigger />} />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}