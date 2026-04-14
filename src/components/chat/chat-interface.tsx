"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import type { Locale } from "@/types";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { CostCard } from "./cost-card";

interface SelectedTool {
  name: string;
  healthStatus: string;
  estimatedResults: number;
  cost: number;
}

interface ChatInterfaceProps {
  projectId: string;
  locale: Locale;
  initialMessages?: UIMessage[];
  projectStatus: string;
}

export function ChatInterface({
  projectId,
  locale,
  initialMessages,
  projectStatus,
}: ChatInterfaceProps) {
  const [selectedTools, setSelectedTools] = useState<SelectedTool[]>([]);
  const [totalCost, setTotalCost] = useState(0);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { projectId, locale },
    }),
    messages: initialMessages,
    onFinish: ({ message }) => {
      // Extract cost/tool data from tool parts when the assistant finishes
      const tools: SelectedTool[] = [];
      let cost = 0;

      for (const part of message.parts) {
        if (part.type === "text") continue;
        if ("state" in part && part.state === "output-available" && "output" in part) {
          const output = part.output as Record<string, unknown>;
          // Handle estimateCost tool output
          if (output && typeof output === "object" && "expected" in output) {
            cost += (output.expected as number) ?? 0;
          }
          // Handle searchTools output for selected tools
          if (output && typeof output === "object" && "results" in output) {
            const results = output.results;
            if (Array.isArray(results)) {
              for (const r of results) {
                if (r && typeof r === "object" && "name" in r) {
                  tools.push({
                    name: String(r.name),
                    healthStatus: String(r.healthStatus ?? "unknown"),
                    estimatedResults: 0,
                    cost: 0,
                  });
                }
              }
            }
          }
        }
      }

      if (tools.length > 0) setSelectedTools(tools);
      if (cost > 0) setTotalCost(cost);
    },
  });

  const isDisabled =
    status === "streaming" ||
    status === "submitted" ||
    projectStatus === "completed";

  function handleSend(text: string) {
    sendMessage({ text });
  }

  return (
    <div className="flex h-full flex-col gap-4 lg:flex-row">
      {/* Chat area */}
      <div className="flex flex-1 flex-col rounded-xl border bg-card">
        <MessageList messages={messages} />
        <ChatInput onSend={handleSend} disabled={isDisabled} />
      </div>

      {/* Cost side panel */}
      <div className="w-full shrink-0 lg:w-72">
        <CostCard tools={selectedTools} totalCost={totalCost} />
      </div>
    </div>
  );
}
