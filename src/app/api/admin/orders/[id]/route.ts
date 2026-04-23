import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { adminJson, handleAdminError } from "@/lib/admin/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { adminId } = await assertAdmin();
    const { id: orderId } = await params;

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from("research_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return adminJson({ error: "order_not_found" }, 404);
    }

    // Fetch related scraping jobs and AI configs
    const [jobsResult, aiResult] = await Promise.all([
      supabase
        .from("scraping_jobs")
        .select(
          "id, tool_id, tool_name, estimated_results, actual_results, estimated_cost, actual_cost, status, error_message, quality_score, started_at, completed_at"
        )
        .eq("project_id", order.project_id)
        .order("created_at"),
      supabase
        .from("ai_analysis_configs")
        .select(
          "id, analysis_type, estimated_cost, actual_cost, status, batch_id, created_at"
        )
        .eq("project_id", order.project_id)
        .order("created_at"),
    ]);

    await logAdminAction(adminId, "view_order_detail", {
      resource: `order:${orderId}`,
      req,
    });

    return adminJson({
      order,
      scrapingJobs: jobsResult.data ?? [],
      aiAnalysisConfigs: aiResult.data ?? [],
    });
  } catch (error) {
    return handleAdminError(error);
  }
}
