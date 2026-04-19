import { NextRequest, NextResponse } from 'next/server';

import { getFirebaseAdminAuth } from '@/lib/firebase/admin';

const PUBLIC_PATHS = ['/login'];

function clearSessionAndRedirect(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url));
  res.cookies.set('__session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return res;
}

export async function proxy(req: NextRequest) {
  const token = req.cookies.get('__session')?.value;
  const path = req.nextUrl.pathname;

  if (!token && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (PUBLIC_PATHS.some((p) => path.startsWith(p)) || !token) {
    return NextResponse.next();
  }

  try {
    await getFirebaseAdminAuth().verifySessionCookie(token, true);
  } catch {
    return clearSessionAndRedirect(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|favicon|public|.*\\.svg|.*\\.ico).*)'],
};
