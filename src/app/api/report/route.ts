import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await req.json();

  // Verify project belongs to user
  const { data: project } = await supabase
    .from("research_projects")
    .select("id, user_id, title")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check there's data to report on
  const { count } = await supabase
    .from("raw_data")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (!count || count === 0) {
    return NextResponse.json(
      { error: "No data to generate report" },
      { status: 400 }
    );
  }

  // Get locale
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();
  const locale = (profile?.locale ?? "en") as "en" | "es";

  // Dispatch to Inngest (returns immediately)
  await inngest.send({
    name: "report/generate",
    data: { projectId, userId: user.id, locale },
  });

  return NextResponse.json({ status: "generating" });
}
