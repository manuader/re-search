import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BillingClient } from "@/components/billing/billing-client";

export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Fetch all orders for this user with project titles
  const { data: orders } = await supabase
    .from("research_orders")
    .select(`
      id, kind, status, price_charged_usd, report_type, payment_url,
      actual_cost_usd, cap_triggered, refunded_amount_usd, failure_reason,
      created_at, expires_at, paid_at, execution_completed_at, refunded_at,
      project_id,
      research_projects ( title )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <BillingClient
      locale={locale}
      orders={orders ?? []}
    />
  );
}
