import { MercadoPagoConfig, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").trim(),
});

// USD → ARS conversion rate for MercadoPago (Argentine accounts require ARS)
const USD_TO_ARS = 1400;

interface CreatePreferenceParams {
  userId: string;
  amount: number;
  locale: string;
  appUrl: string;
}

/** @deprecated Use createOrderPreference for pay-per-use flow */
export async function createCreditPreference({
  userId,
  amount,
  locale,
  appUrl,
}: CreatePreferenceParams) {
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [
        {
          id: "credits",
          title: ({ es: "Créditos ResearchBot", pt: "Créditos ResearchBot", fr: "Crédits ResearchBot", de: "ResearchBot Guthaben" } as Record<string, string>)[locale] ?? "ResearchBot Credits",
          quantity: 1,
          unit_price: amount,
          currency_id: "ARS",
        },
      ],
      back_urls: {
        success: `${appUrl}/${locale}/billing?status=success`,
        failure: `${appUrl}/${locale}/billing?status=failure`,
        pending: `${appUrl}/${locale}/billing?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      metadata: {
        user_id: userId,
        credit_amount: amount,
      },
      external_reference: userId,
    },
  });

  return result;
}

// ─── Pay-per-use order preference ───────────────────────────────────────────

interface CreateOrderPreferenceParams {
  orderId: string;
  userId: string;
  projectTitle: string;
  priceUsd: number;
  locale: string;
  appUrl: string;
}

const ORDER_TITLES: Record<string, string> = {
  es: "Investigacion ResearchBot",
  pt: "Pesquisa ResearchBot",
  fr: "Recherche ResearchBot",
  de: "ResearchBot Forschung",
};

export async function createOrderPreference({
  orderId,
  userId,
  projectTitle,
  priceUsd,
  locale,
  appUrl,
}: CreateOrderPreferenceParams) {
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [
        {
          id: `order-${orderId}`,
          title: ORDER_TITLES[locale] ?? "ResearchBot Research",
          description: projectTitle,
          quantity: 1,
          unit_price: Math.round(priceUsd * USD_TO_ARS),
          currency_id: "ARS",
        },
      ],
      back_urls: {
        success: `${appUrl}/${locale}/checkout/success?order_id=${orderId}`,
        failure: `${appUrl}/${locale}/checkout/failure?order_id=${orderId}`,
        pending: `${appUrl}/${locale}/checkout/pending?order_id=${orderId}`,
      },
      auto_return: "approved",
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      metadata: {
        order_id: orderId,
        user_id: userId,
      },
      external_reference: orderId,
    },
  });

  return result;
}

export async function refundPayment(
  paymentId: string,
  amount?: number
): Promise<{ id: string; status: string }> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not set");

  const body: Record<string, unknown> = {};
  if (amount !== undefined) body.amount = amount;

  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MP refund failed (${res.status}): ${text}`);
  }

  return res.json();
}
