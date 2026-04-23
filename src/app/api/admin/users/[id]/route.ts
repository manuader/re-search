import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { adminId } = await assertAdmin();
    const { id: userId } = await params;

    const supabase = createAdminClient();

    const [profileResult, ordersResult, spendingResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, locale, created_at, is_admin")
        .eq("id", userId)
        .single(),
      supabase
        .from("research_orders")
        .select(
          "id, kind, status, price_charged_usd, actual_cost_usd, report_type, cap_triggered, created_at, paid_at, execution_completed_at, project_id"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("v_admin_user_spending")
        .select("*")
        .eq("user_id", userId)
        .single(),
    ]);

    if (!profileResult.data) {
      return adminJson({ error: "user_not_found" }, 404);
    }

    await logAdminAction(adminId, "view_user_detail", {
      resource: `user:${userId}`,
      req,
    });

    return adminJson({
      profile: profileResult.data,
      orders: ordersResult.data ?? [],
      spending: spendingResult.data ?? null,
    });
  } catch (error) {
    return handleAdminError(error);
  }
}
