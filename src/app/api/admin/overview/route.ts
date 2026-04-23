import { assertAdmin } from "@/lib/admin/guard";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

// 60-second in-memory cache
let cachedOverview: { data: unknown; expiresAt: number } | null = null;

export async function GET() {
  try {
    await assertAdmin();

    const now = Date.now();
    if (cachedOverview && now < cachedOverview.expiresAt) {
      return adminJson(cachedOverview.data);
    }

    const supabase = createAdminClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [ordersResult, pendingResult, stuckResult] = await Promise.all([
      supabase
        .from("research_orders")
        .select("price_charged_usd, actual_cost_usd, user_id")
        .in("status", ["completed", "completed_partial"])
        .gte("execution_completed_at", since24h),
      supabase
        .from("research_orders")
        .select("id")
        .eq("status", "pending_payment")
        .gt("expires_at", new Date().toISOString()),
      supabase.from("v_admin_stuck_orders").select("id"),
    ]);

    const orders24h = ordersResult.data ?? [];
    const revenue24h = orders24h.reduce(
      (sum, o) => sum + Number(o.price_charged_usd ?? 0),
      0
    );
    const cost24h = orders24h.reduce(
      (sum, o) => sum + Number(o.actual_cost_usd ?? 0),
      0
    );
    const activeUsers24h = new Set(orders24h.map((o) => o.user_id)).size;

    const data = {
      revenue24h: Math.round(revenue24h * 100) / 100,
      cost24h: Math.round(cost24h * 100) / 100,
      margin24h: Math.round((revenue24h - cost24h) * 100) / 100,
      orders24h: orders24h.length,
      activeUsers24h,
      pendingOrders: pendingResult.data?.length ?? 0,
      stuckOrders: stuckResult.data?.length ?? 0,
    };

    cachedOverview = { data, expiresAt: now + 60_000 };

    return adminJson(data);
  } catch (error) {
    return handleAdminError(error);
  }
}
