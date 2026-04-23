import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditClient } from "./audit-client";

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.audit");
  const supabase = createAdminClient();

  const { data, count } = await supabase
    .from("admin_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <AuditClient
        locale={locale}
        initialEntries={data ?? []}
        totalCount={count ?? 0}
      />
    </div>
  );
}
