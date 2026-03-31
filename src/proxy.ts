import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import {
  LOCALE_COOKIE_NAME,
  LOCALE_EXPLICIT_COOKIE_NAME,
  inferLocaleFromRequest,
  isExplicitLocaleSelection,
} from '@/lib/i18n';

const publicPaths = ['/login', '/registro', '/recuperar'];

function applyLocaleCookie(request: NextRequest, response: NextResponse) {
  const explicitCookie = request.cookies.get(LOCALE_EXPLICIT_COOKIE_NAME)?.value;
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;

  if (isExplicitLocaleSelection(explicitCookie) && cookieLocale) {
    return response;
  }

  const locale = inferLocaleFromRequest({
    cookieLocale,
    explicitCookie,
    acceptLanguage: request.headers.get('accept-language'),
    country: request.headers.get('x-vercel-ip-country') ?? request.headers.get('cf-ipcountry'),
    city: request.headers.get('x-vercel-ip-city') ?? request.headers.get('cf-ipcity'),
  });

  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isInternalAppRequest =
    request.headers.has('next-action') ||
    request.headers.has('rsc') ||
    request.headers.has('next-router-state-tree');

  if (
    pathname.startsWith('/_next') ||
    pathname.includes('/public/') ||
    pathname.startsWith('/api/') ||
    pathname.match(/\.(.*)$/)
  ) {
    return NextResponse.next();
  }

  if (isInternalAppRequest) {
    return applyLocaleCookie(request, NextResponse.next());
  }

  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));
  const sessionToken = request.cookies.get('lifemetric_session')?.value;
  const session = sessionToken ? await verifySession(sessionToken) : null;

  if (!session && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return applyLocaleCookie(request, NextResponse.redirect(url));
  }

  if (session && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return applyLocaleCookie(request, NextResponse.redirect(url));
  }

  return applyLocaleCookie(request, NextResponse.next());
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
