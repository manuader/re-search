import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDatasetSummary } from "@/lib/reports/build-summary";
import { buildReportPrompt } from "@/lib/reports/report-prompt";
import { mapToolNameToSourceType } from "@/lib/reports/influence-weight";
import { validateReportHTML, numbersAreGrounded } from "@/lib/reports/validators";
import type { RawDataItem, EnrichmentFlags } from "@/lib/reports/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const SONNET_MODEL = "claude-sonnet-4-20250514";

type ReportGenerateEvent = {
  name: "report/generate";
  data: {
    projectId: string;
    userId: string;
    locale: "en" | "es";
  };
};

export const generateReport = inngest.createFunction(
  {
    id: "generate-report",
    retries: 1,
    triggers: [{ event: "report/generate" }],
  },
  async ({ event, step }) => {
    const { projectId, userId, locale } =
      event.data as ReportGenerateEvent["data"];
    const supabase = createAdminClient();

    // ── Step 1: Fetch project + raw data ──────────────────────────────
    const { project, items, toolName, userBrief } = await step.run(
      "fetch-data",
      async () => {
        const { data: proj } = await supabase
          .from("research_projects")
          .select("id, title, description")
          .eq("id", projectId)
          .single();

        if (!proj) throw new Error(`Project ${projectId} not found`);

        const { data: rawData } = await supabase
          .from("raw_data")
          .select("id, content, ai_fields, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true });

        const rawItems: RawDataItem[] = (rawData ?? []).map((r) => ({
          id: r.id as string,
          content: r.content as Record<string, unknown>,
          ai_fields: r.ai_fields as Record<string, unknown> | null,
          created_at: r.created_at as string,
        }));

        if (rawItems.length === 0) throw new Error("No data to generate report");

        // Tool name for source type
        const { data: jobs } = await supabase
          .from("scraping_jobs")
          .select("tool_name")
          .eq("project_id", projectId)
          .not("tool_name", "is", null)
          .limit(1);

        // User brief
        let brief = proj.description ?? "";
        if (!brief) {
          const { data: firstMsg } = await supabase
            .from("chat_messages")
            .select("content")
            .eq("project_id", projectId)
            .eq("role", "user")
            .order("created_at", { ascending: true })
            .limit(1);
          brief = firstMsg?.[0]?.content ?? proj.title;
        }

        return {
          project: { id: proj.id, title: proj.title },
          items: rawItems,
          toolName: jobs?.[0]?.tool_name ?? "",
          userBrief: brief,
        };
      }
    );

    // ── Step 2: Build summary + prompt ────────────────────────────────
    const { system, userMessage, summaryJson } = await step.run(
      "build-summary",
      () => {
        const sourceType = mapToolNameToSourceType(toolName);

        // Detect enrichments from first 50 items
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

        const summary = buildDatasetSummary({
          items,
          source: sourceType,
          userBrief,
          enrichments,
          locale,
        });

        console.log(
          `[report] Summary: N=${summary.meta.totalItems}, sample=${summary.meta.sampleSize}, source=${sourceType}`
        );

        const prompt = buildReportPrompt(summary, project.title, locale);
        console.log(
          `[report] Prompt: ${prompt.system.length + prompt.user.length} chars`
        );

        return {
          system: prompt.system,
          userMessage: prompt.user,
          summaryJson: JSON.stringify(summary),
        };
      }
    );

    // ── Step 3: Call Claude Sonnet ─────────────────────────────────────
    const htmlContent = await step.run("call-llm", async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

      const res = await fetch(`${ANTHROPIC_API_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: SONNET_MODEL,
          max_tokens: 16384,
          system,
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Anthropic API ${res.status}: ${text}`);
      }

      const result = await res.json();
      return (result.content?.[0]?.text as string) ?? "";
    });

    // ── Step 4: Validate + save ───────────────────────────────────────
    await step.run("validate-and-save", async () => {
      const validation = validateReportHTML(htmlContent);
      console.log("[report] Validation:", validation.checks);

      let qualityFlag: string | null = null;
      if (!validation.ok) qualityFlag = "structural_issues";

      const summary = JSON.parse(summaryJson);
      const grounding = numbersAreGrounded(htmlContent, summary);
      console.log(
        `[report] Grounding: checked=${grounding.totalChecked}, suspicious=${grounding.suspicious.length}`
      );

      if (!grounding.ok && !qualityFlag) qualityFlag = "ungrounded_numbers";

      const insertPayload: Record<string, unknown> = {
        project_id: projectId,
        title: `Report: ${project.title}`,
        html_content: htmlContent,
      };
      if (qualityFlag) insertPayload.quality_flag = qualityFlag;

      const { error } = await supabase
        .from("reports")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) {
        console.error("[report] DB insert error:", error.message);
        throw new Error(`DB insert failed: ${error.message}`);
      }

      console.log(
        `[report] Saved | quality=${qualityFlag ?? "ok"}`
      );
    });

    return { success: true };
  }
);
