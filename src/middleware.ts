import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Create the internationalization middleware handler
const intlMiddleware = createMiddleware({
  locales: ['en', 'de', 'fr', 'es', 'it', 'nl'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeDetection: true,
});

// Define protected routes that require authentication
const protectedRoutes = ['/dashboard'];

export default async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Check if the path is a protected route (ignoring locale prefix)
  const pathWithoutLocale = path.replace(/^\/[a-z]{2}(?:\/|$)/, '/');
  const isProtectedRoute = protectedRoutes.some(route =>
    pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`)
  );
  
  // If it's a protected route, check authentication
  if (isProtectedRoute) {
    // Get the token from the cookies
    const token = request.cookies.get('wordpress_auth')?.value;
    
    // If there's no token, redirect to login
    if (!token) {
      // Maintain the locale in the redirect
      const locale = path.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] || 'en';
      return NextResponse.redirect(
        new URL(`/${locale}/login?redirect=${encodeURIComponent(path)}`, request.url)
      );
    }
    
    try {
      // Verify the token
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-jwt-secret-here');
      await jwtVerify(token, secret);
      
      // If the token is valid, proceed to the internationalization middleware
      return intlMiddleware(request);
    } catch (error) {
      // If the token is invalid, redirect to login
      const locale = path.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] || 'en';
      return NextResponse.redirect(
        new URL(`/${locale}/login?redirect=${encodeURIComponent(path)}`, request.url)
      );
    }
  }
  
  // For non-protected routes, just handle internationalization
  return intlMiddleware(request);
}

// Match all pathnames except for
// - api routes
// - static files
// - _next internal routes
// - vercel internal routes
export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)', '/dashboard/:path*'],
};