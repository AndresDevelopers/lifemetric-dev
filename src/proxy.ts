import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifySession, isSessionActive } from '@/lib/session';
import {
  LOCALE_COOKIE_NAME,
  LOCALE_EXPLICIT_COOKIE_NAME,
  inferLocaleFromRequest,
  isExplicitLocaleSelection,
} from '@/lib/i18n';
import {
  resolveRuntimeGeo,
  RUNTIME_CITY_COOKIE_NAME,
  RUNTIME_COUNTRY_COOKIE_NAME,
  RUNTIME_TIMEZONE_COOKIE_NAME,
} from '@/lib/runtimeGeo';

const publicPaths = ['/login', '/registro', '/recuperar'];

function applyLocaleCookie(request: NextRequest, response: NextResponse) {
  const explicitCookie = request.cookies.get(LOCALE_EXPLICIT_COOKIE_NAME)?.value;
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;

  if (isExplicitLocaleSelection(explicitCookie) && cookieLocale) {
    return response;
  }

  const runtimeGeo = resolveRuntimeGeo({
    headerCountry: request.headers.get('x-vercel-ip-country') ?? request.headers.get('cf-ipcountry'),
    headerCity: request.headers.get('x-vercel-ip-city') ?? request.headers.get('cf-ipcity'),
    headerTimeZone: request.headers.get('x-vercel-ip-timezone') ?? request.headers.get('cf-timezone'),
    cookieCountry: request.cookies.get(RUNTIME_COUNTRY_COOKIE_NAME)?.value,
    cookieCity: request.cookies.get(RUNTIME_CITY_COOKIE_NAME)?.value,
    cookieTimeZone: request.cookies.get(RUNTIME_TIMEZONE_COOKIE_NAME)?.value,
  });

  const locale = inferLocaleFromRequest({
    cookieLocale,
    explicitCookie,
    acceptLanguage: request.headers.get('accept-language'),
    country: runtimeGeo.country,
    city: runtimeGeo.city,
  });

  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  response.cookies.set(RUNTIME_COUNTRY_COOKIE_NAME, runtimeGeo.country ?? '', {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  response.cookies.set(RUNTIME_CITY_COOKIE_NAME, runtimeGeo.city ?? '', {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });

  response.cookies.set(RUNTIME_TIMEZONE_COOKIE_NAME, runtimeGeo.timeZone, {
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
  const sessionPayloadStr = sessionToken ? await verifySession(sessionToken) : null;

  // Concurrent session check
  if (sessionPayloadStr && !isPublicPath) {
    try {
      const payload = JSON.parse(sessionPayloadStr);
      if (payload.sessionId) {
        const isActive = await isSessionActive(payload.pacienteId, payload.sessionId);
        if (!isActive) {
          const url = request.nextUrl.clone();
          url.pathname = '/login';
          url.searchParams.set('error', 'concurrent_session');
          const response = applyLocaleCookie(request, NextResponse.redirect(url));
          response.cookies.delete('lifemetric_session');
          return response;
        }
      }
    } catch {
      // Resilience: if JSON or Redis fails, let it pass
    }
  }

  if (!sessionPayloadStr && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return applyLocaleCookie(request, NextResponse.redirect(url));
  }

  if (sessionPayloadStr && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return applyLocaleCookie(request, NextResponse.redirect(url));
  }

  return applyLocaleCookie(request, NextResponse.next());
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
