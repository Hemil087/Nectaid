/**
 * lib/providers/i18n-provider.tsx
 *
 * Wraps next-intl's NextIntlClientProvider.
 * Import this in app/layout.tsx alongside QueryProvider and AuthProvider.
 *
 * Usage in app/layout.tsx:
 *
 *   import { getMessages, getLocale } from 'next-intl/server';
 *
 *   export default async function RootLayout({ children }) {
 *     const locale = await getLocale();
 *     const messages = await getMessages();
 *     return (
 *       <html lang={locale}>
 *         <body>
 *           <I18nProvider locale={locale} messages={messages}>
 *             <QueryProvider>
 *               <AuthProvider>{children}</AuthProvider>
 *             </QueryProvider>
 *           </I18nProvider>
 *         </body>
 *       </html>
 *     );
 *   }
 */
'use client';

import type { AbstractIntlMessages } from 'next-intl';
import { NextIntlClientProvider } from 'next-intl';

interface I18nProviderProps {
  locale: string;
  messages: AbstractIntlMessages;
  children: React.ReactNode;
}

export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Kolkata">
      {children}
    </NextIntlClientProvider>
  );
}