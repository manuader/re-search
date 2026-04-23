import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

const CSV_HEADERS = [
  "id", "user_id", "project_id", "kind", "status", "report_type",
  "price_charged_usd", "actual_cost_usd", "margin_usd", "cap_triggered",
  "created_at", "paid_at", "execution_completed_at", "failure_reason",
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

    const { searchParams } = req.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    await logAdminAction(adminId, "export_orders_csv", {
      filters: { from, to },
      req,
    });

    const supabase = createAdminClient();
    const BATCH_SIZE = 1000;

    const stream = new ReadableStream({
      async start(controller) {
        // Header row
        controller.enqueue(
          new TextEncoder().encode(CSV_HEADERS.join(",") + "\n")
        );

        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from("research_orders")
            .select(
              "id, user_id, project_id, kind, status, report_type, price_charged_usd, actual_cost_usd, cap_triggered, created_at, paid_at, execution_completed_at, failure_reason"
            )
            .order("created_at", { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1);

          if (from) query = query.gte("created_at", from);
          if (to) query = query.lte("created_at", to);

          const { data, error } = await query;

          if (error) {
            controller.error(error);
            return;
          }

          const rows = data ?? [];

          for (const row of rows) {
            const margin =
              row.actual_cost_usd != null
                ? Number(row.price_charged_usd) - Number(row.actual_cost_usd)
                : "";

            const line = [
              row.id,
              row.user_id,
              row.project_id,
              row.kind,
              row.status,
              row.report_type,
              row.price_charged_usd,
              row.actual_cost_usd ?? "",
              margin,
              row.cap_triggered,
              row.created_at,
              row.paid_at ?? "",
              row.execution_completed_at ?? "",
              row.failure_reason ?? "",
            ]
              .map(escapeCSV)
              .join(",");

            controller.enqueue(new TextEncoder().encode(line + "\n"));
          }

          hasMore = rows.length === BATCH_SIZE;
          offset += BATCH_SIZE;
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    return handleAdminError(error);
  }
}
