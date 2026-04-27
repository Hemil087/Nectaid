'use client';

import type { ReactNode } from 'react';

interface TopBarProps {
  mobileTrigger?: ReactNode;
}

export function TopBar({ mobileTrigger }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {mobileTrigger}
      <div className="flex-1" />
    </header>
  );
}