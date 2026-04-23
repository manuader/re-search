import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    await assertAdmin();

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(Number(searchParams.get("limit")) || 25, 100);
    const offset = Number(searchParams.get("offset")) || 0;

    const supabase = createAdminClient();

    let query = supabase
      .from("research_orders")
      .select(
        "id, user_id, project_id, kind, status, price_charged_usd, actual_cost_usd, report_type, cap_triggered, created_at, paid_at, execution_completed_at, failure_reason",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (userId) query = query.eq("user_id", userId);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);

    const { data, count, error } = await query;

    if (error) {
      console.error("[admin/orders]", error);
      return adminJson({ error: "query_failed" }, 500);
    }

    return adminJson({
      orders: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    return handleAdminError(error);
  }
}
