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
import {
  AI_COST_PER_ANALYSIS,
  HAIKU_BATCH_INPUT_PER_MTOK,
  HAIKU_BATCH_OUTPUT_PER_MTOK,
  CHATBOT_FLAT_FEE_USD,
  MIN_SAFETY_BUFFER_USD,
  SAFETY_BUFFER_PERCENT,
  MIN_PRICE_USD,
  MARKUP_TIERS,
} from "@/lib/pricing/constants";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PanelTool {
  toolId: string;
  name: string;
  healthStatus: string;
  estimatedResults: number;
  cost: number; // raw scraping cost (from estimateCost/suggestKeywords)
  keywords: string[];
  costPerKeyword: number;
  config: Record<string, unknown>;
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

// ─── Price estimate breakdown ────────────────────────────────────────────────
// Client-side approximation that mirrors quotePricing so the panel shows a
// breakdown that matches what checkout will calculate.

export interface PriceEstimate {
  scrapingCost: number;
  aiCost: number;
  chatbotFee: number;
  buffer: number;
  markup: number;
  total: number;
}

function estimatePrice(
  scrapingCost: number,
  aiAnalyses: PanelAIAnalysis[],
  totalEstimatedItems: number
): PriceEstimate {
  let aiCost = 0;
  for (const a of aiAnalyses) {
    const spec =
      AI_COST_PER_ANALYSIS[a.type as keyof typeof AI_COST_PER_ANALYSIS];
    if (spec) {
      aiCost +=
        (spec.inputTokensPerItem * totalEstimatedItems * HAIKU_BATCH_INPUT_PER_MTOK) /
          1_000_000 +
        (spec.outputTokensPerItem * totalEstimatedItems * HAIKU_BATCH_OUTPUT_PER_MTOK) /
          1_000_000;
    }
  }

  const chatbotFee = CHATBOT_FLAT_FEE_USD;
  const internalCost = scrapingCost + aiCost + chatbotFee;
  const buffer = Math.max(MIN_SAFETY_BUFFER_USD, internalCost * SAFETY_BUFFER_PERCENT);

  let multiplier = MARKUP_TIERS[MARKUP_TIERS.length - 1].multiplier;
  for (const tier of MARKUP_TIERS) {
    if (internalCost < tier.maxCost) {
      multiplier = tier.multiplier;
      break;
    }
  }

  const rawPrice = (internalCost + buffer) * multiplier;
  const markup = rawPrice - (internalCost + buffer);
  const total = Math.max(Math.ceil(rawPrice * 100) / 100, MIN_PRICE_USD);

  return { scrapingCost, aiCost, chatbotFee, buffer, markup, total };
}

// ─── Extract structured data from messages ──────────────────────────────────
// Only adds tools to the panel when they have keywords (from suggestKeywords)
// or were explicitly added via addToolToProject. searchTools results are
// intentionally ignored — they're search results, not selected tools.

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

      // ── suggestKeywords: create/update tool with keywords + cost ────
      if (name === "suggestKeywords" && Array.isArray(out.keywords)) {
        const toolId = String(out.toolId ?? "");
        const toolName = String(out.toolName ?? toolId);
        if (!toolId) continue;

        if (!toolMap.has(toolId)) {
          toolMap.set(toolId, {
            toolId,
            name: toolName,
            healthStatus: "unknown",
            estimatedResults: 0,
            cost: 0,
            keywords: [],
            costPerKeyword: 0,
            config: {},
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

      // ── updateProjectConfig: update config + cost ──────────────────
      if (name === "updateProjectConfig" && out.ok === true) {
        const input = getToolInput(part);
        const toolId = input ? String(input.toolId ?? "") : "";
        if (toolId && toolMap.has(toolId)) {
          const tool = toolMap.get(toolId)!;
          if (input?.config && typeof input.config === "object") {
            tool.config = {
              ...tool.config,
              ...(input.config as Record<string, unknown>),
            };
          }
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
            config: {},
          });
        }
      }

      // ── suggestAIAnalysis: collect AI analyses ─────────────────────
      if (name === "suggestAIAnalysis" && Array.isArray(out.suggestions)) {
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

  // Calculate full price estimate with breakdown
  const scrapingCost = tools.reduce((sum, t) => sum + t.cost, 0);
  const totalItems = tools.reduce((sum, t) => sum + t.estimatedResults, 0);
  const priceEstimate = scrapingCost > 0
    ? estimatePrice(scrapingCost, aiAnalyses, totalItems)
    : { scrapingCost: 0, aiCost: 0, chatbotFee: 0, buffer: 0, markup: 0, total: 0 };

  return { tools, priceEstimate, aiAnalyses, redirectUrl };
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
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate>({
    scrapingCost: 0, aiCost: 0, chatbotFee: 0, buffer: 0, markup: 0, total: 0,
  });
  const [aiAnalyses, setAiAnalyses] = useState<PanelAIAnalysis[]>([]);
  const [redirected, setRedirected] = useState(false);

  const handleKeywordChange = useCallback(
    (toolId: string, keywords: string[]) => {
      setPanelTools((prev) =>
        prev.map((tool) => {
          if (tool.toolId !== toolId) return tool;
          return {
            ...tool,
            keywords,
            cost: keywords.length * tool.costPerKeyword,
            estimatedResults: keywords.length * 100,
          };
        })
      );
    },
    []
  );

  const handleConfigChange = useCallback(
    (toolId: string, config: Record<string, unknown>) => {
      setPanelTools((prev) =>
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

  // Extract panel data from messages
  useEffect(() => {
    const data = extractPanelData(messages);

    if (data.tools.length > 0) {
      setPanelTools(data.tools);
      setPriceEstimate(data.priceEstimate);
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

  // Recalculate price when tools or AI analyses change from user edits
  useEffect(() => {
    const scrapingCost = panelTools.reduce((sum, t) => sum + t.cost, 0);
    const totalItems = panelTools.reduce((sum, t) => sum + t.estimatedResults, 0);
    if (scrapingCost > 0) {
      setPriceEstimate(estimatePrice(scrapingCost, aiAnalyses, totalItems));
    } else {
      setPriceEstimate({ scrapingCost: 0, aiCost: 0, chatbotFee: 0, buffer: 0, markup: 0, total: 0 });
    }
  }, [panelTools, aiAnalyses]);

  const isDisabled =
    status === "streaming" ||
    status === "submitted" ||
    projectStatus === "completed";

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row lg:gap-4 p-4">
      <div className="flex flex-1 flex-col min-h-0 rounded-xl border bg-card overflow-hidden">
        <MessageList
          messages={messages}
          onKeywordSelectionChange={handleKeywordChange}
        />
        <ChatInput
          onSend={(text) => sendMessage({ text })}
          disabled={isDisabled}
        />
      </div>

      <div className="w-full shrink-0 lg:w-80 lg:overflow-y-auto mt-4 lg:mt-0">
        <ResearchConfigPanel
          projectId={projectId}
          locale={locale}
          tools={panelTools}
          aiAnalyses={aiAnalyses}
          priceEstimate={priceEstimate}
          onKeywordChange={handleKeywordChange}
          onConfigChange={handleConfigChange}
          onGoToCheckout={() => {
            router.push(`/${locale}/projects/${projectId}/checkout`);
          }}
          disabled={isDisabled}
        />
      </div>
    </div>
  );
}
