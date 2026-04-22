import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDatasetSummary } from "@/lib/reports/build-summary";
import { buildReportPrompt } from "@/lib/reports/report-prompt";
import { mapToolNameToSourceType } from "@/lib/reports/influence-weight";
import {
  validateReportHTML,
  numbersAreGrounded,
} from "@/lib/reports/validators";
import type { RawDataItem, EnrichmentFlags } from "@/lib/reports/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const SONNET_MODEL = "claude-sonnet-4-20250514";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await req.json();

  // ── 1. Verify project + fetch metadata ────────────────────────────
  const { data: project } = await supabase
    .from("research_projects")
    .select("id, user_id, title, description, status")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ── 2. Fetch locale ───────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();
  const locale = (profile?.locale ?? "en") as "en" | "es";

  // ── 3. Fetch raw data ─────────────────────────────────────────────
  const { data: rawData, error: rawError } = await supabase
    .from("raw_data")
    .select("id, content, ai_fields, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (rawError) {
    return NextResponse.json({ error: rawError.message }, { status: 500 });
  }

  const items: RawDataItem[] = (rawData ?? []).map((r) => ({
    id: r.id as string,
    content: r.content as Record<string, unknown>,
    ai_fields: r.ai_fields as Record<string, unknown> | null,
    created_at: r.created_at as string,
  }));

  if (items.length === 0) {
    return NextResponse.json(
      { error: "No data to generate report" },
      { status: 400 }
    );
  }

  // ── 4. Determine source type ──────────────────────────────────────
  const { data: jobs } = await supabase
    .from("scraping_jobs")
    .select("tool_name")
    .eq("project_id", projectId)
    .not("tool_name", "is", null)
    .limit(1);

  const toolName = jobs?.[0]?.tool_name ?? "";
  const sourceType = mapToolNameToSourceType(toolName);

  // ── 5. Detect enrichments present ─────────────────────────────────
  const sampleAi = items
    .slice(0, 50)
    .map((i) => i.ai_fields)
    .filter(Boolean);

  const enrichments: EnrichmentFlags = {
    sentiment: sampleAi.some((ai) => ai && "sentiment" in ai),
    categories: sampleAi.some((ai) => ai && "category" in ai),
    painPoints: sampleAi.some((ai) => ai && "pain_points" in ai),
    demographics: sampleAi.some(
      (ai) => ai && ("age" in ai || "class" in ai || "gender" in ai)
    ),
    geo: sampleAi.some(
      (ai) => ai && ("location" in ai || "city" in ai || "country" in ai)
    ),
    topics: sampleAi.some((ai) => ai && "topics" in ai),
  };

  // ── 6. Recover user brief ─────────────────────────────────────────
  let userBrief = project.description ?? "";

  if (!userBrief) {
    // Fallback: first user chat message
    const { data: firstMsg } = await supabase
      .from("chat_messages")
      .select("content")
      .eq("project_id", projectId)
      .eq("role", "user")
      .order("created_at", { ascending: true })
      .limit(1);

    userBrief = firstMsg?.[0]?.content ?? project.title;
  }

  // ── 7. Build dataset summary ──────────────────────────────────────
  const summary = buildDatasetSummary({
    items,
    source: sourceType,
    userBrief,
    enrichments,
    locale,
  });

  console.log(
    `[report] Summary built: N=${summary.meta.totalItems}, sampleSize=${summary.meta.sampleSize}, source=${sourceType}`
  );

  // ── 8. Build prompt ───────────────────────────────────────────────
  const { system, user: userMessage } = buildReportPrompt(
    summary,
    project.title,
    locale
  );

  const promptChars = system.length + userMessage.length;
  console.log(`[report] Prompt size: ${promptChars} chars`);

  // ── 9. Call Anthropic API ─────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  async function callLLM(
    systemPrompt: string,
    messages: { role: string; content: string }[]
  ): Promise<string> {
    const res = await fetch(`${ANTHROPIC_API_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 12000,
        system: systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
    }

    const result = await res.json();
    return result.content?.[0]?.text ?? "";
  }

  let htmlContent: string;
  let qualityFlag: string | null = null;

  try {
    htmlContent = await callLLM(system, [{ role: "user", content: userMessage }]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Report generation failed: ${msg}` },
      { status: 500 }
    );
  }

  // ── 10. Structural validation (log only, no retry to stay within timeout) ──
  const validation = validateReportHTML(htmlContent);
  console.log("[report] Structural validation:", validation.checks);

  if (!validation.ok) {
    qualityFlag = "structural_issues";
    console.warn("[report] Structural validation failed:", validation.checks);
  }

  // ── 11. Numeric grounding check ───────────────────────────────────
  const grounding = numbersAreGrounded(htmlContent, summary);
  console.log(
    `[report] Grounding: checked=${grounding.totalChecked}, suspicious=${grounding.suspicious.length}`
  );

  if (!grounding.ok) {
    qualityFlag = qualityFlag ?? "ungrounded_numbers";
    console.warn("[report] Suspicious numbers:", grounding.suspicious);
  }

  // ── 12. Save to DB ────────────────────────────────────────────────
  const adminClient = createAdminClient();
  const insertPayload: Record<string, unknown> = {
    project_id: projectId,
    title: `Report: ${project.title}`,
    html_content: htmlContent,
  };
  if (qualityFlag) insertPayload.quality_flag = qualityFlag;

  const { data: report, error } = await adminClient
    .from("reports")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    console.error("[report] DB insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(
    `[report] Saved report ${report.id} | qualityFlag=${qualityFlag ?? "ok"}`
  );

  return NextResponse.json({
    reportId: report.id,
    htmlContent,
    qualityFlag,
  });
}
