import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminAuditAction } from "./types";

interface AuditOptions {
  resource?: string;
  filters?: Record<string, unknown>;
  req?: Request;
}

/**
 * Log an admin action to the audit log. Fire-and-forget — never throws.
 * Uses service-role client since admin_audit_log has no RLS policies for users.
 */
export async function logAdminAction(
  adminId: string,
  action: AdminAuditAction,
  opts: AuditOptions = {}
): Promise<void> {
  try {
    const supabase = createAdminClient();

    await supabase.from("admin_audit_log").insert({
      admin_id: adminId,
      action,
      resource: opts.resource ?? null,
      filters: opts.filters ?? null,
      ip_address: opts.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: opts.req?.headers.get("user-agent") ?? null,
    });
  } catch (err) {
    console.error("[admin_audit_log] insert failed (non-fatal):", err);
  }
}
