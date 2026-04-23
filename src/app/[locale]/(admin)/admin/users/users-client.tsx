"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserSpending {
  user_id: string;
  email: string;
  locale: string;
  user_created_at: string;
  orders_paid: number;
  projects_paid: number;
  lifetime_revenue_usd: number;
  lifetime_margin_usd: number;
  last_paid_at: string | null;
}

interface UsersClientProps {
  locale: string;
  initialUsers: UserSpending[];
  totalCount: number;
}

export function UsersClient({ locale, initialUsers, totalCount }: UsersClientProps) {
  const t = useTranslations("admin.users");
  const currentLocale = useLocale();
  const [users, setUsers] = useState(initialUsers);
  const [total, setTotal] = useState(totalCount);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(n);

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(d));

  async function fetchUsers(q: string, newOffset: number) {
    setLoading(true);
    const params = new URLSearchParams({ limit: "25", offset: String(newOffset) });
    if (q) params.set("q", q);

    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setOffset(newOffset);
    }
    setLoading(false);
  }

  const handleSearch = () => fetchUsers(search, 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="max-w-xs"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {t("search")}
        </Button>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("email")}</TableHead>
              <TableHead className="text-right">{t("orders")}</TableHead>
              <TableHead className="text-right">{t("revenue")}</TableHead>
              <TableHead className="text-right">{t("margin")}</TableHead>
              <TableHead>{t("lastPaid")}</TableHead>
              <TableHead>{t("joined")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.user_id}>
                <TableCell>
                  <Link
                    href={`/${currentLocale}/admin/users/${u.user_id}`}
                    className="hover:underline font-medium"
                  >
                    {u.email}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{u.orders_paid}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(u.lifetime_revenue_usd)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(u.lifetime_margin_usd)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {u.last_paid_at ? fmtDate(u.last_paid_at) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {fmtDate(u.user_created_at)}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t("noUsers")}
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
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => fetchUsers(search, Math.max(0, offset - 25))}
            >
              {t("prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + 25 >= total || loading}
              onClick={() => fetchUsers(search, offset + 25)}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
