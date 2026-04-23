import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { KPICard } from "@/components/admin/kpi-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: orderId } = await params;
  const t = await getTranslations("admin.orders");
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("research_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order) notFound();

  const [jobsResult, aiResult] = await Promise.all([
    supabase
      .from("scraping_jobs")
      .select("id, tool_id, tool_name, estimated_results, actual_results, estimated_cost, actual_cost, status, error_message, quality_score, started_at, completed_at")
      .eq("project_id", order.project_id)
      .order("created_at"),
    supabase
      .from("ai_analysis_configs")
      .select("id, analysis_type, estimated_cost, actual_cost, status, created_at")
      .eq("project_id", order.project_id)
      .order("created_at"),
  ]);

  const jobs = jobsResult.data ?? [];
  const aiConfigs = aiResult.data ?? [];

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (d: string | null) =>
    d
      ? new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(d))
      : "—";

  const breakdown = order.cost_breakdown as Record<string, unknown> | null;
  const margin =
    order.actual_cost_usd != null
      ? Number(order.price_charged_usd) - Number(order.actual_cost_usd)
      : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{t("orderDetail")}</h1>
        <StatusBadge status={order.status} />
        <Badge variant="outline">{order.kind}</Badge>
        {order.cap_triggered && (
          <Badge className="bg-orange-100 text-orange-800" variant="outline">
            Cap Triggered
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground font-mono">{order.id}</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title={t("charged")} value={Number(order.price_charged_usd)} currency locale={locale} />
        <KPICard title={t("actualCost")} value={Number(order.actual_cost_usd ?? 0)} currency locale={locale} />
        <KPICard title={t("margin")} value={margin ?? 0} currency locale={locale} />
        <KPICard title={t("markup")} value={`${order.markup_multiplier}x`} />
      </div>

      {/* Cost Breakdown */}
      {breakdown && (
        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-medium">{t("breakdown")}</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {typeof breakdown.chatbot === "number" && (
              <>
                <span className="text-muted-foreground">Chatbot</span>
                <span className="text-right tabular-nums">{fmt(breakdown.chatbot)}</span>
              </>
            )}
            {typeof breakdown.report === "number" && (
              <>
                <span className="text-muted-foreground">Report</span>
                <span className="text-right tabular-nums">{fmt(breakdown.report)}</span>
              </>
            )}
            {typeof breakdown.buffer === "number" && (
              <>
                <span className="text-muted-foreground">Buffer</span>
                <span className="text-right tabular-nums">{fmt(breakdown.buffer)}</span>
              </>
            )}
            {typeof breakdown.markupAmount === "number" && (
              <>
                <span className="text-muted-foreground">Markup</span>
                <span className="text-right tabular-nums">{fmt(breakdown.markupAmount)}</span>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Timeline */}
      <Card className="p-4 space-y-2">
        <h2 className="text-sm font-medium">{t("timeline")}</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <span className="text-muted-foreground">{t("created")}</span>
          <span>{fmtDate(order.created_at)}</span>
          <span className="text-muted-foreground">{t("paid")}</span>
          <span>{fmtDate(order.paid_at)}</span>
          <span className="text-muted-foreground">{t("executionStarted")}</span>
          <span>{fmtDate(order.execution_started_at)}</span>
          <span className="text-muted-foreground">{t("executionCompleted")}</span>
          <span>{fmtDate(order.execution_completed_at)}</span>
        </div>
        {order.failure_reason && (
          <p className="text-sm text-red-600 mt-2">{order.failure_reason}</p>
        )}
      </Card>

      {/* Scraping Jobs */}
      {jobs.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">{t("scrapingJobs")}</h2>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tool")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("estResults")}</TableHead>
                  <TableHead className="text-right">{t("actResults")}</TableHead>
                  <TableHead className="text-right">{t("estCost")}</TableHead>
                  <TableHead className="text-right">{t("actCost")}</TableHead>
                  <TableHead className="text-right">{t("quality")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">{j.tool_name ?? j.tool_id}</TableCell>
                    <TableCell><StatusBadge status={j.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{j.estimated_results?.toLocaleString(locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{j.actual_results?.toLocaleString(locale) ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{j.estimated_cost != null ? fmt(j.estimated_cost) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{j.actual_cost != null ? fmt(j.actual_cost) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{j.quality_score != null ? `${(j.quality_score * 100).toFixed(0)}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* AI Analysis Configs */}
      {aiConfigs.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">{t("aiAnalysis")}</h2>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("analysisType")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("estCost")}</TableHead>
                  <TableHead className="text-right">{t("actCost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiConfigs.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.analysis_type}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{a.estimated_cost != null ? fmt(a.estimated_cost) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.actual_cost != null ? fmt(a.actual_cost) : "—"}</TableCell>
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
