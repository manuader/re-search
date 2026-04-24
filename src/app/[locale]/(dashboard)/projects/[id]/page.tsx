import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ProgressTracker } from "@/components/project/progress-tracker";
import type { Locale } from "@/types";

// Shape of tool invocations stored in DB
interface StoredToolInvocation {
  toolName: string;
  input: unknown;
  output: unknown;
}

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

  // Load chat messages including tool invocations
  const { data: dbMessages } = await supabase
    .from("chat_messages")
    .select("id, role, content, tool_invocations, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  // Reconstruct UIMessage format with tool parts from stored invocations.
  // Tool parts use the "dynamic-tool" type which accepts any toolName string.
  const initialMessages = (dbMessages ?? []).map(
    (m: {
      id: string;
      role: string;
      content: string;
      tool_invocations: StoredToolInvocation[] | null;
    }) => {
      const parts: unknown[] = [];

      // Add tool parts first (they appear before text in the chat)
      if (m.tool_invocations && Array.isArray(m.tool_invocations)) {
        for (let i = 0; i < m.tool_invocations.length; i++) {
          const inv = m.tool_invocations[i];
          parts.push({
            type: `tool-${inv.toolName}` as const,
            toolCallId: `${m.id}-tool-${i}`,
            toolName: inv.toolName,
            state: "output-available" as const,
            input: inv.input,
            output: inv.output,
          });
        }
      }

      // Add text part
      if (m.content) {
        parts.push({ type: "text" as const, text: m.content });
      }

      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        parts,
      };
    }
  ) as Parameters<typeof ChatInterface>[0]["initialMessages"];

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
