import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'de', 'fr', 'es', 'it', 'nl'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeDetection: true
});

// Match all pathnames except for
// - api routes
// - static files
// - _next internal routes
// - vercel internal routes
export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};