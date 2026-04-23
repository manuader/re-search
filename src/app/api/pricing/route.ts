import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { quotePricing } from "@/lib/pricing/quote";
import { CHATBOT_FLAT_FEE_USD } from "@/lib/pricing/constants";
import type { PricingInput, ReportType } from "@/lib/pricing/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { projectId, reportType = "none" } = body as {
    projectId?: string;
    reportType?: ReportType;
  };

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // Verify ownership
  const { data: project } = await supabase
    .from("research_projects")
    .select("id, status")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const isReportOnly =
    project.status === "completed" || project.status === "completed_partial";

  const { data: scrapingJobs } = await supabase
    .from("scraping_jobs")
    .select("tool_id, estimated_results")
    .eq("project_id", projectId);

  const { data: aiConfigs } = await supabase
    .from("ai_analysis_configs")
    .select("analysis_type")
    .eq("project_id", projectId);

  const totalEstimatedResults = (scrapingJobs ?? []).reduce(
    (sum, j) => sum + (j.estimated_results ?? 0),
    0
  );

  const pricingInput: PricingInput = {
    tools: isReportOnly
      ? []
      : (scrapingJobs ?? []).map((j) => ({
          toolId: j.tool_id,
          estimatedResults: j.estimated_results ?? 0,
        })),
    aiAnalyses: isReportOnly
      ? []
      : (aiConfigs ?? []).map((c) => ({
          type: c.analysis_type as PricingInput["aiAnalyses"][number]["type"],
          estimatedItems: totalEstimatedResults,
        })),
    reportType: reportType as ReportType,
    chatbotCostUsd: isReportOnly ? 0 : CHATBOT_FLAT_FEE_USD,
  };

  const result = quotePricing(pricingInput);

  return NextResponse.json({
    priceCharged: result.priceChargedUsd,
    breakdown: result.breakdown,
    internalCost: result.internalCostUsd,
    markupMultiplier: result.markupMultiplier,
    warnings: result.warnings,
  });
}
