import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AlertsClient } from "./alerts-client";

export default async function AdminAlertsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.alerts");
  const supabase = createAdminClient();

  const { data: alerts } = await supabase
    .from("admin_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <AlertsClient locale={locale} initialAlerts={alerts ?? []} />
    </div>
  );
}
