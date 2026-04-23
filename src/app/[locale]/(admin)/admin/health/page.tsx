import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminHealthPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("admin.health");
  const supabase = createAdminClient();

  const [actorsResult, stuckResult, anomaliesResult, capResult] =
    await Promise.all([
      supabase.from("actor_health").select("*").order("tool_id"),
      supabase.from("v_admin_stuck_orders").select("*"),
      supabase.from("v_admin_margin_anomalies").select("*"),
      supabase.from("v_admin_cap_trigger_rate").select("*").order("day", { ascending: false }).limit(14),
    ]);

  const actors = actorsResult.data ?? [];
  const stuckOrders = stuckResult.data ?? [];
  const anomalies = anomaliesResult.data ?? [];
  const capRate = capResult.data ?? [];

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (d: string | null) =>
    d ? new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {/* Actor Health Grid */}
      <div>
        <h2 className="text-lg font-medium mb-3">{t("actorHealth")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {actors.map((actor) => (
            <Card key={actor.tool_id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{actor.tool_id}</span>
                <StatusBadge status={actor.status} />
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>{t("successRate7d")}</span>
                <span className="text-right">{actor.success_rate_7d != null ? `${actor.success_rate_7d}%` : "—"}</span>
                <span>{t("avgCost")}</span>
                <span className="text-right">{actor.avg_cost_per_result != null ? fmt(actor.avg_cost_per_result) : "—"}</span>
                <span>{t("lastTest")}</span>
                <span className="text-right">{fmtDate(actor.last_test_at)}</span>
                <span>{t("failures")}</span>
                <span className={`text-right ${actor.consecutive_failures > 0 ? "text-red-600" : ""}`}>
                  {actor.consecutive_failures}
                </span>
              </div>
              {actor.last_error && (
                <p className="text-xs text-red-600 truncate">{actor.last_error}</p>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Margin Anomalies */}
      {anomalies.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3 text-red-600">{t("marginAnomalies")} ({anomalies.length})</h2>
          <div className="rounded-xl border border-red-500/30 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orderId")}</TableHead>
                  <TableHead className="text-right">{t("charged")}</TableHead>
                  <TableHead className="text-right">{t("actualCost")}</TableHead>
                  <TableHead className="text-right">{t("loss")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.id.slice(0, 8)}...</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(a.price_charged_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(a.actual_cost_usd)}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-600 font-medium">-{fmt(a.loss_usd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Stuck Orders */}
      {stuckOrders.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3 text-yellow-600">{t("stuckOrders")} ({stuckOrders.length})</h2>
          <div className="rounded-xl border border-yellow-500/30 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orderId")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("stuckMinutes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stuckOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}...</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(o.stuck_minutes)} min</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Cap Trigger Rate */}
      {capRate.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3">{t("capTriggerRate")}</h2>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead className="text-right">{t("completed")}</TableHead>
                  <TableHead className="text-right">{t("capTriggered")}</TableHead>
                  <TableHead className="text-right">{t("rate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {capRate.map((r) => (
                  <TableRow key={r.day}>
                    <TableCell>{new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(r.day))}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.total_completed}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.cap_triggered_count}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${Number(r.cap_trigger_pct) > 5 ? "text-red-600" : ""}`}>
                      {r.cap_trigger_pct}%
                    </TableCell>
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
