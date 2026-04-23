import { getTranslations } from "next-intl/server";
import { KPICard } from "@/components/admin/kpi-card";
import { createAdminClient } from "@/lib/supabase/admin";

async function fetchOverviewData() {
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
    supabase.from("v_admin_stuck_orders").select("id, status, stuck_minutes, project_id"),
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

  return {
    revenue24h: Math.round(revenue24h * 100) / 100,
    cost24h: Math.round(cost24h * 100) / 100,
    margin24h: Math.round((revenue24h - cost24h) * 100) / 100,
    orders24h: orders24h.length,
    activeUsers24h,
    pendingOrders: pendingResult.data?.length ?? 0,
    stuckOrders: stuckResult.data ?? [],
  };
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.overview");
  const data = await fetchOverviewData();

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard title={t("revenue24h")} value={data.revenue24h} currency locale={locale} />
        <KPICard title={t("cost24h")} value={data.cost24h} currency locale={locale} />
        <KPICard title={t("margin24h")} value={data.margin24h} currency locale={locale} />
        <KPICard title={t("orders24h")} value={data.orders24h} />
        <KPICard title={t("activeUsers")} value={data.activeUsers24h} />
        <KPICard title={t("pendingOrders")} value={data.pendingOrders} />
      </div>

      {data.stuckOrders.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <h2 className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
            {t("stuckOrders")} ({data.stuckOrders.length})
          </h2>
          <div className="space-y-1 text-sm">
            {data.stuckOrders.map((o: { id: string; status: string; stuck_minutes: number }) => (
              <div key={o.id} className="flex justify-between text-muted-foreground">
                <span className="font-mono text-xs">{o.id.slice(0, 8)}...</span>
                <span>{o.status} &middot; {Math.round(o.stuck_minutes)} min</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
