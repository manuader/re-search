import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const expireOrders = inngest.createFunction(
  {
    id: "expire-orders",
    triggers: [{ cron: "*/5 * * * *" }], // Every 5 minutes
  },
  async ({ step }) => {
    const count = await step.run("expire-pending-orders", async () => {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from("research_orders")
        .update({ status: "expired" })
        .eq("status", "pending_payment")
        .lt("expires_at", new Date().toISOString())
        .select("id");

      if (error) {
        console.error("[expire-orders] Error:", error.message);
        return 0;
      }

      const expired = data?.length ?? 0;
      if (expired > 0) {
        console.log(
          JSON.stringify({
            event: "orders.expired_by_cron",
            count: expired,
            orderIds: data?.map((o) => o.id),
          })
        );
      }

      return expired;
    });

    return { expiredCount: count };
  }
);
