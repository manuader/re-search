import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId)
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  // Fetch latest report for this project
  const { data: report } = await supabase
    .from("reports")
    .select("id, html_content, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!report) {
    return NextResponse.json({ status: "generating" });
  }

  return NextResponse.json({
    status: "ready",
    htmlContent: report.html_content,
    reportId: report.id,
    createdAt: report.created_at,
  });
}
