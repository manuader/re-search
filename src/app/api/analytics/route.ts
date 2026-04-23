import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trackEvent, isValidEventName } from "@/lib/analytics/events";
import type { AnalyticsEventName } from "@/lib/analytics/events";

// Simple in-memory rate limiter (per session, 60 events/min)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  entry.count++;
  return entry.count > 60;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { event, projectId, orderId, payload, sessionId } = body as {
    event?: string;
    projectId?: string;
    orderId?: string;
    payload?: Record<string, unknown>;
    sessionId?: string;
  };

  if (!event || !isValidEventName(event)) {
    return NextResponse.json(
      { error: "Invalid or missing event name" },
      { status: 400 }
    );
  }

  const effectiveSessionId = sessionId ?? "anonymous";

  if (isRateLimited(effectiveSessionId)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Get authenticated user if available
  let userId: string | undefined;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  } catch {
    // Anonymous event — allowed
  }

  await trackEvent({
    event: event as AnalyticsEventName,
    userId,
    projectId,
    orderId,
    payload,
    sessionId: effectiveSessionId,
  });

  return NextResponse.json({ tracked: true });
}
