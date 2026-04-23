import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

const VIEWS = [
  "v_admin_daily_costs",
  "v_admin_apify_cost_by_tool",
  "v_admin_claude_cost",
  "v_admin_user_spending",
  "v_admin_stuck_orders",
  "v_admin_margin_anomalies",
  "v_admin_cap_trigger_rate",
  "v_funnel_30d",
  "v_abandonment_by_price",
  "v_report_type_distribution",
  "v_time_to_pay",
];

export const refreshAdminViews = inngest.createFunction(
  {
    id: "refresh-admin-views",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    const results: Record<string, { ok: boolean; durationMs: number }> = {};

    for (const view of VIEWS) {
      const result = await step.run(`refresh-${view}`, async () => {
        const supabase = createAdminClient();
        const start = Date.now();

        const { error } = await supabase.rpc("refresh_materialized_view", {
          view_name: view,
        });

        const durationMs = Date.now() - start;

        if (error) {
          console.error(`[refresh-admin-views] ${view} failed:`, error.message);
          return { ok: false, durationMs };
        }

        if (durationMs > 30_000) {
          console.warn(`[refresh-admin-views] ${view} took ${durationMs}ms (>30s)`);
        }

        return { ok: true, durationMs };
      });

      results[view] = result;
    }

    console.log(
      JSON.stringify({
        event: "admin_views.refreshed",
        results,
        timestamp: new Date().toISOString(),
      })
    );

    return results;
  }
);
