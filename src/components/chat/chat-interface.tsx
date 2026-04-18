"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
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
  const [keywordCosts, setKeywordCosts] = useState<Record<string, { count: number; costPerKeyword: number }>>({});

  function handleKeywordSelectionChange(toolId: string, selected: string[]) {
    setKeywordCosts((prev) => {
      const entry = prev[toolId];
      const costPerKeyword = entry?.costPerKeyword ?? 0;
      const updated = { ...prev, [toolId]: { count: selected.length, costPerKeyword } };

      // Recalculate total cost from all keyword selections
      let newTotal = 0;
      for (const [, v] of Object.entries(updated)) {
        newTotal += v.count * v.costPerKeyword;
      }
      setTotalCost(newTotal);

      return updated;
    });
  }

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { projectId, locale },
    }),
    messages: initialMessages,
    onFinish: ({ message }) => {
      const newTools: SelectedTool[] = [];
      const costUpdates: { toolId: string; cost: number; resultCount: number }[] = [];

      for (const part of message.parts) {
        if (part.type === "text") continue;
        if (!isToolUIPart(part)) continue;

        const name = getToolName(part);
        const state = "state" in part ? (part as { state: string }).state : "";
        if (state !== "output-available") continue;

        const output = "output" in part ? (part as { output: unknown }).output as Record<string, unknown> : null;
        if (!output || typeof output !== "object") continue;

        // searchTools
        if (name === "searchTools" && "results" in output && Array.isArray(output.results)) {
          for (const r of output.results) {
            if (r && typeof r === "object" && "name" in r && "id" in r) {
              const item = r as Record<string, unknown>;
              newTools.push({
                toolId: String(item.id),
                name: String(item.name),
                healthStatus: String(item.healthStatus ?? "unknown"),
                estimatedResults: 0,
                cost: 0,
              });
            }
          }
        }

        // suggestKeywords
        if (name === "suggestKeywords" && "keywords" in output) {
          const kwToolId = String(output.toolId ?? "");
          const kwCount = Array.isArray(output.keywords) ? output.keywords.length : 0;
          const cpk = Number(output.costPerKeyword ?? 0);
          if (kwToolId) {
            setKeywordCosts((prev) => ({
              ...prev,
              [kwToolId]: { count: kwCount, costPerKeyword: cpk },
            }));
            costUpdates.push({
              toolId: kwToolId,
              cost: Number(output.totalEstimate ?? 0),
              resultCount: kwCount * Number(output.resultsPerKeyword ?? 100),
            });
          }
        }

        // estimateCost
        if (name === "estimateCost" && "expected" in output) {
          const input = "input" in part ? (part as { input: unknown }).input as Record<string, unknown> | undefined : undefined;
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

      // Merge new tools + apply cost updates
      setSelectedTools((prev) => {
        let merged = [...prev];
        for (const t of newTools) {
          if (!merged.some((m) => m.toolId === t.toolId)) {
            merged.push(t);
          }
        }
        for (const update of costUpdates) {
          merged = merged.map((t) =>
            t.toolId === update.toolId
              ? { ...t, cost: update.cost, estimatedResults: update.resultCount }
              : t
          );
        }
        return merged;
      });

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
    <div className="flex h-full min-h-0 flex-col lg:flex-row lg:gap-4 p-4">
      {/* Chat area */}
      <div className="flex flex-1 flex-col min-h-0 rounded-xl border bg-card overflow-hidden">
        <MessageList messages={messages} onKeywordSelectionChange={handleKeywordSelectionChange} />
        <ChatInput onSend={handleSend} disabled={isDisabled} />
      </div>

      {/* Cost side panel */}
      <div className="w-full shrink-0 lg:w-72 lg:overflow-y-auto mt-4 lg:mt-0">
        <CostCard
          tools={selectedTools}
          totalCost={totalCost}
          disabled={isDisabled}
          onStartResearch={() => {
            sendMessage({ text: "Confirm. Start the research now." });
          }}
        />
      </div>
    </div>
  );
}
