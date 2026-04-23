import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function CheckoutFailurePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { locale } = await params;
  const { order_id: orderId } = await searchParams;
  const t = await getTranslations("checkout.failure");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  let paymentUrl: string | null = null;

  if (orderId) {
    const { data: order } = await supabase
      .from("research_orders")
      .select("payment_url, status, expires_at")
      .eq("id", orderId)
      .single();

    // Only allow retry if the order is still pending and not expired
    if (
      order?.status === "pending_payment" &&
      order.expires_at &&
      new Date(order.expires_at) > new Date()
    ) {
      paymentUrl = order.payment_url;
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
        {paymentUrl && (
          <a
            href={paymentUrl}
            className={buttonVariants({ className: "w-full" })}
          >
            {t("retry")}
          </a>
        )}
      </Card>
    </div>
  );
}
