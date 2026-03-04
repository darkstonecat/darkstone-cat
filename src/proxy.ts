import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match internationalized pathnames (with and without locale prefix)
  matcher: ['/', '/(ca|es|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};
