import { MercadoPagoConfig, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

interface CreatePreferenceParams {
  userId: string;
  amount: number;
  locale: string;
  appUrl: string;
}

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
          title: locale === "es" ? "Creditos ResearchBot" : "ResearchBot Credits",
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
