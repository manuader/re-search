import { assertAdmin } from "@/lib/admin/guard";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await assertAdmin();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("v_admin_apify_cost_by_tool")
      .select("*")
      .order("total_cost_usd", { ascending: false });

    if (error) {
      console.error("[admin/costs/apify]", error);
      return adminJson({ error: "query_failed" }, 500);
    }

    return adminJson(data ?? []);
  } catch (error) {
    return handleAdminError(error);
  }
}
