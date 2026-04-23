import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

// Routes that don't require authentication
const publicRoutes = ["/login", "/signup", "/auth/callback"];

function isPublicRoute(pathname: string): boolean {
  // Strip locale prefix to check route
  const pathWithoutLocale = pathname.replace(/^\/(en|es|pt|fr|de)/, "") || "/";
  return publicRoutes.some((route) => pathWithoutLocale.startsWith(route));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  // Skip auth check for API routes (they handle auth themselves)
  if (isApiRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Refresh Supabase session
  const { user, supabaseResponse } = await updateSession(request);

  // Apply i18n routing
  const intlResponse = intlMiddleware(request);

  // Copy Supabase cookies to intl response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  // Check auth for protected routes
  if (!user && !isPublicRoute(request.nextUrl.pathname)) {
    const locale = request.nextUrl.pathname.split("/")[1] || "en";
    const loginUrl = new URL(`/${locale}/login`, request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);

    // Copy Supabase cookies to redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });

    return redirectResponse;
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Match all pathnames except static files and api
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
