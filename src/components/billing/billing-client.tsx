"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";

interface Order {
  id: string;
  kind: string;
  status: string;
  price_charged_usd: number;
  report_type: string;
  payment_url: string | null;
  actual_cost_usd: number | null;
  cap_triggered: boolean;
  refunded_amount_usd: number | null;
  failure_reason: string | null;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  execution_completed_at: string | null;
  refunded_at: string | null;
  project_id: string;
  research_projects: { title: string } | { title: string }[] | null;
}

interface BillingClientProps {
  locale: string;
  orders: Order[];
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  executing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed_partial: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  refunded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  refund_pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  expired: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
};

function getProjectTitle(order: Order): string {
  if (!order.research_projects) return order.project_id;
  if (Array.isArray(order.research_projects)) {
    return order.research_projects[0]?.title ?? order.project_id;
  }
  return order.research_projects.title;
}

export function BillingClient({ locale, orders }: BillingClientProps) {
  const t = useTranslations("billing");

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(amount);

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateStr));

  const completedOrders = orders.filter((o) =>
    ["completed", "completed_partial", "paid", "executing"].includes(o.status)
  );

  const pendingOrders = orders.filter(
    (o) =>
      o.status === "pending_payment" &&
      new Date(o.expires_at) > new Date()
  );

  const refundOrders = orders.filter((o) =>
    ["refunded", "refund_pending"].includes(o.status)
  );

  const cancelOrder = async (orderId: string) => {
    await fetch(`/api/orders/${orderId}/cancel`, { method: "POST" });
    window.location.reload();
  };

  const renderEmptyState = (title: string, desc: string) => (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs">{desc}</p>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
          <TabsTrigger value="pending">
            {t("tabs.pending")}
            {pendingOrders.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {pendingOrders.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="refunds">{t("tabs.refunds")}</TabsTrigger>
        </TabsList>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          {completedOrders.length === 0 ? (
            renderEmptyState(t("history.empty"), t("history.emptyDescription"))
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">{t("history.date")}</th>
                    <th className="px-4 py-3">{t("history.project")}</th>
                    <th className="px-4 py-3">{t("history.type")}</th>
                    <th className="px-4 py-3 text-right">{t("history.amount")}</th>
                    <th className="px-4 py-3">{t("history.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {completedOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/projects/${order.project_id}`}
                          className="hover:underline truncate max-w-[200px] block"
                        >
                          {getProjectTitle(order)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {t(`orderKind.${order.kind}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatCurrency(order.price_charged_usd)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[order.status] ?? ""} variant="outline">
                          {t(`orderStatus.${order.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Pending Tab */}
        <TabsContent value="pending" className="mt-4">
          {pendingOrders.length === 0 ? (
            renderEmptyState(t("pending.empty"), t("pending.emptyDescription"))
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => {
                const minutesLeft = Math.max(
                  0,
                  Math.round(
                    (new Date(order.expires_at).getTime() - Date.now()) / 60000
                  )
                );

                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-xl border p-4"
                  >
                    <div>
                      <p className="font-medium">
                        {getProjectTitle(order)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(order.price_charged_usd)} &middot;{" "}
                        {t("pending.expiresIn", { minutes: minutesLeft })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {order.payment_url && (
                        <a
                          href={order.payment_url}
                          className={buttonVariants({ size: "sm" })}
                        >
                          {t("pending.payNow")}
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelOrder(order.id)}
                      >
                        {t("pending.cancel")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Refunds Tab */}
        <TabsContent value="refunds" className="mt-4">
          {refundOrders.length === 0 ? (
            renderEmptyState(t("refunds.empty"), t("refunds.emptyDescription"))
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">{t("history.date")}</th>
                    <th className="px-4 py-3">{t("history.project")}</th>
                    <th className="px-4 py-3 text-right">{t("refunds.amount")}</th>
                    <th className="px-4 py-3">{t("refunds.reason")}</th>
                    <th className="px-4 py-3">{t("history.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {refundOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(order.refunded_at ?? order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {getProjectTitle(order)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-green-600 dark:text-green-400">
                        +{formatCurrency(order.refunded_amount_usd ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                        {order.failure_reason ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[order.status] ?? ""} variant="outline">
                          {order.status === "refund_pending"
                            ? t("refunds.pending")
                            : t(`orderStatus.${order.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
