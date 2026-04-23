import { assertAdmin } from "@/lib/admin/guard";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await assertAdmin();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("v_admin_claude_cost")
      .select("*")
      .order("day", { ascending: false });

    if (error) {
      console.error("[admin/costs/claude]", error);
      return adminJson({ error: "query_failed" }, 500);
    }

    return adminJson(data ?? []);
  } catch (error) {
    return handleAdminError(error);
  }
}
