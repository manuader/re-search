"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import type { UIMessage } from "ai";
import type { Locale } from "@/types";
import type { ToolSchema } from "@/lib/apify/tool-schema";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ResearchConfigPanel } from "./research-config-panel";
import { useTranslations } from "next-intl";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConfiguredTool {
  toolId: string;
  name: string;
  healthStatus: string;
  estimatedResults: number;
  cost: number;
  schema?: ToolSchema;
  config: Record<string, unknown>;
}

interface ChatInterfaceProps {
  projectId: string;
  locale: Locale;
  initialMessages?: UIMessage[];
  projectStatus: string;
}

// ─── Tool data extraction from messages ─────────────────────────────────────

function extractToolData(messages: UIMessage[]) {
  const tools: ConfiguredTool[] = [];
  const costs: Record<string, { cost: number; resultCount: number }> = {};
  const keywords: Record<string, { count: number; costPerKeyword: number }> = {};
  const configs: Record<string, Record<string, unknown>> = {};

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isToolUIPart(part)) continue;

      const name = getToolName(part);
      const state = "state" in part ? (part as { state: string }).state : "";
      if (state !== "output-available") continue;

      const output = "output" in part ? (part as { output: unknown }).output : null;
      if (!output || typeof output !== "object") continue;

      const out = output as Record<string, unknown>;

      if (name === "searchTools" && "results" in out && Array.isArray(out.results)) {
        for (const r of out.results) {
          if (r && typeof r === "object" && "id" in r && "name" in r) {
            const item = r as Record<string, unknown>;
            const id = String(item.id);
            if (!tools.some((t) => t.toolId === id)) {
              tools.push({
                toolId: id,
                name: String(item.name),
                healthStatus: String(item.healthStatus ?? "unknown"),
                estimatedResults: 0,
                cost: 0,
                config: {},
              });
            }
          }
        }
      }

      if (name === "suggestKeywords" && "keywords" in out) {
        const kwToolId = String(out.toolId ?? "");
        const kwList = Array.isArray(out.keywords) ? out.keywords : [];
        const cpk = Number(out.costPerKeyword ?? 0);
        if (kwToolId) {
          keywords[kwToolId] = { count: kwList.length, costPerKeyword: cpk };
          costs[kwToolId] = {
            cost: Number(out.totalEstimate ?? 0),
            resultCount: kwList.length * Number(out.resultsPerKeyword ?? 100),
          };
        }
      }

      if (name === "estimateCost" && "expected" in out) {
        const input = "input" in part ? (part as { input: unknown }).input as Record<string, unknown> : null;
        const toolId = input ? String(input.toolId ?? "") : "";
        const resultCount = input ? Number(input.resultCount ?? 0) : 0;
        if (toolId) {
          costs[toolId] = { cost: Number(out.expected ?? 0), resultCount };
        }
      }

      // Extract config from updateProjectConfig
      if (name === "updateProjectConfig" && "ok" in out && out.ok === true) {
        const input = "input" in part ? (part as { input: unknown }).input as Record<string, unknown> : null;
        const toolId = input ? String(input.toolId ?? "") : "";
        const config = input?.config as Record<string, unknown> | undefined;
        if (toolId && config) {
          configs[toolId] = config;
        }
        if (toolId && out.effectiveResultCount) {
          const estimate = out.estimate as Record<string, unknown> | undefined;
          costs[toolId] = {
            cost: Number(estimate?.expected ?? 0),
            resultCount: Number(out.effectiveResultCount),
          };
        }
      }
    }
  }

  // Apply costs and configs to tools
  for (const tool of tools) {
    const c = costs[tool.toolId];
    if (c) {
      tool.cost = c.cost;
      tool.estimatedResults = c.resultCount;
    }
    if (configs[tool.toolId]) {
      tool.config = configs[tool.toolId];
    }
  }

  const totalCost = Object.values(costs).reduce((sum, c) => sum + c.cost, 0);

  return { tools, totalCost, keywords };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ChatInterface({
  projectId,
  locale,
  initialMessages,
  projectStatus,
}: ChatInterfaceProps) {
  const t = useTranslations("chat");
  const [selectedTools, setSelectedTools] = useState<ConfiguredTool[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [keywordCosts, setKeywordCosts] = useState<Record<string, { count: number; costPerKeyword: number }>>({});

  const handleKeywordSelectionChange = useCallback((toolId: string, selected: string[]) => {
    setKeywordCosts((prev) => {
      const entry = prev[toolId];
      const costPerKeyword = entry?.costPerKeyword ?? 0;
      const updated = { ...prev, [toolId]: { count: selected.length, costPerKeyword } };

      let newTotal = 0;
      for (const [, v] of Object.entries(updated)) {
        newTotal += v.count * v.costPerKeyword;
      }
      setTotalCost(newTotal);

      return updated;
    });
  }, []);

  const handleConfigChange = useCallback(
    (toolId: string, config: Record<string, unknown>) => {
      setSelectedTools((prev) =>
        prev.map((tool) =>
          tool.toolId === toolId ? { ...tool, config } : tool
        )
      );
    },
    []
  );

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { projectId, locale },
    }),
    messages: initialMessages,
  });

  // Scan all messages for tool data whenever messages change
  useEffect(() => {
    const { tools, totalCost: tc, keywords } = extractToolData(messages);
    if (tools.length > 0) setSelectedTools(tools);
    if (tc > 0) setTotalCost(tc);
    if (Object.keys(keywords).length > 0) setKeywordCosts(keywords);
  }, [messages]);

  const isDisabled =
    status === "streaming" ||
    status === "submitted" ||
    projectStatus === "completed";

  function handleSend(text: string) {
    sendMessage({ text });
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row lg:gap-4 p-4">
      <div className="flex flex-1 flex-col min-h-0 rounded-xl border bg-card overflow-hidden">
        <MessageList messages={messages} onKeywordSelectionChange={handleKeywordSelectionChange} />
        <ChatInput onSend={handleSend} disabled={isDisabled} />
      </div>

      <div className="w-full shrink-0 lg:w-72 lg:overflow-y-auto mt-4 lg:mt-0">
        <ResearchConfigPanel
          projectId={projectId}
          locale={locale}
          tools={selectedTools}
          onConfigChange={handleConfigChange}
          totalCost={totalCost}
          onStartResearch={() => {
            sendMessage({ text: t("confirmStart") });
          }}
          disabled={isDisabled}
        />
      </div>
    </div>
  );
}
