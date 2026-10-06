import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

const PROTECTED_ROUTES = ["/profile", "/profile/details", "/profile/edit", "/profile/card", "/reset-password"];
// Prefix match (see matchesRoute): "/admin" covers every admin page in every locale.
// The proxy only requires a session; pages and API routes check the role with
// requireRole() / getAdminAccess() from "@/lib/admin/guard".
const ADMIN_ROUTES = ["/admin"];
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

function stripLocale(pathname: string): string {
  const match = pathname.match(/^\/(es|en)(\/|$)/);
  if (match) return pathname.slice(match[1].length + 1) || "/";
  return pathname;
}

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export default async function middleware(request: NextRequest) {
  // Skip auth callback routes — handled directly by route handlers
  if (request.nextUrl.pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }

  // Step 1 — next-intl: locale detection, redirects, rewrites
  const intlResponse = intlMiddleware(request);
  const response = intlResponse ?? NextResponse.next();

  // Step 2 — Supabase: refresh session, set auth cookies on intl response
  const { response: finalResponse, user } = await updateSession(
    request,
    response
  );

  // Step 3 — Route protection
  const bare = stripLocale(request.nextUrl.pathname);

  // Detect current locale from the URL (or default to "ca")
  const localeMatch = request.nextUrl.pathname.match(/^\/(es|en)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "ca";

  if (matchesRoute(bare, PROTECTED_ROUTES) || matchesRoute(bare, ADMIN_ROUTES)) {
    if (!user) {
      const loginUrl = new URL(
        locale === "ca" ? "/login" : `/${locale}/login`,
        request.url
      );
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (matchesRoute(bare, AUTH_ROUTES) && user && request.method === "GET") {
    const profileUrl = new URL(
      locale === "ca" ? "/profile" : `/${locale}/profile`,
      request.url
    );
    return NextResponse.redirect(profileUrl);
  }

  return finalResponse;
}

export const config = {
  matcher: [
    "/",
    "/(ca|es|en)/:path*",
    "/((?!api|auth|_next|_vercel|.*\\..*).*)",
  ],
};
