import { streamText, stepCountIs, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createChatTools } from "@/lib/ai/chat-tools";
import type { Locale } from "@/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    projectId,
    locale = "en",
  }: {
    messages: UIMessage[];
    projectId: string;
    locale?: Locale;
  } = await req.json();

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify project belongs to user
  const { data: project } = await supabase
    .from("research_projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  const tools = createChatTools(locale as Locale, projectId, user.id);

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: buildSystemPrompt(locale as Locale),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
