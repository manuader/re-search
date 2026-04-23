import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CheckoutClient } from "./checkout-client";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id: projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  // Verify project ownership
  const { data: project } = await supabase
    .from("research_projects")
    .select("id, title, status")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) redirect(`/${locale}/dashboard`);

  // Fetch configured tools and AI analyses
  const [{ data: scrapingJobs }, { data: aiConfigs }] = await Promise.all([
    supabase
      .from("scraping_jobs")
      .select("id, tool_id, tool_name, estimated_results")
      .eq("project_id", projectId),
    supabase
      .from("ai_analysis_configs")
      .select("id, analysis_type")
      .eq("project_id", projectId),
  ]);

  return (
    <CheckoutClient
      locale={locale}
      projectId={projectId}
      projectTitle={project.title ?? "Research"}
      projectStatus={project.status}
      tools={scrapingJobs ?? []}
      aiAnalyses={aiConfigs ?? []}
    />
  );
}
