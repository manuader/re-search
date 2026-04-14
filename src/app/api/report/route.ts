import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  aggregateProjectData,
  generateReportPrompt,
} from "@/lib/ai/report-generator";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const SONNET_MODEL = "claude-sonnet-4-6-20250514";

export const maxDuration = 60; // Report generation can take longer

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await req.json();

  // Verify project belongs to user
  const { data: project } = await supabase
    .from("research_projects")
    .select("id, user_id, title, status")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get user's locale from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();
  const locale = (profile?.locale ?? "en") as "en" | "es";

  // Aggregate data
  const aggregated = await aggregateProjectData(projectId, supabase);
  if (!aggregated || aggregated.stats.totalResults === 0) {
    return NextResponse.json(
      { error: "No data to generate report" },
      { status: 400 }
    );
  }

  // Build prompt
  const { system, user: userMessage } = generateReportPrompt(
    aggregated,
    project.title,
    locale
  );

  // Call Anthropic API (non-streaming, one-shot)
  const response = await fetch(`${ANTHROPIC_API_URL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: `Report generation failed: ${text}` },
      { status: 500 }
    );
  }

  const result = await response.json();
  const htmlContent = result.content?.[0]?.text ?? "";

  // Save report to DB
  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      project_id: projectId,
      title: `Report: ${project.title}`,
      html_content: htmlContent,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reportId: report.id, htmlContent });
}
