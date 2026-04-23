"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ExportType = "orders" | "users";

export default function AdminExportPage() {
  const t = useTranslations("admin.export");
  const [exportType, setExportType] = useState<ExportType>("orders");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);

    let url = `/api/admin/export/${exportType}`;
    if (exportType === "orders" && (from || to)) {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      url += `?${params}`;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${exportType}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <Card className="p-5 space-y-4 max-w-md">
        <div className="space-y-2">
          <Label>{t("type")}</Label>
          <div className="flex gap-2">
            <Button
              variant={exportType === "orders" ? "default" : "outline"}
              size="sm"
              onClick={() => setExportType("orders")}
            >
              {t("orders")}
            </Button>
            <Button
              variant={exportType === "users" ? "default" : "outline"}
              size="sm"
              onClick={() => setExportType("users")}
            >
              {t("users")}
            </Button>
          </div>
        </div>

        {exportType === "orders" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="from">{t("from")}</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">{t("to")}</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        )}

        <Button onClick={handleExport} disabled={loading} className="w-full">
          {loading ? t("exporting") : t("download")}
        </Button>
      </Card>
    </div>
  );
}
