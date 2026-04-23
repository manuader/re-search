import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    await assertAdmin();

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q");
    const limit = Math.min(Number(searchParams.get("limit")) || 25, 100);
    const offset = Number(searchParams.get("offset")) || 0;

    const supabase = createAdminClient();

    let query = supabase
      .from("v_admin_user_spending")
      .select("*", { count: "exact" })
      .order("lifetime_revenue_usd", { ascending: false })
      .range(offset, offset + limit - 1);

    if (q) {
      query = query.ilike("email", `%${q}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("[admin/users]", error);
      return adminJson({ error: "query_failed" }, 500);
    }

    return adminJson({
      users: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    return handleAdminError(error);
  }
}
