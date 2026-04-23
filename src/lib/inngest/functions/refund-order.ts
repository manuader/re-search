import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundPayment } from "@/lib/payments/mercadopago";
import { logTransition } from "@/lib/orders/state-machine";

type RefundOrderEvent = {
  name: "order/refund";
  data: {
    orderId: string;
    reason: string;
  };
};

export const refundOrder = inngest.createFunction(
  {
    id: "refund-order",
    retries: 5,
    triggers: [{ event: "order/refund" }],
  },
  async ({ event, step }) => {
    const { orderId, reason } = event.data as RefundOrderEvent["data"];
    const supabase = createAdminClient();

    const order = await step.run("load-order", async () => {
      const { data, error } = await supabase
        .from("research_orders")
        .select(
          "id, user_id, project_id, status, payment_id, price_charged_usd, actual_cost_usd, markup_multiplier"
        )
        .eq("id", orderId)
        .single();

      if (error || !data) throw new Error(`Order ${orderId} not found`);
      return data;
    });

    if (!order.payment_id) {
      console.error(`[refund-order] Order ${orderId} has no payment_id, cannot refund`);
      return { orderId, status: "no_payment_id" };
    }

    // Calculate refund amount
    const priceCharged = Number(order.price_charged_usd);
    const actualCost = Number(order.actual_cost_usd ?? 0);

    // If no cost was incurred → full refund
    // If cost was incurred → refund = price - (actual_cost * markup_floor)
    // Never refund below $0
    const MARKUP_FLOOR = 1.35; // lowest tier
    let refundAmount: number;

    if (actualCost === 0) {
      refundAmount = priceCharged;
    } else {
      refundAmount = Math.max(0, priceCharged - actualCost * MARKUP_FLOOR);
    }

    // Round to 2 decimal places
    refundAmount = Math.round(refundAmount * 100) / 100;

    if (refundAmount <= 0) {
      await step.run("mark-no-refund", async () => {
        await supabase
          .from("research_orders")
          .update({
            status: "completed",
            failure_reason: reason,
          })
          .eq("id", orderId);
      });

      return { orderId, status: "no_refund_needed", refundAmount: 0 };
    }

    // Mark as refund_pending
    await step.run("mark-refund-pending", async () => {
      await supabase
        .from("research_orders")
        .update({ status: "refund_pending", failure_reason: reason })
        .eq("id", orderId);

      logTransition({
        orderId,
        userId: order.user_id,
        projectId: order.project_id,
        fromStatus: order.status,
        toStatus: "refund_pending",
        actualCost,
        priceCharged,
      });
    });

    // Call MP refund API
    const refundResult = await step.run("call-mp-refund", async () => {
      return refundPayment(order.payment_id!, refundAmount);
    });

    // Mark as refunded
    await step.run("mark-refunded", async () => {
      await supabase
        .from("research_orders")
        .update({
          status: "refunded",
          refund_id: String(refundResult.id),
          refunded_amount_usd: refundAmount,
          refunded_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      logTransition({
        orderId,
        userId: order.user_id,
        projectId: order.project_id,
        fromStatus: "refund_pending",
        toStatus: "refunded",
        actualCost,
        priceCharged,
      });
    });

    return { orderId, status: "refunded", refundAmount };
  }
);
