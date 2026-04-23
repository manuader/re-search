import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

const CSV_HEADERS = [
  "user_id", "email", "locale", "user_created_at",
  "orders_paid", "projects_paid",
  "lifetime_revenue_usd", "lifetime_internal_cost_usd", "lifetime_margin_usd",
  "last_paid_at",
];

function escapeCSV(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  try {
    const { adminId } = await assertAdmin();

    await logAdminAction(adminId, "export_users_csv", { req });

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("v_admin_user_spending")
      .select("*")
      .order("lifetime_revenue_usd", { ascending: false });

    if (error) {
      return handleAdminError(error);
    }

    const rows = data ?? [];
    const lines = [CSV_HEADERS.join(",")];

    for (const row of rows) {
      lines.push(
        CSV_HEADERS.map((h) => escapeCSV(row[h as keyof typeof row])).join(",")
      );
    }

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    return handleAdminError(error);
  }
}
