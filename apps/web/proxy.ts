import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export function proxy(req: NextRequest) {
  const token = req.cookies.get('__session')?.value;
  const path = req.nextUrl.pathname;

  if (!token && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon|public|.*\\.svg|.*\\.ico).*)'],
};
