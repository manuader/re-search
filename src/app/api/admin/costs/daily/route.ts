import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    await assertAdmin();

    const { searchParams } = req.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const supabase = createAdminClient();

    let query = supabase
      .from("v_admin_daily_costs")
      .select("*")
      .order("day", { ascending: false })
      .limit(180);

    if (from) query = query.gte("day", from);
    if (to) query = query.lte("day", to);

    const { data, error } = await query;

    if (error) {
      console.error("[admin/costs/daily]", error);
      return adminJson({ error: "query_failed" }, 500);
    }

    return adminJson(data ?? []);
  } catch (error) {
    return handleAdminError(error);
  }
}
