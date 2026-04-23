import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { adminId } = await assertAdmin();

    const { searchParams } = req.nextUrl;
    const filterAdminId = searchParams.get("adminId");
    const action = searchParams.get("action");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Number(searchParams.get("offset")) || 0;

    const supabase = createAdminClient();

    let query = supabase
      .from("admin_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filterAdminId) query = query.eq("admin_id", filterAdminId);
    if (action) query = query.eq("action", action);

    const { data, count, error } = await query;

    if (error) {
      console.error("[admin/audit]", error);
      return adminJson({ error: "query_failed" }, 500);
    }

    await logAdminAction(adminId, "view_audit_log", {
      filters: { filterAdminId, action, limit, offset },
      req,
    });

    return adminJson({
      entries: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    return handleAdminError(error);
  }
}
