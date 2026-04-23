import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CostsClient } from "./costs-client";

export default async function AdminCostsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.costs");
  const supabase = createAdminClient();

  const [dailyResult, apifyResult, claudeResult] = await Promise.all([
    supabase.from("v_admin_daily_costs").select("*").order("day", { ascending: false }).limit(30),
    supabase.from("v_admin_apify_cost_by_tool").select("*").order("total_cost_usd", { ascending: false }),
    supabase.from("v_admin_claude_cost").select("*").order("day", { ascending: false }),
  ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <CostsClient
        locale={locale}
        dailyCosts={dailyResult.data ?? []}
        apifyCosts={apifyResult.data ?? []}
        claudeCosts={claudeResult.data ?? []}
      />
    </div>
  );
}
