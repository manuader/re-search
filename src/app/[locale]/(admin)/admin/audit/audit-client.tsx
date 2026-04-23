"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AuditEntry {
  id: number;
  admin_id: string;
  action: string;
  resource: string | null;
  filters: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditClientProps {
  locale: string;
  initialEntries: AuditEntry[];
  totalCount: number;
}

export function AuditClient({ locale, initialEntries, totalCount }: AuditClientProps) {
  const t = useTranslations("admin.audit");
  const [entries, setEntries] = useState(initialEntries);
  const [total, setTotal] = useState(totalCount);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(d));

  async function fetchPage(newOffset: number) {
    setLoading(true);
    const res = await fetch(`/api/admin/audit?limit=50&offset=${newOffset}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setTotal(data.total);
      setOffset(newOffset);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("timestamp")}</TableHead>
              <TableHead>{t("action")}</TableHead>
              <TableHead>{t("resource")}</TableHead>
              <TableHead>{t("adminId")}</TableHead>
              <TableHead>{t("ip")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                  {fmtDate(entry.created_at)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{entry.action}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {entry.resource ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {entry.admin_id.slice(0, 8)}...
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {entry.ip_address ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t("noEntries")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + 50, total)} / {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => fetchPage(Math.max(0, offset - 50))}>
              {t("prev")}
            </Button>
            <Button variant="outline" size="sm" disabled={offset + 50 >= total || loading} onClick={() => fetchPage(offset + 50)}>
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
