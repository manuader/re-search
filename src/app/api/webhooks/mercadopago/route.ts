import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { logTransition } from "@/lib/orders/state-machine";

interface MPWebhookBody {
  action: string;
  type: string;
  data: { id: string };
}

interface MPPayment {
  id: number;
  status: string;
  status_detail: string;
  metadata: {
    order_id?: string;
    user_id?: string;
  };
  external_reference: string;
}

function verifySignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  let ts: string | null = null;
  let v1: string | null = null;

  for (const part of xSignature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "ts") ts = value?.trim() ?? null;
    else if (key?.trim() === "v1") v1 = value?.trim() ?? null;
  }

  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const calculated = createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: MPWebhookBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 2. Ignore non-payment notifications
  if (body.type !== "payment") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // 3. Verify webhook signature
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[MP Webhook] MERCADOPAGO_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";
  const dataId = req.nextUrl.searchParams.get("data.id") ?? body.data?.id ?? "";

  if (!verifySignature(xSignature, xRequestId, dataId, secret)) {
    console.warn("[MP Webhook] Signature verification failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Fetch payment details from MP API (never trust webhook body alone)
  const paymentId = body.data.id;
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("[MP Webhook] MERCADOPAGO_ACCESS_TOKEN is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  let payment: MPPayment;
  try {
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!mpRes.ok) {
      console.error(`[MP Webhook] Failed to fetch payment ${paymentId}: ${mpRes.status}`);
      return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
    }

    payment = await mpRes.json();
  } catch (err) {
    console.error("[MP Webhook] Error fetching payment details:", err);
    return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const orderId = payment.metadata?.order_id ?? payment.external_reference;

  if (!orderId) {
    console.error("[MP Webhook] No order_id in payment metadata", payment.metadata);
    return NextResponse.json({ error: "Missing order reference" }, { status: 400 });
  }

  // 5. Handle based on payment status
  if (payment.status === "approved") {
    // Idempotency: check if already processed
    const { data: existingOrder } = await supabase
      .from("research_orders")
      .select("id, status, user_id, project_id, kind")
      .eq("id", orderId)
      .single();

    if (!existingOrder) {
      console.error(`[MP Webhook] Order ${orderId} not found`);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Already processed — return 200 (idempotent)
    if (existingOrder.status !== "pending_payment") {
      console.log(
        JSON.stringify({
          event: "webhook.idempotent_skip",
          orderId,
          mpPaymentId: paymentId,
          currentStatus: existingOrder.status,
        })
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Optimistic lock: only update if still pending_payment
    const { data: updated, error: updateError } = await supabase
      .from("research_orders")
      .update({
        status: "paid",
        payment_id: String(payment.id),
        payment_status: payment.status,
        paid_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "pending_payment")
      .select("id, kind, project_id")
      .single();

    if (updateError || !updated) {
      // Another webhook beat us — that's fine
      console.log(
        JSON.stringify({
          event: "webhook.concurrent_skip",
          orderId,
          mpPaymentId: paymentId,
        })
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    logTransition({
      orderId,
      userId: existingOrder.user_id,
      projectId: existingOrder.project_id,
      fromStatus: "pending_payment",
      toStatus: "paid",
    });

    // Dispatch Inngest event based on order kind
    if (updated.kind === "research") {
      await inngest.send({
        name: "research/execute",
        data: { projectId: updated.project_id, orderId: updated.id },
      });
    } else {
      await inngest.send({
        name: "report/generate",
        data: {
          projectId: updated.project_id,
          orderId: updated.id,
          userId: existingOrder.user_id,
          locale: "en", // Will be resolved from profile in the function
        },
      });
    }

    console.log(
      JSON.stringify({
        event: "webhook.payment_processed",
        orderId,
        mpPaymentId: paymentId,
        kind: updated.kind,
        action: "transitioned_to_paid",
      })
    );
  } else if (payment.status === "rejected") {
    // Update payment status but don't change order status
    await supabase
      .from("research_orders")
      .update({ payment_status: payment.status })
      .eq("id", orderId);

    console.log(
      JSON.stringify({
        event: "webhook.payment_rejected",
        orderId,
        mpPaymentId: paymentId,
        reason: payment.status_detail,
      })
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
