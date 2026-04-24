"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import type { UIMessage } from "ai";
import type { Locale } from "@/types";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ResearchConfigPanel } from "./research-config-panel";
import { useTranslations } from "next-intl";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PanelTool {
  toolId: string;
  name: string;
  healthStatus: string;
  estimatedResults: number;
  cost: number;
  keywords: string[];
  costPerKeyword: number;
}

export interface PanelAIAnalysis {
  type: string;
  description: string;
}

interface ChatInterfaceProps {
  projectId: string;
  locale: Locale;
  initialMessages?: UIMessage[];
  projectStatus: string;
}

// ─── Tool output accessor ───────────────────────────────────────────────────
// AI SDK v6 stores tool results in `output` property. This helper is
// defensive: it also checks `result` in case of future SDK changes.

function getToolOutput(part: unknown): Record<string, unknown> | null {
  const p = part as Record<string, unknown>;
  const raw = p.output ?? p.result ?? null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function getToolInput(part: unknown): Record<string, unknown> | null {
  const p = part as Record<string, unknown>;
  const raw = p.input ?? null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

// ─── Extract structured data from all messages ──────────────────────────────
// Scans every assistant message for tool parts and builds the panel state.
// Multiple passes: first collect tools, then apply costs/keywords/configs.

function extractPanelData(messages: UIMessage[]) {
  const toolMap = new Map<string, PanelTool>();
  const aiAnalyses: PanelAIAnalysis[] = [];
  let redirectUrl: string | null = null;

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isToolUIPart(part)) continue;

      const name = getToolName(part);
      const p = part as Record<string, unknown>;
      const state = (p.state as string) ?? "";
      if (state !== "output-available") continue;

      const out = getToolOutput(part);
      if (!out) continue;

      // ── searchTools: register tools ────────────────────────────────
      if (name === "searchTools" && Array.isArray(out.results)) {
        for (const r of out.results as Record<string, unknown>[]) {
          if (!r || typeof r !== "object") continue;
          const id = String(r.id ?? "");
          if (!id || toolMap.has(id)) continue;
          toolMap.set(id, {
            toolId: id,
            name: String(r.name ?? id),
            healthStatus: String(r.healthStatus ?? "unknown"),
            estimatedResults: 0,
            cost: 0,
            keywords: [],
            costPerKeyword: 0,
          });
        }
      }

      // ── suggestKeywords: populate keywords + cost ───────────────────
      if (name === "suggestKeywords" && Array.isArray(out.keywords)) {
        const toolId = String(out.toolId ?? "");
        const toolName = String(out.toolName ?? toolId);
        if (!toolId) continue;

        // Create tool if not yet seen (fallback for when searchTools
        // returned the tool under a different query or wasn't called)
        if (!toolMap.has(toolId)) {
          toolMap.set(toolId, {
            toolId,
            name: toolName,
            healthStatus: "unknown",
            estimatedResults: 0,
            cost: 0,
            keywords: [],
            costPerKeyword: 0,
          });
        }

        const tool = toolMap.get(toolId)!;
        tool.keywords = out.keywords as string[];
        tool.costPerKeyword = Number(out.costPerKeyword ?? 0);
        tool.cost = Number(out.totalEstimate ?? 0);
        tool.estimatedResults =
          tool.keywords.length * Number(out.resultsPerKeyword ?? 100);
      }

      // ── estimateCost: update tool cost ─────────────────────────────
      if (name === "estimateCost" && "expected" in out) {
        const input = getToolInput(part);
        const toolId = input ? String(input.toolId ?? "") : "";
        if (toolId && toolMap.has(toolId)) {
          const tool = toolMap.get(toolId)!;
          tool.cost = Number(out.expected ?? 0);
          tool.estimatedResults = input
            ? Number(input.resultCount ?? tool.estimatedResults)
            : tool.estimatedResults;
        }
      }

      // ── updateProjectConfig: update cost from mapper ───────────────
      if (name === "updateProjectConfig" && out.ok === true) {
        const input = getToolInput(part);
        const toolId = input ? String(input.toolId ?? "") : "";
        if (toolId && toolMap.has(toolId)) {
          const tool = toolMap.get(toolId)!;
          if (out.effectiveResultCount) {
            tool.estimatedResults = Number(out.effectiveResultCount);
          }
          const estimate = out.estimate as Record<string, unknown> | undefined;
          if (estimate?.expected) {
            tool.cost = Number(estimate.expected);
          }
        }
      }

      // ── addToolToProject: register tool ────────────────────────────
      if (name === "addToolToProject" && out.toolId) {
        const id = String(out.toolId);
        if (!toolMap.has(id)) {
          toolMap.set(id, {
            toolId: id,
            name: String(out.name ?? id),
            healthStatus: String(out.healthStatus ?? "unknown"),
            estimatedResults: 0,
            cost: 0,
            keywords: [],
            costPerKeyword: 0,
          });
        }
      }

      // ── suggestAIAnalysis: collect AI analyses ─────────────────────
      if (name === "suggestAIAnalysis" && Array.isArray(out.suggestions)) {
        // Replace, don't append (chatbot may re-suggest)
        aiAnalyses.length = 0;
        for (const s of out.suggestions as Record<string, unknown>[]) {
          aiAnalyses.push({
            type: String(s.type ?? ""),
            description: String(s.description ?? ""),
          });
        }
      }

      // ── executeResearch: capture redirect URL ──────────────────────
      if (name === "executeResearch" && out.success === true && out.url) {
        redirectUrl = String(out.url);
      }
    }
  }

  const tools = Array.from(toolMap.values());
  const totalCost = tools.reduce((sum, t) => sum + t.cost, 0);

  return { tools, totalCost, aiAnalyses, redirectUrl };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ChatInterface({
  projectId,
  locale,
  initialMessages,
  projectStatus,
}: ChatInterfaceProps) {
  const t = useTranslations("chat");
  const router = useRouter();
  const [panelTools, setPanelTools] = useState<PanelTool[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [aiAnalyses, setAiAnalyses] = useState<PanelAIAnalysis[]>([]);
  const [redirected, setRedirected] = useState(false);

  const handleKeywordSelectionChange = useCallback(
    (toolId: string, selected: string[]) => {
      setPanelTools((prev) =>
        prev.map((tool) => {
          if (tool.toolId !== toolId) return tool;
          const newCost = selected.length * tool.costPerKeyword;
          return {
            ...tool,
            keywords: selected,
            cost: newCost,
            estimatedResults: selected.length * 100,
          };
        })
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

  // Scan all messages for structured data whenever messages change
  useEffect(() => {
    const data = extractPanelData(messages);

    if (data.tools.length > 0) {
      setPanelTools(data.tools);
      setTotalCost(data.totalCost);
    }
    if (data.aiAnalyses.length > 0) {
      setAiAnalyses(data.aiAnalyses);
    }

    // Handle checkout redirect
    if (data.redirectUrl && !redirected) {
      setRedirected(true);
      router.push(data.redirectUrl);
    }
  }, [messages, redirected, router]);

  // Recalculate total cost when panel tools change
  useEffect(() => {
    const total = panelTools.reduce((sum, t) => sum + t.cost, 0);
    setTotalCost(total);
  }, [panelTools]);

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
        <MessageList
          messages={messages}
          onKeywordSelectionChange={handleKeywordSelectionChange}
        />
        <ChatInput onSend={handleSend} disabled={isDisabled} />
      </div>

      <div className="w-full shrink-0 lg:w-80 lg:overflow-y-auto mt-4 lg:mt-0">
        <ResearchConfigPanel
          projectId={projectId}
          locale={locale}
          tools={panelTools}
          aiAnalyses={aiAnalyses}
          totalCost={totalCost}
          onKeywordChange={handleKeywordSelectionChange}
          onGoToCheckout={() => {
            router.push(`/${locale}/projects/${projectId}/checkout`);
          }}
          disabled={isDisabled}
        />
      </div>
    </div>
  );
}
