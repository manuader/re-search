import { createAdminClient } from "@/lib/supabase/admin";

export type AnalyticsEventName =
  | "project_created"
  | "chat_first_message"
  | "tools_suggested"
  | "config_completed"
  | "checkout_viewed"
  | "report_type_changed"
  | "checkout_abandoned"
  | "payment_started"
  | "payment_completed"
  | "payment_failed"
  | "payment_expired"
  | "execution_completed"
  | "report_regenerated";

export interface TrackEventInput {
  event: AnalyticsEventName;
  userId?: string;
  projectId?: string;
  orderId?: string;
  payload?: Record<string, unknown>;
  sessionId?: string;
  locale?: string;
  userAgent?: string;
}

/**
 * Server-side event tracking. Inserts directly into analytics_events
 * using the admin client. NEVER throws — analytics must not break
 * the business flow.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    const supabase = createAdminClient();

    await supabase.from("analytics_events").insert({
      event_name: input.event,
      user_id: input.userId ?? null,
      project_id: input.projectId ?? null,
      order_id: input.orderId ?? null,
      payload: input.payload ?? {},
      session_id: input.sessionId ?? null,
      locale: input.locale ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch (err) {
    console.error("[analytics] trackEvent failed (non-fatal):", err);
  }
}

const VALID_EVENT_NAMES = new Set<string>([
  "project_created",
  "chat_first_message",
  "tools_suggested",
  "config_completed",
  "checkout_viewed",
  "report_type_changed",
  "checkout_abandoned",
  "payment_started",
  "payment_completed",
  "payment_failed",
  "payment_expired",
  "execution_completed",
  "report_regenerated",
]);

export function isValidEventName(name: string): name is AnalyticsEventName {
  return VALID_EVENT_NAMES.has(name);
}
