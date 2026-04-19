import { NextRequest, NextResponse } from 'next/server';

import { getFirebaseAdminAuth } from '@/lib/firebase/admin';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
const SESSION_EXPIRES_IN_MS = SESSION_MAX_AGE_SECONDS * 1000;

function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

export async function POST(req: NextRequest) {
  const { idToken } = (await req.json()) as { idToken?: string };

  if (!idToken) {
    return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
  }

  const sessionCookie = await getFirebaseAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRES_IN_MS,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set('__session', sessionCookie, buildCookieOptions(SESSION_MAX_AGE_SECONDS));

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('__session', '', buildCookieOptions(0));
  return res;
}
