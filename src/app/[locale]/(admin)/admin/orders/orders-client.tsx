"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

interface Order {
  id: string;
  user_id: string;
  project_id: string;
  kind: string;
  status: string;
  price_charged_usd: number;
  actual_cost_usd: number | null;
  report_type: string;
  cap_triggered: boolean;
  created_at: string;
  paid_at: string | null;
  execution_completed_at: string | null;
}

interface OrdersClientProps {
  locale: string;
  initialOrders: Order[];
  totalCount: number;
}

export function OrdersClient({ locale, initialOrders, totalCount }: OrdersClientProps) {
  const t = useTranslations("admin.orders");
  const currentLocale = useLocale();
  const [orders, setOrders] = useState(initialOrders);
  const [total, setTotal] = useState(totalCount);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));

  async function fetchOrders(newOffset: number, status?: string) {
    setLoading(true);
    const params = new URLSearchParams({ limit: "25", offset: String(newOffset) });
    if (status) params.set("status", status);

    const res = await fetch(`/api/admin/orders?${params}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders);
      setTotal(data.total);
      setOffset(newOffset);
    }
    setLoading(false);
  }

  const statusOptions = [
    "", "pending_payment", "paid", "executing", "completed",
    "completed_partial", "failed", "refunded", "refund_pending", "expired",
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {statusOptions.map((s) => (
          <Button
            key={s || "all"}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter(s);
              fetchOrders(0, s);
            }}
          >
            {s || t("all")}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("orderId")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("charged")}</TableHead>
              <TableHead className="text-right">{t("actualCost")}</TableHead>
              <TableHead className="text-right">{t("margin")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const margin =
                o.actual_cost_usd != null
                  ? o.price_charged_usd - o.actual_cost_usd
                  : null;

              return (
                <TableRow key={o.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {fmtDate(o.created_at)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/${currentLocale}/admin/orders/${o.id}`}
                      className="hover:underline font-mono text-xs"
                    >
                      {o.id.slice(0, 8)}...
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{o.kind}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(o.price_charged_usd)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.actual_cost_usd != null ? fmt(o.actual_cost_usd) : "—"}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${margin != null && margin < 0 ? "text-red-600" : "text-green-600"}`}>
                    {margin != null ? fmt(margin) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t("noOrders")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 25 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + 25, total)} / {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => fetchOrders(Math.max(0, offset - 25), statusFilter)}>
              {t("prev")}
            </Button>
            <Button variant="outline" size="sm" disabled={offset + 25 >= total || loading} onClick={() => fetchOrders(offset + 25, statusFilter)}>
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
