import { assertAdmin } from "@/lib/admin/guard";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await assertAdmin();

    const supabase = createAdminClient();

    const [funnelResult, priceResult, reportResult, timeResult] =
      await Promise.all([
        supabase.from("v_funnel_30d").select("*").single(),
        supabase.from("v_abandonment_by_price").select("*").order("price_bucket"),
        supabase.from("v_report_type_distribution").select("*"),
        supabase.from("v_time_to_pay").select("*").single(),
      ]);

    return adminJson({
      funnel: funnelResult.data ?? null,
      abandonmentByPrice: priceResult.data ?? [],
      reportTypeDistribution: reportResult.data ?? [],
      timeToPay: timeResult.data ?? null,
    });
  } catch (error) {
    return handleAdminError(error);
  }
}
