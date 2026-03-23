import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server'; // Added this import as NextResponse is used
import { verifySession } from '@/lib/session';

// Public paths that do not require authentication
const publicPaths = ['/login', '/registro', '/recuperar'];

export async function proxy(request: NextRequest) { // Added 'async' keyword
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets, public folder, and API routes if needed
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('/public/') ||
    pathname.startsWith('/api/') ||
    pathname.match(/\.(.*)$/)
  ) {
    return NextResponse.next();
  }

  // Check if it's a public path
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // Get session cookie and verify it
  const sessionToken = request.cookies.get('lifemetric_session')?.value;
  const session = sessionToken ? await verifySession(sessionToken) : null;
 
  // If not authenticated and trying to access a private route, redirect to login
  if (!session && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If authenticated and trying to access login/register, redirect to home
  if (session && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
