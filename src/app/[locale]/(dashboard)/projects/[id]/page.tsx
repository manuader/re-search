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

  // Load chat messages and convert to UIMessage format
  const { data: dbMessages } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const initialMessages = (dbMessages ?? []).map((m: { id: string; role: string; content: string }) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text" as const, text: m.content }],
  }));

  return (
    <div className="flex h-full flex-col">
      {["running", "completed", "failed"].includes(project.status) && (
        <div className="border-b p-4">
          <ProgressTracker projectId={id} />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatInterface
          projectId={id}
          locale={locale as Locale}
          projectStatus={project.status}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  );
}
