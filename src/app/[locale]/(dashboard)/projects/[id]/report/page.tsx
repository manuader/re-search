import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportClient } from "./report-client";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: project } = await supabase
    .from("research_projects")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (!project || project.user_id !== user.id) redirect(`/${locale}`);

  const { data: report } = await supabase
    .from("reports")
    .select("id, html_content")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <ReportClient
      projectId={id}
      initialHtmlContent={report?.html_content ?? null}
    />
  );
}
