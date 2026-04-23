import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminFunnelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.funnel");
  const supabase = createAdminClient();

  const [funnelResult, priceResult, reportResult, timeResult] =
    await Promise.all([
      supabase.from("v_funnel_30d").select("*").single(),
      supabase.from("v_abandonment_by_price").select("*").order("price_bucket"),
      supabase.from("v_report_type_distribution").select("*"),
      supabase.from("v_time_to_pay").select("*").single(),
    ]);

  const funnel = funnelResult.data;
  const priceData = priceResult.data ?? [];
  const reportData = reportResult.data ?? [];
  const timeToPay = timeResult.data;

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(n);

  // Build funnel steps with conversion rates
  const funnelSteps = funnel
    ? [
        { label: t("stages.projects"), value: funnel.projects },
        { label: t("stages.chatsStarted"), value: funnel.chats_started },
        { label: t("stages.configsCompleted"), value: funnel.configs_completed },
        { label: t("stages.checkoutsViewed"), value: funnel.checkouts_viewed },
        { label: t("stages.paymentsStarted"), value: funnel.payments_started },
        { label: t("stages.paymentsCompleted"), value: funnel.payments_completed },
      ]
    : [];

  const maxFunnel = funnelSteps.length > 0 ? Math.max(...funnelSteps.map((s) => s.value), 1) : 1;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {/* Funnel Visualization */}
      <Card className="p-5 space-y-3">
        <h2 className="font-medium">{t("conversionFunnel")}</h2>
        {funnelSteps.length > 0 ? (
          <div className="space-y-2">
            {funnelSteps.map((step, i) => {
              const prevValue = i > 0 ? funnelSteps[i - 1].value : step.value;
              const convRate = prevValue > 0 ? ((step.value / prevValue) * 100).toFixed(1) : "—";

              return (
                <div key={step.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{step.label}</span>
                    <span className="tabular-nums font-medium">
                      {step.value}
                      {i > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({convRate}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-6 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded bg-primary/70 transition-all"
                      style={{ width: `${(step.value / maxFunnel) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">{t("noData")}</p>
        )}
      </Card>

      {/* Time to Pay */}
      {timeToPay && (
        <Card className="p-5">
          <h2 className="font-medium mb-3">{t("timeToPay")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase">P50</p>
              <p className="text-2xl font-bold tabular-nums">
                {timeToPay.p50_sec != null ? `${Math.round(Number(timeToPay.p50_sec))}s` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">P90</p>
              <p className="text-2xl font-bold tabular-nums">
                {timeToPay.p90_sec != null ? `${Math.round(Number(timeToPay.p90_sec))}s` : "—"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Abandonment by Price */}
      {priceData.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">{t("abandonmentByPrice")}</h2>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("priceBucket")}</TableHead>
                  <TableHead className="text-right">{t("viewed")}</TableHead>
                  <TableHead className="text-right">{t("paid")}</TableHead>
                  <TableHead className="text-right">{t("conversionRate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceData.map((row) => (
                  <TableRow key={row.price_bucket}>
                    <TableCell>${(row.price_bucket - 1) * 5}–${row.price_bucket * 5}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.viewed}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.paid}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{row.conversion_pct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Report Type Distribution */}
      {reportData.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">{t("reportTypeDistribution")}</h2>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reportType")}</TableHead>
                  <TableHead className="text-right">{t("paidOrders")}</TableHead>
                  <TableHead className="text-right">{t("avgPrice")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((row) => (
                  <TableRow key={row.report_type}>
                    <TableCell className="font-medium">{row.report_type ?? "none"}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.paid_orders}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.avg_price_usd != null ? fmt(Number(row.avg_price_usd)) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
