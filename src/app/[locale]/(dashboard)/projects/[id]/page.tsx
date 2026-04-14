import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ProgressTracker } from "@/components/project/progress-tracker";
import type { Locale } from "@/types";

export default async function ProjectPage({
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
    .select("*")
    .eq("id", id)
    .single();

  if (!project || project.user_id !== user.id) {
    redirect(`/${locale}`);
  }

  return (
    <div className="flex h-full flex-col">
      {["running", "completed", "failed"].includes(project.status) && (
        <div className="border-b p-4">
          <ProgressTracker projectId={id} />
        </div>
      )}
      <div className="flex-1">
        <ChatInterface
          projectId={id}
          locale={locale as Locale}
          projectStatus={project.status}
        />
      </div>
    </div>
  );
}
