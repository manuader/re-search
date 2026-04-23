"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Alert {
  id: number;
  level: string;
  code: string;
  message: string;
  context: Record<string, unknown> | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

interface AlertsClientProps {
  locale: string;
  initialAlerts: Alert[];
}

const LEVEL_STYLES: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function AlertsClient({ locale, initialAlerts }: AlertsClientProps) {
  const t = useTranslations("admin.alerts");
  const [alerts, setAlerts] = useState(initialAlerts);
  const [showResolved, setShowResolved] = useState(false);

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));

  const handleAcknowledge = async (alertId: number) => {
    const res = await fetch(`/api/admin/alerts/${alertId}/acknowledge`, {
      method: "POST",
    });

    if (res.ok) {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, resolved_at: new Date().toISOString() }
            : a
        )
      );
    }
  };

  const active = alerts.filter((a) => !a.resolved_at);
  const resolved = alerts.filter((a) => a.resolved_at);

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      <div>
        <h2 className="text-lg font-medium mb-3">
          {t("active")} ({active.length})
        </h2>
        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
            {t("noActive")}
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 ${
                  alert.level === "critical"
                    ? "border-red-500/30 bg-red-500/5"
                    : alert.level === "warning"
                    ? "border-yellow-500/30 bg-yellow-500/5"
                    : "border-blue-500/30 bg-blue-500/5"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={LEVEL_STYLES[alert.level]} variant="outline">
                        {alert.level}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        {alert.code}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(alert.created_at)}
                      </span>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAcknowledge(alert.id)}
                  >
                    {t("acknowledge")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolved Alerts */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowResolved(!showResolved)}
        >
          {showResolved ? t("hideResolved") : t("showResolved")} ({resolved.length})
        </Button>

        {showResolved && resolved.length > 0 && (
          <div className="mt-3 space-y-2">
            {resolved.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border p-3 opacity-60"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Badge className={LEVEL_STYLES[alert.level]} variant="outline">
                    {alert.level}
                  </Badge>
                  <span className="font-mono text-xs">{alert.code}</span>
                  <span className="text-muted-foreground flex-1 truncate">
                    {alert.message}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(alert.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
