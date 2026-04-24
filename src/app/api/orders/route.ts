import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrderPreference } from "@/lib/payments/mercadopago";
import { quotePricing } from "@/lib/pricing/quote";
import { CHATBOT_FLAT_FEE_USD } from "@/lib/pricing/constants";
import type { PricingInput } from "@/lib/pricing/types";
import type { ReportType } from "@/lib/pricing/types";

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

  const validReportTypes = ["none", "executive", "professional", "technical"];
  if (!validReportTypes.includes(reportType)) {
    return NextResponse.json(
      { error: `Invalid reportType. Must be one of: ${validReportTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Verify project ownership
  const { data: project, error: projectError } = await supabase
    .from("research_projects")
    .select("id, title, status, user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Determine order kind
  const isReportOrder =
    project.status === "completed" || project.status === "completed_partial";
  const kind = isReportOrder ? "report" : "research";

  // For research orders, ensure no existing paid/executing research order
  if (kind === "research") {
    const admin = createAdminClient();
    const { data: existingOrders } = await admin
      .from("research_orders")
      .select("id, status")
      .eq("project_id", projectId)
      .eq("kind", "research")
      .in("status", ["paid", "executing", "completed", "completed_partial"]);

    if (existingOrders && existingOrders.length > 0) {
      return NextResponse.json(
        { error: "This project already has a completed or active research order" },
        { status: 409 }
      );
    }

    // Expire any pending_payment orders for this project
    await admin
      .from("research_orders")
      .update({ status: "expired" })
      .eq("project_id", projectId)
      .eq("status", "pending_payment");
  }

  // Build pricing input from project data
  const { data: scrapingJobs } = await supabase
    .from("scraping_jobs")
    .select("tool_id, estimated_results")
    .eq("project_id", projectId);

  const { data: aiConfigs } = await supabase
    .from("ai_analysis_configs")
    .select("analysis_type, id")
    .eq("project_id", projectId);

  const pricingInput: PricingInput = {
    tools: (scrapingJobs ?? []).map((j) => ({
      toolId: j.tool_id,
      estimatedResults: j.estimated_results ?? 0,
    })),
    aiAnalyses: (aiConfigs ?? []).map((c) => ({
      type: c.analysis_type as PricingInput["aiAnalyses"][number]["type"],
      estimatedItems: (scrapingJobs ?? []).reduce(
        (sum, j) => sum + (j.estimated_results ?? 0),
        0
      ),
    })),
    reportType: reportType as ReportType,
    chatbotCostUsd: CHATBOT_FLAT_FEE_USD,
  };

  // For report-only orders, only include report cost
  if (kind === "report") {
    pricingInput.tools = [];
    pricingInput.aiAnalyses = [];
    pricingInput.chatbotCostUsd = 0;
  }

  const pricing = quotePricing(pricingInput);

  // Get user profile for locale
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();

  const locale = profile?.locale ?? "en";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

  if (!appUrl) {
    console.error("[POST /api/orders] NEXT_PUBLIC_APP_URL is not set");
    return NextResponse.json(
      { error: "Server misconfigured: APP_URL not set" },
      { status: 500 }
    );
  }

  // Create order in DB
  const admin = createAdminClient();
  const configSnapshot = {
    tools: pricingInput.tools,
    aiAnalyses: pricingInput.aiAnalyses,
    reportType,
  };

  const { data: order, error: orderError } = await admin
    .from("research_orders")
    .insert({
      user_id: user.id,
      project_id: projectId,
      kind,
      estimated_internal_cost_usd: pricing.internalCostUsd,
      safety_buffer_usd: pricing.safetyBufferUsd,
      markup_multiplier: pricing.markupMultiplier,
      price_charged_usd: pricing.priceChargedUsd,
      cost_breakdown: pricing.breakdown,
      config_snapshot: configSnapshot,
      report_type: reportType,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[POST /api/orders] insert error:", orderError);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }

  // Create MP preference
  let paymentUrl: string;
  let preferenceId: string;
  try {
    const mpResult = await createOrderPreference({
      orderId: order.id,
      userId: user.id,
      projectTitle: project.title ?? "Research",
      priceUsd: pricing.priceChargedUsd,
      locale,
      appUrl,
    });

    paymentUrl = mpResult.init_point!;
    preferenceId = mpResult.id!;
  } catch (err) {
    // MP SDK throws objects, not Error instances — extract details
    let errMsg: string;
    if (err instanceof Error) {
      errMsg = err.message;
    } else if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      errMsg = String(
        e.message ?? e.cause ?? e.statusCode
          ? `MP status ${e.statusCode}: ${JSON.stringify(e.message ?? e.cause)}`
          : JSON.stringify(err)
      );
    } else {
      errMsg = String(err);
    }

    // Clean up the order if MP preference creation fails
    await admin
      .from("research_orders")
      .update({ status: "expired", failure_reason: `MP preference failed: ${errMsg}` })
      .eq("id", order.id);

    console.error("[POST /api/orders] MP preference error:", errMsg, err);
    return NextResponse.json(
      { error: `Failed to create payment: ${errMsg}` },
      { status: 500 }
    );
  }

  // Update order with payment details
  await admin
    .from("research_orders")
    .update({
      payment_preference_id: preferenceId,
      payment_url: paymentUrl,
    })
    .eq("id", order.id);

  // Link order to project
  await admin
    .from("research_projects")
    .update({ current_order_id: order.id })
    .eq("id", projectId);

  return NextResponse.json({
    orderId: order.id,
    paymentUrl,
    priceCharged: pricing.priceChargedUsd,
    breakdown: pricing.breakdown,
    warnings: pricing.warnings,
  });
}
