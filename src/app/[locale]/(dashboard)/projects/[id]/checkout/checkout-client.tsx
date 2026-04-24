"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type ReportType = "none" | "executive" | "professional" | "technical";

interface PricingBreakdown {
  scraping: Array<{ toolId: string; cost: number }>;
  aiAnalysis: Array<{ type: string; cost: number }>;
  report: number;
  chatbot: number;
  buffer: number;
  markupAmount: number;
}

interface CheckoutClientProps {
  locale: string;
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  tools: Array<{
    id: string;
    tool_id: string;
    tool_name: string;
    estimated_results: number;
  }>;
  aiAnalyses: Array<{
    id: string;
    analysis_type: string;
  }>;
}

export function CheckoutClient({
  locale,
  projectId,
  projectTitle,
  projectStatus,
  tools,
  aiAnalyses,
}: CheckoutClientProps) {
  const t = useTranslations("checkout");
  const [reportType, setReportType] = useState<ReportType>("none");
  const [priceCharged, setPriceCharged] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<PricingBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isReportOnly =
    projectStatus === "completed" || projectStatus === "completed_partial";

  const fetchPricing = useCallback(async (rt: ReportType) => {
    setPricingLoading(true);
    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, reportType: rt }),
      });

      if (!res.ok) throw new Error("Failed to fetch pricing");

      const data = await res.json();
      setPriceCharged(data.priceCharged);
      setBreakdown(data.breakdown);
    } catch {
      setError("Failed to calculate price");
    } finally {
      setPricingLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPricing(reportType);
  }, [reportType, fetchPricing]);

  const handleReportTypeChange = (rt: ReportType) => {
    setReportType(rt);
  };

  const handlePayAndExecute = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, reportType }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to create order");
      }

      const { paymentUrl } = data;
      window.location.href = paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const reportTypes: ReportType[] = ["none", "executive", "professional", "technical"];

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-2xl p-6 space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Research Summary */}
      {!isReportOnly && (
        <Card className="p-5 space-y-4">
          <h2 className="font-medium">{t("researchSummary")}</h2>
          <p className="text-sm text-muted-foreground">{projectTitle}</p>

          {tools.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                {t("tools")}
              </p>
              <div className="space-y-1">
                {tools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{tool.tool_name}</span>
                    <span className="text-muted-foreground">
                      ~{tool.estimated_results.toLocaleString(locale)} {t("estimatedResults")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiAnalyses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                {t("aiAnalysis")}
              </p>
              <div className="flex gap-2 flex-wrap">
                {aiAnalyses.map((a) => (
                  <Badge key={a.id} variant="secondary">
                    {a.analysis_type}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Report Type Selector */}
      <Card className="p-5 space-y-4">
        <h2 className="font-medium">{t("reportType")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {reportTypes.map((rt) => (
            <button
              key={rt}
              onClick={() => handleReportTypeChange(rt)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                reportType === rt
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <p className="text-sm font-medium">
                {t(`reportTypes.${rt}`)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t(`reportDescriptions.${rt}`)}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* Price Breakdown */}
      {breakdown && !pricingLoading && (
        <Card className="p-5 space-y-3">
          <h2 className="font-medium">{t("priceBreakdown")}</h2>

          {breakdown.scraping.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("breakdown.scraping")}</span>
              <span>
                {formatCurrency(
                  breakdown.scraping.reduce((s, b) => s + b.cost, 0)
                )}
              </span>
            </div>
          )}

          {breakdown.aiAnalysis.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("breakdown.aiAnalysis")}</span>
              <span>
                {formatCurrency(
                  breakdown.aiAnalysis.reduce((s, b) => s + b.cost, 0)
                )}
              </span>
            </div>
          )}

          {breakdown.report > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("breakdown.report")}</span>
              <span>{formatCurrency(breakdown.report)}</span>
            </div>
          )}

          {breakdown.chatbot > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("breakdown.chatbot")}</span>
              <span>{formatCurrency(breakdown.chatbot)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("breakdown.buffer")}</span>
            <span>{formatCurrency(breakdown.buffer)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("breakdown.markup")}</span>
            <span>{formatCurrency(breakdown.markupAmount)}</span>
          </div>

          <Separator />

          <div className="flex justify-between text-lg font-semibold">
            <span>{t("total")}</span>
            <span>{priceCharged !== null ? formatCurrency(priceCharged) : "..."}</span>
          </div>
        </Card>
      )}

      {pricingLoading && (
        <Card className="p-5">
          <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
            {t("processing")}
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Pay Button */}
      <Button
        onClick={handlePayAndExecute}
        disabled={loading || pricingLoading || priceCharged === null}
        className="w-full h-12 text-base"
        size="lg"
      >
        {loading
          ? t("processing")
          : priceCharged !== null
            ? t("payAndExecute", { amount: formatCurrency(priceCharged) })
            : "..."}
      </Button>

      {/* Disclaimer */}
      <p className="text-xs text-center text-muted-foreground">
        {t("disclaimer")}
      </p>
    </div>
    </div>
  );
}
