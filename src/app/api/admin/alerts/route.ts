import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    await assertAdmin();

    const { searchParams } = req.nextUrl;
    const resolved = searchParams.get("resolved");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const supabase = createAdminClient();

    let query = supabase
      .from("admin_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (resolved === "false") {
      query = query.is("resolved_at", null);
    } else if (resolved === "true") {
      query = query.not("resolved_at", "is", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[admin/alerts]", error);
      return adminJson({ error: "query_failed" }, 500);
    }

    return adminJson(data ?? []);
  } catch (error) {
    return handleAdminError(error);
  }
}
