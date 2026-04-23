import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { adminId } = await assertAdmin();
    const { id } = await params;

    const alertId = Number(id);
    if (isNaN(alertId)) {
      return adminJson({ error: "invalid_id" }, 400);
    }

    const supabase = createAdminClient();

    const { data: alert } = await supabase
      .from("admin_alerts")
      .select("id, resolved_at")
      .eq("id", alertId)
      .single();

    if (!alert) {
      return adminJson({ error: "alert_not_found" }, 404);
    }

    if (alert.resolved_at) {
      return adminJson({ error: "already_resolved" }, 409);
    }

    const { error } = await supabase
      .from("admin_alerts")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: adminId,
      })
      .eq("id", alertId);

    if (error) {
      console.error("[admin/alerts/acknowledge]", error);
      return adminJson({ error: "update_failed" }, 500);
    }

    await logAdminAction(adminId, "acknowledge_alert", {
      resource: `alert:${alertId}`,
      req,
    });

    return adminJson({ acknowledged: true });
  } catch (error) {
    return handleAdminError(error);
  }
}
