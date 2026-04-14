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

// ---------------------------------------------------------------------------
// Event type
// ---------------------------------------------------------------------------
type ResearchExecuteEvent = {
  name: "research/execute";
  data: { projectId: string };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const POLL_INTERVAL = "30s";
const MAX_POLL_ITERATIONS = 60; // 60 * 30s = 30 min max
const RAW_DATA_BATCH_SIZE = 100;
const COST_MARKUP = 1.4;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------
export const executeResearch = inngest.createFunction(
  {
    id: "execute-research",
    retries: 0, // We handle retries at the step level
    triggers: [{ event: "research/execute" }],
  },
  async ({ event, step }) => {
    const { projectId } = event.data as ResearchExecuteEvent["data"];
    const supabase = createAdminClient();

    // ── Step: update-status ───────────────────────────────────────────
    await step.run("update-status", async () => {
      const { error } = await supabase
        .from("research_projects")
        .update({ status: "running" })
        .eq("id", projectId);

      if (error) {
        throw new NonRetriableError(`Failed to update project status: ${error.message}`);
      }
    });

    // ── Fetch scraping jobs ───────────────────────────────────────────
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

    // ── Process each job sequentially ─────────────────────────────────
    for (const job of jobs) {
      // Look up the tool from our static catalog
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

      // ── Step: start-{job.id} ──────────────────────────────────────
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

      // ── Step: poll-{job.id} ───────────────────────────────────────
      const finalRun = await step.run(`poll-${job.id}`, async () => {
        // The first check happens immediately inside this step.
        // We cannot use step.sleep inside step.run, so the polling
        // loop is handled with a capped iteration count. If the run
        // is not finished after the first check we return a sentinel
        // so the outer code can sleep + re-poll via separate steps.
        const status = await getRunStatus(runResult.id);

        if (isRunFinished(status.status)) {
          return status;
        }

        // Return null to signal "not finished yet"
        return null;
      });

      // If the first poll didn't finish, enter a sleep-then-poll loop
      // using individual steps so Inngest can durably persist progress.
      let currentRun = finalRun;

      for (let attempt = 1; attempt < MAX_POLL_ITERATIONS && !currentRun; attempt++) {
        await step.sleep(`wait-${job.id}-${attempt}`, POLL_INTERVAL);

        currentRun = await step.run(`poll-${job.id}-${attempt}`, async () => {
          const status = await getRunStatus(runResult.id);

          // Update the scraping job with latest status info
          await supabase
            .from("scraping_jobs")
            .update({ status: status.status.toLowerCase() })
            .eq("id", job.id);

          if (isRunFinished(status.status)) {
            return status;
          }

          return null;
        });
      }

      // If still not finished after all iterations, mark as timed out
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

      // ── Step: process-{job.id} ────────────────────────────────────
      await step.run(`process-${job.id}`, async () => {
        // Check if the run succeeded
        if (!isRunSucceeded(currentRun!.status)) {
          await supabase
            .from("scraping_jobs")
            .update({
              status: "failed",
              error_message: `Apify run ended with status: ${currentRun!.status}`,
              completed_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          return;
        }

        // Download dataset items
        const items = (await getDatasetItems(
          currentRun!.defaultDatasetId
        )) as Record<string, unknown>[];

        // Validate
        const validation = validateScrapedData(items, tool);

        // Batch-insert validated items into raw_data
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

        // Update scraping job with results
        await supabase
          .from("scraping_jobs")
          .update({
            actual_results: validation.validItems.length,
            actual_cost: currentRun!.usage?.USD ?? null,
            quality_score: validation.qualityScore,
            validation_report: validation.report,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      });
    }

    // ── Step: reconcile-costs ───────────────────────────────────────
    await step.run("reconcile-costs", async () => {
      // Fetch all scraping jobs for this project
      const { data: allJobs, error: jobsError } = await supabase
        .from("scraping_jobs")
        .select("actual_cost, status")
        .eq("project_id", projectId);

      if (jobsError) {
        console.error("Failed to fetch jobs for cost reconciliation:", jobsError.message);
        return;
      }

      // Sum actual costs of completed jobs
      const totalActualCost = (allJobs ?? [])
        .filter((j) => j.status === "completed" && j.actual_cost != null)
        .reduce((sum, j) => sum + (j.actual_cost as number), 0);

      // Apply markup — INVARIANT: userCost >= totalActualCost always
      const userCost = totalActualCost * COST_MARKUP;

      // Fetch the scraping_reserve transaction to get the reserved amount
      const { data: reserveTx } = await supabase
        .from("credit_transactions")
        .select("amount")
        .eq("project_id", projectId)
        .eq("type", "scraping_reserve")
        .single();

      const reservedAmount = Math.abs(reserveTx?.amount ?? 0);

      // Reconcile: refund or charge the difference
      if (reservedAmount > 0) {
        const difference = userCost - reservedAmount;

        if (difference < 0) {
          // Refund: user was overcharged in reserve
          await supabase.from("credit_transactions").insert({
            project_id: projectId,
            type: "scraping_adjustment",
            amount: Math.abs(difference), // positive = refund
            description: `Refund: reserved ${reservedAmount.toFixed(4)} but actual cost was ${userCost.toFixed(4)}`,
          });
        } else if (difference > 0) {
          // Charge extra: actual cost exceeded reserve
          await supabase.from("credit_transactions").insert({
            project_id: projectId,
            type: "scraping_adjustment",
            amount: -difference, // negative = charge
            description: `Additional charge: reserved ${reservedAmount.toFixed(4)} but actual cost was ${userCost.toFixed(4)}`,
          });
        }
      }

      // Update project with total actual cost
      await supabase
        .from("research_projects")
        .update({ total_actual_cost: userCost })
        .eq("id", projectId);
    });

    // ── Step: complete ──────────────────────────────────────────────
    await step.run("complete", async () => {
      // Check if AI analysis configs exist (Phase 4 will handle these)
      const { data: analysisConfigs } = await supabase
        .from("ai_analysis_configs")
        .select("id")
        .eq("project_id", projectId)
        .limit(1);

      if (analysisConfigs && analysisConfigs.length > 0) {
        // Phase 4: AI analysis will be triggered here
        // For now, just mark the project as completed
        console.log(
          `Project ${projectId} has ${analysisConfigs.length} AI analysis config(s) — skipping for now (Phase 4)`
        );
      }

      await supabase
        .from("research_projects")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", projectId);
    });

    return { projectId, status: "completed" };
  }
);
