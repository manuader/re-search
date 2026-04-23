"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DailyCost {
  day: string;
  orders_completed: number;
  total_revenue_usd: number;
  total_internal_cost_usd: number;
  total_margin_usd: number;
  avg_margin_usd: number;
}

interface ApifyCost {
  tool_id: string;
  tool_name: string;
  runs: number;
  total_cost_usd: number;
  avg_cost_per_run: number;
  total_results: number;
  effective_cost_per_1000: number | null;
  failure_rate: number;
}

interface ClaudeCost {
  day: string;
  model: string;
  cost_usd: number;
  batches: number;
}

interface CostsClientProps {
  locale: string;
  dailyCosts: DailyCost[];
  apifyCosts: ApifyCost[];
  claudeCosts: ClaudeCost[];
}

export function CostsClient({
  locale,
  dailyCosts,
  apifyCosts,
  claudeCosts,
}: CostsClientProps) {
  const t = useTranslations("admin.costs");

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
      new Date(d)
    );

  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <Tabs defaultValue="daily">
      <TabsList>
        <TabsTrigger value="daily">{t("tabs.daily")}</TabsTrigger>
        <TabsTrigger value="apify">{t("tabs.apify")}</TabsTrigger>
        <TabsTrigger value="claude">{t("tabs.claude")}</TabsTrigger>
      </TabsList>

      <TabsContent value="daily" className="mt-4">
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead className="text-right">{t("orders")}</TableHead>
                <TableHead className="text-right">{t("revenue")}</TableHead>
                <TableHead className="text-right">{t("cost")}</TableHead>
                <TableHead className="text-right">{t("margin")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyCosts.map((row) => (
                <TableRow key={row.day}>
                  <TableCell>{fmtDate(row.day)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.orders_completed}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.total_revenue_usd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.total_internal_cost_usd)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${row.total_margin_usd >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {fmt(row.total_margin_usd)}
                  </TableCell>
                </TableRow>
              ))}
              {dailyCosts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t("noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="apify" className="mt-4">
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tool")}</TableHead>
                <TableHead className="text-right">{t("runs")}</TableHead>
                <TableHead className="text-right">{t("totalCost")}</TableHead>
                <TableHead className="text-right">{t("avgCostRun")}</TableHead>
                <TableHead className="text-right">{t("results")}</TableHead>
                <TableHead className="text-right">{t("costPer1000")}</TableHead>
                <TableHead className="text-right">{t("failureRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apifyCosts.map((row) => (
                <TableRow key={row.tool_id}>
                  <TableCell className="font-medium">{row.tool_name ?? row.tool_id}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.runs}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.total_cost_usd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.avg_cost_per_run)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.total_results?.toLocaleString(locale)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.effective_cost_per_1000 != null ? fmt(row.effective_cost_per_1000) : "—"}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${row.failure_rate > 0.1 ? "text-red-600" : ""}`}>
                    {fmtPct(row.failure_rate)}
                  </TableCell>
                </TableRow>
              ))}
              {apifyCosts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {t("noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="claude" className="mt-4">
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("model")}</TableHead>
                <TableHead className="text-right">{t("cost")}</TableHead>
                <TableHead className="text-right">{t("batches")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claudeCosts.map((row, i) => (
                <TableRow key={`${row.day}-${row.model}-${i}`}>
                  <TableCell>{fmtDate(row.day)}</TableCell>
                  <TableCell>{row.model}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.cost_usd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.batches}</TableCell>
                </TableRow>
              ))}
              {claudeCosts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {t("noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
