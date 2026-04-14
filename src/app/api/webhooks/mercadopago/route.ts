import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface MPWebhookBody {
  action: string;
  type: string;
  data: { id: string };
}

interface MPPayment {
  id: number;
  status: string;
  metadata: {
    user_id?: string;
    credit_amount?: number;
  };
}

function verifySignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  // x-signature format: "ts=TIMESTAMP,v1=HASH"
  let ts: string | null = null;
  let v1: string | null = null;

  for (const part of xSignature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "ts") ts = value?.trim() ?? null;
    else if (key?.trim() === "v1") v1 = value?.trim() ?? null;
  }

  if (!ts || !v1) return false;

  // Build the manifest string per MP docs
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const calculated = createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(v1, "hex"));
  } catch {
    // Buffer lengths differ — signature is definitely wrong
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
  // data.id comes from the query string MP appends to the notification_url
  const dataId = req.nextUrl.searchParams.get("data.id") ?? body.data?.id ?? "";

  if (!verifySignature(xSignature, xRequestId, dataId, secret)) {
    console.warn("[MP Webhook] Signature verification failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Fetch payment details from MP API
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
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!mpRes.ok) {
      console.error(
        `[MP Webhook] Failed to fetch payment ${paymentId}: ${mpRes.status}`
      );
      return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
    }

    payment = await mpRes.json();
  } catch (err) {
    console.error("[MP Webhook] Error fetching payment details:", err);
    return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
  }

  // 5. Only process approved payments
  if (payment.status !== "approved") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const userId = payment.metadata?.user_id;
  const creditAmount = payment.metadata?.credit_amount;

  if (!userId || creditAmount == null) {
    console.error(
      "[MP Webhook] Missing user_id or credit_amount in payment metadata",
      payment.metadata
    );
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  // 6. Insert credit transaction using admin client (no user session in webhooks)
  const supabase = createAdminClient();
  const { error: insertError } = await supabase.from("transactions").insert({
    user_id: userId,
    amount: +creditAmount,
    type: "credit_purchase",
    description: "Credit purchase via Mercado Pago",
  });

  if (insertError) {
    console.error("[MP Webhook] Failed to insert transaction:", insertError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
