import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrdersClient } from "./orders-client";

export default async function AdminOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.orders");
  const supabase = createAdminClient();

  const { data, count } = await supabase
    .from("research_orders")
    .select(
      "id, user_id, project_id, kind, status, price_charged_usd, actual_cost_usd, report_type, cap_triggered, created_at, paid_at, execution_completed_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <OrdersClient
        locale={locale}
        initialOrders={data ?? []}
        totalCount={count ?? 0}
      />
    </div>
  );
}
