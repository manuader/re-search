import { assertAdmin } from "@/lib/admin/guard";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await assertAdmin();

    const supabase = createAdminClient();

    const [actorsResult, stuckResult, anomaliesResult, capResult] =
      await Promise.all([
        supabase
          .from("actor_health")
          .select("tool_id, status, success_rate_7d, avg_cost_per_result, last_test_at, last_error, consecutive_failures, is_available")
          .order("tool_id"),
        supabase.from("v_admin_stuck_orders").select("*"),
        supabase.from("v_admin_margin_anomalies").select("*"),
        supabase
          .from("v_admin_cap_trigger_rate")
          .select("*")
          .order("day", { ascending: false })
          .limit(30),
      ]);

    return adminJson({
      actors: actorsResult.data ?? [],
      stuckOrders: stuckResult.data ?? [],
      marginAnomalies: anomaliesResult.data ?? [],
      capTriggerRate: capResult.data ?? [],
    });
  } catch (error) {
    return handleAdminError(error);
  }
}
