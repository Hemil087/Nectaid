/**
 * i18n.ts
 *
 * next-intl configuration.
 * Locale is stored in a cookie ('NEXT_LOCALE') so the user's
 * preference persists across reloads without a URL prefix.
 */
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['en', 'hi', 'gu'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('NEXT_LOCALE')?.value ?? defaultLocale;
  const locale = locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});