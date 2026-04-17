import { NonRetriableError } from "inngest";
import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBatchStatus,
  getBatchResults,
  parseBatchResult,
} from "@/lib/ai/enrichment";
import type { AnalysisType, BatchResultEntry } from "@/lib/ai/enrichment";

// ---------------------------------------------------------------------------
// Event type
// ---------------------------------------------------------------------------
type ProcessBatchEvent = {
  name: "research/process-batch";
  data: {
    projectId: string;
    analysisConfigId: string;
    batchId: string;
  };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const POLL_INTERVAL = "60s";
const MAX_POLL_ITERATIONS = 1440; // 1440 * 60s = 24h max
const UPDATE_BATCH_SIZE = 50;

// Anthropic Haiku 3.5 pricing (per token)
const HAIKU_INPUT_PRICE = 0.8 / 1_000_000; // $0.80 per 1M input tokens
const HAIKU_OUTPUT_PRICE = 4.0 / 1_000_000; // $4.00 per 1M output tokens

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------
export const processBatch = inngest.createFunction(
  {
    id: "process-batch",
    retries: 0,
    triggers: [{ event: "research/process-batch" }],
  },
  async ({ event, step }) => {
    const { projectId, analysisConfigId, batchId } =
      event.data as ProcessBatchEvent["data"];
    const supabase = createAdminClient();

    // ── Step: poll-batch ───────────────────────────────────────────────
    // Initial check
    let batchStatus = await step.run("poll-batch", async () => {
      const status = await getBatchStatus(batchId);
      if (status.processing_status === "ended") {
        return status;
      }
      return null;
    });

    // Sleep-then-poll loop (same pattern as execute-research.ts)
    for (
      let attempt = 1;
      attempt < MAX_POLL_ITERATIONS && !batchStatus;
      attempt++
    ) {
      await step.sleep(`wait-batch-${attempt}`, POLL_INTERVAL);

      batchStatus = await step.run(`poll-batch-${attempt}`, async () => {
        const status = await getBatchStatus(batchId);
        if (status.processing_status === "ended") {
          return status;
        }
        return null;
      });
    }

    if (!batchStatus) {
      // Timed out after 24h
      await step.run("poll-timeout", async () => {
        await supabase
          .from("ai_analysis_configs")
          .update({ status: "failed" })
          .eq("id", analysisConfigId);
      });
      throw new NonRetriableError(
        `Batch ${batchId} did not complete within 24 hours`
      );
    }

    // ── Step: download-results ─────────────────────────────────────────
    const results = await step.run("download-results", async () => {
      return getBatchResults(batchId);
    });

    // ── Step: update-data ──────────────────────────────────────────────
    await step.run("update-data", async () => {
      // Fetch the analysis config to get output_field_name and analysis_type
      const { data: configRow, error: configError } = await supabase
        .from("ai_analysis_configs")
        .select("output_field_name, analysis_type")
        .eq("id", analysisConfigId)
        .single();

      if (configError || !configRow) {
        throw new NonRetriableError(
          `Failed to fetch analysis config: ${configError?.message ?? "not found"}`
        );
      }

      const { output_field_name: fieldName, analysis_type: analysisType } =
        configRow;

      // Process results in batches
      for (let i = 0; i < results.length; i += UPDATE_BATCH_SIZE) {
        const chunk = results.slice(i, i + UPDATE_BATCH_SIZE);

        // Collect updates: fetch existing ai_fields, merge, then update
        const rawDataIds = chunk
          .filter(
            (entry: BatchResultEntry) => entry.result.type === "succeeded"
          )
          .map((entry: BatchResultEntry) => entry.custom_id);

        if (rawDataIds.length === 0) continue;

        // Fetch existing ai_fields for these rows
        const { data: existingRows, error: fetchError } = await supabase
          .from("raw_data")
          .select("id, ai_fields")
          .in("id", rawDataIds);

        if (fetchError) {
          console.error(
            `Failed to fetch raw_data batch ${i}:`,
            fetchError.message
          );
          continue;
        }

        const existingMap = new Map(
          (existingRows ?? []).map((r: { id: string; ai_fields: Record<string, unknown> | null }) => [
            r.id,
            r.ai_fields ?? {},
          ])
        );

        // Update each row with merged ai_fields
        for (const entry of chunk) {
          if (entry.result.type !== "succeeded") continue;

          const rawDataId = entry.custom_id;
          const responseText =
            entry.result.message?.content?.[0]?.text ?? "";

          const parsed = parseBatchResult(
            responseText,
            analysisType as AnalysisType
          );

          if (!parsed) continue;

          const existing = existingMap.get(rawDataId) ?? {};
          const merged = { ...existing, [fieldName]: parsed };

          const { error: updateError } = await supabase
            .from("raw_data")
            .update({ ai_fields: merged })
            .eq("id", rawDataId);

          if (updateError) {
            console.error(
              `Failed to update raw_data ${rawDataId}:`,
              updateError.message
            );
          }
        }
      }
    });

    // ── Step: finalize ─────────────────────────────────────────────────
    await step.run("finalize", async () => {
      // Calculate actual cost from batch request_counts
      const succeeded = batchStatus!.request_counts.succeeded;
      // Rough cost estimate: each request uses ~200 input tokens + ~100 output tokens (Haiku)
      const estimatedInputTokens = succeeded * 200;
      const estimatedOutputTokens = succeeded * 100;
      const actualCost =
        estimatedInputTokens * HAIKU_INPUT_PRICE +
        estimatedOutputTokens * HAIKU_OUTPUT_PRICE;

      // Update this analysis config as completed
      const { error: updateConfigError } = await supabase
        .from("ai_analysis_configs")
        .update({
          status: "completed",
          actual_cost: actualCost,
        })
        .eq("id", analysisConfigId);

      if (updateConfigError) {
        console.error(
          "Failed to update analysis config:",
          updateConfigError.message
        );
      }

      // Check if ALL analysis configs for this project are now completed
      const { data: allConfigs, error: configsError } = await supabase
        .from("ai_analysis_configs")
        .select("id, status, actual_cost")
        .eq("project_id", projectId);

      if (configsError) {
        console.error(
          "Failed to fetch all analysis configs:",
          configsError.message
        );
        return;
      }

      const allCompleted = (allConfigs ?? []).every(
        (c: { status: string }) => c.status === "completed"
      );

      if (!allCompleted) {
        // Not all configs are done yet; other process-batch functions will handle theirs
        return;
      }

      // All AI analysis is complete -- calculate total AI cost
      const totalAiCost = (allConfigs ?? [])
        .filter(
          (c: { actual_cost: number | null }) => c.actual_cost != null
        )
        .reduce(
          (sum: number, c: { actual_cost: number | null }) =>
            sum + (c.actual_cost as number),
          0
        );

      // Fetch the project's user_id (needed for the transaction)
      const { data: project, error: projectError } = await supabase
        .from("research_projects")
        .select("user_id")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        console.error(
          "Failed to fetch project for cost transaction:",
          projectError?.message ?? "not found"
        );
        return;
      }

      // Insert transaction for AI cost (negative amount = charge)
      if (totalAiCost > 0) {
        const { error: txError } = await supabase
          .from("transactions")
          .insert({
            user_id: project.user_id,
            project_id: projectId,
            type: "ai_cost",
            amount: -totalAiCost,
            description: `AI analysis cost for ${(allConfigs ?? []).length} enrichment(s)`,
          });

        if (txError) {
          console.error(
            "Failed to insert AI cost transaction:",
            txError.message
          );
        }
      }

      // Mark project as completed
      const { error: completeError } = await supabase
        .from("research_projects")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      if (completeError) {
        console.error(
          "Failed to mark project completed:",
          completeError.message
        );
      }
    });

    return { projectId, analysisConfigId, batchId, status: "completed" };
  }
);
