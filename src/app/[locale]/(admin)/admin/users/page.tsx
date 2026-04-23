import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersClient } from "./users-client";

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.users");
  const supabase = createAdminClient();

  const { data, count } = await supabase
    .from("v_admin_user_spending")
    .select("*", { count: "exact" })
    .order("lifetime_revenue_usd", { ascending: false })
    .limit(25);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <UsersClient
        locale={locale}
        initialUsers={data ?? []}
        totalCount={count ?? 0}
      />
    </div>
  );
}
