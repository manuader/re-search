"use client";

import { Loader2, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

const toolKeyMap: Record<string, { loading: string; done: string }> = {
  searchTools: { loading: "toolStatus.searchingTools", done: "toolStatus.searchedTools" },
  getToolConfig: { loading: "toolStatus.loadingConfig", done: "toolStatus.loadedConfig" },
  getToolSchema: { loading: "toolStatus.loadingSchema", done: "toolStatus.loadedSchema" },
  estimateCost: { loading: "toolStatus.calculatingCosts", done: "toolStatus.calculatedCosts" },
  suggestKeywords: { loading: "toolStatus.generatingKeywords", done: "toolStatus.generatedKeywords" },
  suggestAIAnalysis: { loading: "toolStatus.analyzingOptions", done: "toolStatus.analyzedOptions" },
  updateProjectConfig: { loading: "toolStatus.updatingConfig", done: "toolStatus.updatedConfig" },
  addToolToProject: { loading: "toolStatus.addingTool", done: "toolStatus.addedTool" },
  executeResearch: { loading: "toolStatus.executingResearch", done: "toolStatus.executedResearch" },
};

interface ToolStatusProps {
  toolName: string;
  state: string;
}

export function ToolStatus({ toolName, state }: ToolStatusProps) {
  const t = useTranslations("chat");

  const keys = toolKeyMap[toolName];
  const loadingLabel = keys
    ? t(keys.loading)
    : t("toolStatus.running", { tool: toolName });
  const doneLabel = keys
    ? t(keys.done)
    : t("toolStatus.completed", { tool: toolName });

  if (state === "input-streaming" || state === "input-available") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span>{loadingLabel}</span>
      </div>
    );
  }

  if (state === "output-available") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        <Check className="size-3 text-green-600" />
        <span>{doneLabel}</span>
      </div>
    );
  }

  if (state === "output-error") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
        <X className="size-3" />
        <span>{t("toolStatus.error")}</span>
      </div>
    );
  }

  return null;
}
