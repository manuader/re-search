import { NextResponse } from "next/server";
import { AdminError } from "./types";

/**
 * Create a JSON response with admin security headers.
 * All admin endpoints must use this instead of NextResponse.json().
 */
export function adminJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/**
 * Handle errors from admin route handlers.
 * AdminError → appropriate status. Everything else → 500.
 */
export function handleAdminError(error: unknown): NextResponse {
  if (error instanceof AdminError) {
    // 404 for non-admin (hide route existence), 401 for unauthenticated
    return adminJson({ error: error.code }, error.status);
  }

  console.error("[admin] Unhandled error:", error);
  return adminJson({ error: "internal_error" }, 500);
}
