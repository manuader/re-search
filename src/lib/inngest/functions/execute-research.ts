import { NonRetriableError } from "inngest";
import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  startActorRun,
  getRunStatus,
  getDatasetItems,
  isRunFinished,
  isRunSucceeded,
} from "@/lib/apify/client";
import { validateScrapedData } from "@/lib/apify/validator";
import { findToolById } from "@/lib/apify/catalog";
import { submitBatchAnalysis } from "@/lib/ai/enrichment";
import type { AnalysisType, AnalysisConfig } from "@/lib/ai/enrichment";
import { assertTransition, logTransition } from "@/lib/orders/state-machine";
import { COST_CAP_THRESHOLD } from "@/lib/pricing/constants";

// ---------------------------------------------------------------------------
// Event type
// ---------------------------------------------------------------------------
type ResearchExecuteEvent = {
  name: "research/execute";
  data: { projectId: string; orderId: string };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const POLL_INTERVAL = "30s";
const MAX_POLL_ITERATIONS = 60;
const RAW_DATA_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------
export const executeResearch = inngest.createFunction(
  {
    id: "execute-research",
    retries: 0,
    triggers: [{ event: "research/execute" }],
  },
  async ({ event, step }) => {
    const { projectId, orderId } = event.data as ResearchExecuteEvent["data"];
    const supabase = createAdminClient();

    // ── Step: load and validate order ────────────────────────────────
    const order = await step.run("load-order", async () => {
      const { data, error } = await supabase
        .from("research_orders")
        .select("id, status, user_id, project_id, price_charged_usd, kind")
        .eq("id", orderId)
        .single();

      if (error || !data) {
        throw new NonRetriableError(`Order ${orderId} not found`);
      }

      if (data.status !== "paid") {
        throw new NonRetriableError(
          `Order ${orderId} is "${data.status}", expected "paid". Aborting.`
        );
      }

      return data;
    });

    const priceCharged = Number(order.price_charged_usd);
    let actualCostAccumulated = 0;

    // ── Step: transition paid → executing ────────────────────────────
    await step.run("start-executing", async () => {
      assertTransition("paid", "executing");

      const { error } = await supabase
        .from("research_orders")
        .update({
          status: "executing",
          execution_started_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "paid"); // optimistic lock

      if (error) {
        throw new NonRetriableError(`Failed to transition order: ${error.message}`);
      }

      await supabase
        .from("research_projects")
        .update({ status: "running" })
        .eq("id", projectId);

      logTransition({
        orderId,
        userId: order.user_id,
        projectId,
        fromStatus: "paid",
        toStatus: "executing",
        priceCharged,
      });
    });

    // ── Fetch scraping jobs ──────────────────────────────────────────
    const jobs = await step.run("fetch-jobs", async () => {
      const { data, error } = await supabase
        .from("scraping_jobs")
        .select("*")
        .eq("project_id", projectId);

      if (error) {
        throw new NonRetriableError(`Failed to fetch scraping jobs: ${error.message}`);
      }

      return data ?? [];
    });

    // ── Cost cap helper ──────────────────────────────────────────────
    const capLimit = priceCharged * COST_CAP_THRESHOLD;
    let capTriggered = false;

    // ── Process each job sequentially ────────────────────────────────
    for (const job of jobs) {
      if (capTriggered) break;

      const tool = findToolById(job.tool_id);
      if (!tool) {
        await step.run(`skip-unknown-tool-${job.id}`, async () => {
          await supabase
            .from("scraping_jobs")
            .update({
              status: "failed",
              error_message: `Unknown tool_id: ${job.tool_id}`,
            })
            .eq("id", job.id);
        });
        continue;
      }

      // ── Start run ─────────────────────────────────────────────────
      const runResult = await step.run(`start-${job.id}`, async () => {
        const result = await startActorRun(tool.actorId, job.actor_input ?? {});

        await supabase
          .from("scraping_jobs")
          .update({
            apify_run_id: result.id,
            apify_dataset_id: result.defaultDatasetId,
            status: "running",
            started_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        return result;
      });

      // ── Poll ──────────────────────────────────────────────────────
      const finalRun = await step.run(`poll-${job.id}`, async () => {
        const status = await getRunStatus(runResult.id);
        if (isRunFinished(status.status)) return status;
        return null;
      });

      let currentRun = finalRun;

      for (let attempt = 1; attempt < MAX_POLL_ITERATIONS && !currentRun; attempt++) {
        await step.sleep(`wait-${job.id}-${attempt}`, POLL_INTERVAL);

        currentRun = await step.run(`poll-${job.id}-${attempt}`, async () => {
          const status = await getRunStatus(runResult.id);

          await supabase
            .from("scraping_jobs")
            .update({ status: status.status.toLowerCase() })
            .eq("id", job.id);

          if (isRunFinished(status.status)) return status;
          return null;
        });
      }

      if (!currentRun) {
        await step.run(`timeout-${job.id}`, async () => {
          await supabase
            .from("scraping_jobs")
            .update({
              status: "failed",
              error_message: "Polling timed out after 30 minutes",
            })
            .eq("id", job.id);
        });
        continue;
      }

      // ── Process results ───────────────────────────────────────────
      const jobCost = await step.run(`process-${job.id}`, async () => {
        if (!isRunSucceeded(currentRun!.status)) {
          await supabase
            .from("scraping_jobs")
            .update({
              status: "failed",
              error_message: `Apify run ended with status: ${currentRun!.status}`,
              completed_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          return 0;
        }

        const items = (await getDatasetItems(
          currentRun!.defaultDatasetId
        )) as Record<string, unknown>[];

        const validation = validateScrapedData(items, tool);

        for (let i = 0; i < validation.validItems.length; i += RAW_DATA_BATCH_SIZE) {
          const batch = validation.validItems.slice(i, i + RAW_DATA_BATCH_SIZE);
          const rows = batch.map((item) => ({
            project_id: projectId,
            job_id: job.id,
            source: job.tool_name ?? tool.name.en,
            content: item,
            ai_fields: null,
          }));

          const { error } = await supabase.from("raw_data").insert(rows);
          if (error) {
            console.error(`raw_data insert error (batch ${i}):`, error.message);
          }
        }

        const cost = currentRun!.usage?.USD ?? 0;

        await supabase
          .from("scraping_jobs")
          .update({
            actual_results: validation.validItems.length,
            actual_cost: cost,
            quality_score: validation.qualityScore,
            validation_report: validation.report,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        return cost;
      });

      actualCostAccumulated += jobCost;

      // ── Check cost cap ────────────────────────────────────────────
      if (actualCostAccumulated >= capLimit) {
        capTriggered = true;

        await step.run("cap-triggered", async () => {
          await supabase
            .from("research_orders")
            .update({
              status: "completed_partial",
              actual_cost_usd: actualCostAccumulated,
              cap_triggered: true,
              execution_completed_at: new Date().toISOString(),
            })
            .eq("id", orderId);

          await supabase
            .from("research_projects")
            .update({
              status: "completed_partial",
              total_actual_cost: actualCostAccumulated,
              completed_at: new Date().toISOString(),
            })
            .eq("id", projectId);

          logTransition({
            orderId,
            userId: order.user_id,
            projectId,
            fromStatus: "executing",
            toStatus: "completed_partial",
            actualCost: actualCostAccumulated,
            priceCharged,
            margin: priceCharged - actualCostAccumulated,
            capTriggered: true,
          });

          console.warn(
            JSON.stringify({
              event: "order.cap_triggered",
              orderId,
              projectId,
              actualCost: actualCostAccumulated,
              capLimit,
              priceCharged,
            })
          );
        });

        return { projectId, orderId, status: "completed_partial", capTriggered: true };
      }
    }

    // ── AI analysis ─────────────────────────────────────────────────
    const analysisConfigs = await step.run("check-ai-analysis", async () => {
      const { data, error } = await supabase
        .from("ai_analysis_configs")
        .select("id, analysis_type, config")
        .eq("project_id", projectId)
        .eq("status", "pending");

      if (error) {
        console.error("Failed to fetch AI analysis configs:", error.message);
        return [];
      }
      return data ?? [];
    });

    if (analysisConfigs.length === 0) {
      // Complete the order
      await step.run("complete", async () => {
        await supabase
          .from("research_orders")
          .update({
            status: "completed",
            actual_cost_usd: actualCostAccumulated,
            execution_completed_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        await supabase
          .from("research_projects")
          .update({
            status: "completed",
            total_actual_cost: actualCostAccumulated,
            completed_at: new Date().toISOString(),
          })
          .eq("id", projectId);

        logTransition({
          orderId,
          userId: order.user_id,
          projectId,
          fromStatus: "executing",
          toStatus: "completed",
          actualCost: actualCostAccumulated,
          priceCharged,
          margin: priceCharged - actualCostAccumulated,
          capTriggered: false,
        });
      });

      return { projectId, orderId, status: "completed" };
    }

    // ── Submit AI batches ────────────────────────────────────────────
    const rawDataItems = await step.run("fetch-raw-data-for-ai", async () => {
      const { data, error } = await supabase
        .from("raw_data")
        .select("id, content")
        .eq("project_id", projectId);

      if (error) {
        throw new NonRetriableError(`Failed to fetch raw data: ${error.message}`);
      }

      return (data ?? []) as { id: string; content: Record<string, unknown> }[];
    });

    for (const config of analysisConfigs) {
      await step.run(`submit-batch-${config.id}`, async () => {
        const batchId = await submitBatchAnalysis(
          config.id,
          projectId,
          rawDataItems,
          config.analysis_type as AnalysisType,
          config.config as AnalysisConfig
        );

        await supabase
          .from("ai_analysis_configs")
          .update({ status: "processing", batch_id: batchId })
          .eq("id", config.id);

        await inngest.send({
          name: "research/process-batch",
          data: {
            projectId,
            orderId,
            analysisConfigId: config.id,
            batchId,
          },
        });
      });
    }

    return { projectId, orderId, status: "ai-analysis-submitted" };
  }
);
