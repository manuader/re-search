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
  toolId: string;
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
      // Extract tool and cost data from tool parts
      const newTools: SelectedTool[] = [];
      const costUpdates: { toolId: string; cost: number; resultCount: number }[] = [];

      for (const part of message.parts) {
        if (part.type === "text") continue;
        if (!("state" in part) || part.state !== "output-available" || !("output" in part)) continue;

        const output = part.output as Record<string, unknown>;
        if (!output || typeof output !== "object") continue;

        // searchTools returns an array directly (not wrapped in "results")
        if (Array.isArray(output)) {
          for (const r of output) {
            if (r && typeof r === "object" && "name" in r && "id" in r) {
              newTools.push({
                toolId: String((r as Record<string, unknown>).id),
                name: String((r as Record<string, unknown>).name),
                healthStatus: String((r as Record<string, unknown>).healthStatus ?? "unknown"),
                estimatedResults: 0,
                cost: 0,
              });
            }
          }
        }

        // estimateCost returns { expected, min, max, breakdown }
        if ("expected" in output && "breakdown" in output) {
          const breakdown = String(output.breakdown ?? "");
          // Extract toolId from the input of this tool call
          const input = "input" in part ? (part.input as Record<string, unknown>) : null;
          const toolId = input ? String(input.toolId ?? "") : "";
          const resultCount = input ? Number(input.resultCount ?? 0) : 0;

          if (toolId) {
            costUpdates.push({
              toolId,
              cost: Number(output.expected ?? 0),
              resultCount,
            });
          }
        }
      }

      // Merge: add new tools, then apply cost updates
      setSelectedTools((prev) => {
        let merged = [...prev];
        // Add new tools (avoid duplicates)
        for (const t of newTools) {
          if (!merged.some((m) => m.toolId === t.toolId)) {
            merged.push(t);
          }
        }
        // Apply cost updates to matching tools
        for (const update of costUpdates) {
          merged = merged.map((t) =>
            t.toolId === update.toolId
              ? { ...t, cost: update.cost, estimatedResults: update.resultCount }
              : t
          );
        }
        return merged;
      });

      // Update total cost
      const newCostTotal = costUpdates.reduce((sum, u) => sum + u.cost, 0);
      if (newCostTotal > 0) {
        setTotalCost((prev) => prev + newCostTotal);
      }
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
