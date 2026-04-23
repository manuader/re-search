import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { KPICard } from "@/components/admin/kpi-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: userId } = await params;
  const t = await getTranslations("admin.users");
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

  if (!profileResult.data) notFound();

  const profile = profileResult.data;
  const orders = ordersResult.data ?? [];
  const spending = spendingResult.data;

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(d));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{profile.email}</h1>
        <p className="text-muted-foreground text-sm">
          {profile.display_name} &middot; {profile.locale} &middot; {t("joined")} {fmtDate(profile.created_at)}
          {profile.is_admin && (
            <Badge className="ml-2 bg-red-100 text-red-800" variant="outline">Admin</Badge>
          )}
        </p>
      </div>

      {spending && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title={t("revenue")} value={spending.lifetime_revenue_usd} currency locale={locale} />
          <KPICard title={t("margin")} value={spending.lifetime_margin_usd} currency locale={locale} />
          <KPICard title={t("orders")} value={spending.orders_paid} />
          <KPICard title={t("projects")} value={spending.projects_paid} />
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium mb-3">{t("recentOrders")}</h2>
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("charged")}</TableHead>
                <TableHead className="text-right">{t("actualCost")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-muted-foreground">
                    <Link href={`/${locale}/admin/orders/${o.id}`} className="hover:underline">
                      {fmtDate(o.created_at)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{o.kind}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(o.price_charged_usd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.actual_cost_usd != null ? fmt(o.actual_cost_usd) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t("noOrders")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
