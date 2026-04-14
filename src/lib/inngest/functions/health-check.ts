import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  startActorRun,
  getRunStatus,
  getDatasetItems,
  isRunFinished,
  isRunSucceeded,
} from "@/lib/apify/client";
import { toolCatalog } from "@/lib/apify/catalog";
import type { ToolCatalogEntry } from "@/types";

// ---------------------------------------------------------------------------
// Main cron function — runs every 12 hours
// ---------------------------------------------------------------------------
export const healthCheck = inngest.createFunction(
  {
    id: "health-check",
    retries: 0,
    triggers: [{ cron: "0 */12 * * *" }],
  },
  async ({ step }) => {
    const results: { toolId: string; result: string }[] = [];

    for (const tool of toolCatalog) {
      try {
        const testResult = await step.run(`test-${tool.id}`, async () => {
          return await runToolHealthCheck(tool);
        });

        results.push({ toolId: tool.id, result: testResult.testResult });
      } catch (err) {
        // One tool failure should not prevent testing the rest
        console.error(`Health check failed for ${tool.id}:`, err);
        results.push({ toolId: tool.id, result: "error" });
      }
    }

    return { tested: results.length, results };
  }
);

// ---------------------------------------------------------------------------
// Per-tool health check logic
// ---------------------------------------------------------------------------
type TestResult = "success" | "partial" | "failure";

async function runToolHealthCheck(
  tool: ToolCatalogEntry
): Promise<{
  testResult: TestResult;
  actualResults: number;
  costUsd: number;
  durationMs: number;
}> {
  const supabase = createAdminClient();
  const startTime = Date.now();
  const maxPolls = Math.ceil(tool.healthCheck.maxDurationSeconds / 30);

  // 1. Start the Apify actor with the health-check input
  const run = await startActorRun(tool.actorId, tool.healthCheck.input);

  // 2. Poll until finished
  let currentRun = await getRunStatus(run.id);

  for (let attempt = 0; attempt < maxPolls && !isRunFinished(currentRun.status); attempt++) {
    // We cannot use step.sleep inside a step.run, so we use a simple
    // await-based delay here. The entire per-tool test lives inside a
    // single step.run call so durable sleeps are not needed.
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    currentRun = await getRunStatus(run.id);
  }

  const durationMs = Date.now() - startTime;
  const costUsd = currentRun.usage?.USD ?? 0;

  // 3. Evaluate result
  let testResult: TestResult;
  let actualResults = 0;

  if (isRunFinished(currentRun.status) && isRunSucceeded(currentRun.status)) {
    const items = await getDatasetItems(currentRun.defaultDatasetId);
    actualResults = items.length;

    testResult =
      actualResults >= tool.healthCheck.expectedMinResults
        ? "success"
        : "partial";
  } else {
    testResult = "failure";
  }

  // 4. Insert into actor_health_log
  await supabase.from("actor_health_log").insert({
    tool_id: tool.id,
    test_result: testResult,
    actual_results: actualResults,
    cost_usd: costUsd,
    duration_ms: durationMs,
    run_id: run.id,
    run_status: currentRun.status,
  });

  // 5. Update actor_health
  await updateActorHealth(supabase, tool.id, testResult);

  return { testResult, actualResults, costUsd, durationMs };
}

// ---------------------------------------------------------------------------
// Update actor_health record
// ---------------------------------------------------------------------------
async function updateActorHealth(
  supabase: ReturnType<typeof createAdminClient>,
  toolId: string,
  testResult: TestResult
): Promise<void> {
  const now = new Date().toISOString();

  // Fetch current actor_health row
  const { data: current } = await supabase
    .from("actor_health")
    .select("*")
    .eq("tool_id", toolId)
    .single();

  // Calculate consecutive failures
  let consecutiveFailures: number;
  if (testResult === "failure") {
    consecutiveFailures = (current?.consecutive_failures ?? 0) + 1;
  } else {
    consecutiveFailures = 0;
  }

  // Calculate success_rate_7d from actor_health_log
  const { data: rateData } = await supabase.rpc("calculate_success_rate_7d", {
    p_tool_id: toolId,
  });

  // Fallback: query manually if RPC doesn't exist
  let successRate7d: number;
  if (rateData != null) {
    successRate7d = rateData;
  } else {
    const { data: logs } = await supabase
      .from("actor_health_log")
      .select("test_result")
      .eq("tool_id", toolId)
      .gte("tested_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const total = logs?.length ?? 0;
    const successes = logs?.filter((l) => l.test_result === "success").length ?? 0;
    successRate7d = total > 0 ? (successes * 100.0) / total : 100;
  }

  // Calculate avg_cost_per_result from recent logs
  const { data: costLogs } = await supabase
    .from("actor_health_log")
    .select("cost_usd, actual_results")
    .eq("tool_id", toolId)
    .gte("tested_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  let avgCostPerResult: number | null = null;
  if (costLogs && costLogs.length > 0) {
    const totalCost = costLogs.reduce((s, l) => s + (l.cost_usd ?? 0), 0);
    const totalResults = costLogs.reduce((s, l) => s + (l.actual_results ?? 0), 0);
    avgCostPerResult = totalResults > 0 ? totalCost / totalResults : null;
  }

  // Determine status
  let status: "healthy" | "degraded" | "down";
  if (consecutiveFailures >= 3) {
    status = "down";
  } else if (successRate7d < 80) {
    status = "degraded";
  } else if (successRate7d >= 90) {
    status = "healthy";
  } else {
    // Between 80 and 90 — keep current status or default to degraded
    status = current?.status ?? "degraded";
  }

  const isAvailable = status !== "down";

  const upsertData = {
    tool_id: toolId,
    status,
    is_available: isAvailable,
    consecutive_failures: consecutiveFailures,
    success_rate_7d: successRate7d,
    last_test_at: now,
    updated_at: now,
    avg_cost_per_result: avgCostPerResult,
    ...(testResult !== "failure" ? { last_success_at: now } : {}),
  };

  await supabase
    .from("actor_health")
    .upsert(upsertData, { onConflict: "tool_id" });
}
