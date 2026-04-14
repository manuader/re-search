import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { flattenRawData } from "@/lib/export/flatten";
import { DataTable } from "@/components/project/data-table";
import { ExportButton } from "@/components/project/export-button";

export default async function DataPage({
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
    .select("id, user_id, title, status")
    .eq("id", id)
    .single();

  if (!project || project.user_id !== user.id) redirect(`/${locale}`);

  const { data: rawData } = await supabase
    .from("raw_data")
    .select("id, source, content, ai_fields, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const flattened = flattenRawData(rawData ?? []);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{project.title}</h1>
        <ExportButton projectId={id} />
      </div>
      <div className="flex-1 overflow-hidden">
        <DataTable data={flattened} loading={false} />
      </div>
    </div>
  );
}
