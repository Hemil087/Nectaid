/**
 * components/shared/language-switcher.tsx
 *
 * Dropdown to change UI language. Persists choice in the
 * NEXT_LOCALE cookie (read by i18n.ts on every request).
 * No Firebase needed — pure cookie + router refresh.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type Locale, locales } from '@/i18n';

const LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिंदी',
  gu: 'ગુજરાતી',
};

interface LanguageSwitcherProps {
  currentLocale: Locale;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(locale: string) {
    // Set cookie
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Select value={currentLocale} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className="w-36 text-sm" aria-label="Language">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {LABELS[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}