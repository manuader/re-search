import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

interface AlertCandidate {
  level: "info" | "warning" | "critical";
  code: string;
  message: string;
  context: Record<string, unknown>;
  dedup_key: string;
}

async function checkMarginAnomalies(
  supabase: ReturnType<typeof createAdminClient>
): Promise<AlertCandidate[]> {
  const { data } = await supabase
    .from("v_admin_margin_anomalies")
    .select("id, price_charged_usd, actual_cost_usd, loss_usd")
    .limit(10);

  return (data ?? []).map((row) => ({
    level: "critical" as const,
    code: "margin_anomaly",
    message: `Order ${row.id} lost $${Number(row.loss_usd).toFixed(2)} (charged $${Number(row.price_charged_usd).toFixed(2)}, cost $${Number(row.actual_cost_usd).toFixed(2)})`,
    context: { orderId: row.id, loss: row.loss_usd },
    dedup_key: `margin_anomaly:${row.id}`,
  }));
}

async function checkCapTriggerSpike(
  supabase: ReturnType<typeof createAdminClient>
): Promise<AlertCandidate[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("v_admin_cap_trigger_rate")
    .select("*")
    .eq("day", today)
    .single();

  if (!data || data.total_completed < 20 || Number(data.cap_trigger_pct) <= 5) {
    return [];
  }

  return [
    {
      level: "warning",
      code: "cap_trigger_spike",
      message: `Cap triggered on ${data.cap_trigger_pct}% of orders today (${data.cap_triggered_count}/${data.total_completed})`,
      context: { day: today, pct: data.cap_trigger_pct, count: data.cap_triggered_count },
      dedup_key: `cap_trigger_spike:${today}`,
    },
  ];
}

async function checkActorDown(
  supabase: ReturnType<typeof createAdminClient>
): Promise<AlertCandidate[]> {
  const { data } = await supabase
    .from("actor_health")
    .select("tool_id, status, last_error")
    .eq("status", "down");

  return (data ?? []).map((row) => ({
    level: "warning" as const,
    code: "actor_down",
    message: `Tool "${row.tool_id}" is down: ${row.last_error ?? "unknown error"}`,
    context: { toolId: row.tool_id },
    dedup_key: `actor_down:${row.tool_id}`,
  }));
}

async function checkStuckOrders(
  supabase: ReturnType<typeof createAdminClient>
): Promise<AlertCandidate[]> {
  const { data } = await supabase
    .from("v_admin_stuck_orders")
    .select("id, status, stuck_minutes");

  if (!data || data.length < 3) return [];

  return [
    {
      level: "warning",
      code: "stuck_orders",
      message: `${data.length} orders are stuck (oldest: ${Math.round(Number(data[0].stuck_minutes))} min)`,
      context: { count: data.length, orderIds: data.map((o) => o.id) },
      dedup_key: `stuck_orders:batch`,
    },
  ];
}

async function checkRefundBacklog(
  supabase: ReturnType<typeof createAdminClient>
): Promise<AlertCandidate[]> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("research_orders")
    .select("id")
    .eq("status", "refund_pending")
    .lt("created_at", twoHoursAgo);

  if (!data || data.length < 5) return [];

  return [
    {
      level: "warning",
      code: "refund_pending_backlog",
      message: `${data.length} orders pending refund for over 2 hours`,
      context: { count: data.length, orderIds: data.map((o) => o.id) },
      dedup_key: `refund_pending_backlog:batch`,
    },
  ];
}

export const detectAdminAlerts = inngest.createFunction(
  {
    id: "detect-admin-alerts",
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    const supabase = createAdminClient();

    // Run all checks
    const candidates = await step.run("run-checks", async () => {
      const results = await Promise.all([
        checkMarginAnomalies(supabase),
        checkCapTriggerSpike(supabase),
        checkActorDown(supabase),
        checkStuckOrders(supabase),
        checkRefundBacklog(supabase),
      ]);
      return results.flat();
    });

    // Dedup: only insert alerts that don't already exist unresolved
    const inserted = await step.run("insert-new-alerts", async () => {
      if (candidates.length === 0) return 0;

      const { data: existing } = await supabase
        .from("admin_alerts")
        .select("code, context")
        .is("resolved_at", null);

      const existingKeys = new Set(
        (existing ?? []).map((a) => {
          const key = a.context && typeof a.context === "object" && "orderId" in (a.context as Record<string, unknown>)
            ? `${a.code}:${(a.context as Record<string, unknown>).orderId}`
            : a.context && typeof a.context === "object" && "toolId" in (a.context as Record<string, unknown>)
            ? `${a.code}:${(a.context as Record<string, unknown>).toolId}`
            : `${a.code}:batch`;
          return key;
        })
      );

      const newAlerts = candidates.filter((c) => !existingKeys.has(c.dedup_key));

      if (newAlerts.length === 0) return 0;

      const { error } = await supabase.from("admin_alerts").insert(
        newAlerts.map(({ dedup_key: _, ...alert }) => alert)
      );

      if (error) {
        console.error("[detect-admin-alerts] insert failed:", error.message);
        return 0;
      }

      return newAlerts.length;
    });

    // Auto-resolve alerts whose conditions no longer hold
    const resolved = await step.run("auto-resolve", async () => {
      const { data: unresolved } = await supabase
        .from("admin_alerts")
        .select("id, code, context")
        .is("resolved_at", null);

      if (!unresolved || unresolved.length === 0) return 0;

      const activeKeys = new Set(candidates.map((c) => c.dedup_key));
      const toResolve = unresolved.filter((a) => {
        const ctx = a.context as Record<string, unknown> | null;
        let key: string;
        if (ctx?.orderId) key = `${a.code}:${ctx.orderId}`;
        else if (ctx?.toolId) key = `${a.code}:${ctx.toolId}`;
        else key = `${a.code}:batch`;
        return !activeKeys.has(key);
      });

      if (toResolve.length === 0) return 0;

      const { error } = await supabase
        .from("admin_alerts")
        .update({ resolved_at: new Date().toISOString() })
        .in("id", toResolve.map((a) => a.id));

      if (error) {
        console.error("[detect-admin-alerts] resolve failed:", error.message);
        return 0;
      }

      return toResolve.length;
    });

    if (inserted > 0 || resolved > 0) {
      console.log(
        JSON.stringify({
          event: "admin_alerts.cycle",
          inserted,
          resolved,
          candidatesChecked: candidates.length,
        })
      );
    }

    return { inserted, resolved };
  }
);
