import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

const publicRoutes = ["/login", "/signup", "/auth/callback"];

function isPublicRoute(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(en|es|pt|fr|de)/, "") || "/";
  return publicRoutes.some((route) => pathWithoutLocale.startsWith(route));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isAdminApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/admin/");
}

function isAdminUIRoute(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(en|es|pt|fr|de)/, "") || "/";
  return pathWithoutLocale.startsWith("/admin");
}

// ─── Admin rate limiting (60 req/min per admin) ────────────────────────────

const adminRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isAdminRateLimited(adminId: string): boolean {
  const now = Date.now();
  const entry = adminRateLimitMap.get(adminId);

  if (!entry || now > entry.resetAt) {
    adminRateLimitMap.set(adminId, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  entry.count++;
  return entry.count > 60;
}

// ─── Admin check helper for middleware context ─────────────────────────────

async function checkAdminStatus(
  request: NextRequest
): Promise<{ isAdmin: boolean; userId: string | null }> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op in middleware read-only context
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { isAdmin: false, userId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return { isAdmin: profile?.is_admin === true, userId: user.id };
}

// ─── Main middleware ───────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin API routes: guard before anything else ─────────────────────
  if (isAdminApiRoute(pathname)) {
    const { isAdmin, userId } = await checkAdminStatus(request);

    if (!userId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (isAdminRateLimited(userId)) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    // Pass admin ID downstream via header
    const headers = new Headers(request.headers);
    headers.set("x-admin-id", userId);

    return NextResponse.next({ request: { headers } });
  }

  // ── Non-admin API routes: skip auth (they handle it themselves) ──────
  if (isApiRoute(pathname)) {
    return NextResponse.next();
  }

  // ── All UI routes: refresh Supabase session ──────────────────────────
  const { user, supabaseResponse } = await updateSession(request);

  // ── Admin UI routes: guard access ───────────────────────────────────
  if (isAdminUIRoute(pathname)) {
    if (!user) {
      const locale = pathname.split("/")[1] || "en";
      const loginUrl = new URL(`/${locale}/login`, request.url);
      const redirectResponse = NextResponse.redirect(loginUrl);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      return redirectResponse;
    }

    const { isAdmin } = await checkAdminStatus(request);

    if (!isAdmin) {
      // 404 — don't reveal the admin panel exists
      const notFoundUrl = new URL("/404", request.url);
      const rewriteResponse = NextResponse.rewrite(notFoundUrl);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        rewriteResponse.cookies.set(cookie.name, cookie.value);
      });
      return rewriteResponse;
    }

    if (isAdminRateLimited(user.id)) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }
  }

  // ── Apply i18n routing ──────────────────────────────────────────────
  const intlResponse = intlMiddleware(request);

  // Copy Supabase cookies to intl response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  // ── Auth guard for protected routes ─────────────────────────────────
  if (!user && !isPublicRoute(pathname)) {
    const locale = pathname.split("/")[1] || "en";
    const loginUrl = new URL(`/${locale}/login`, request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
