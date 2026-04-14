"use client";

import { Loader2, Check, X } from "lucide-react";

const toolLabels: Record<string, { loading: string; done: string }> = {
  searchTools: {
    loading: "Searching tools...",
    done: "Searched tools",
  },
  getToolConfig: {
    loading: "Loading configuration...",
    done: "Loaded configuration",
  },
  estimateCost: {
    loading: "Calculating costs...",
    done: "Calculated costs",
  },
  suggestKeywords: {
    loading: "Generating keywords...",
    done: "Generated keywords",
  },
  suggestAIAnalysis: {
    loading: "Analyzing options...",
    done: "Analyzed options",
  },
  executeResearch: {
    loading: "Executing research...",
    done: "Executed research",
  },
};

interface ToolStatusProps {
  toolName: string;
  state: string;
}

export function ToolStatus({ toolName, state }: ToolStatusProps) {
  const labels = toolLabels[toolName] ?? {
    loading: `Running ${toolName}...`,
    done: `Completed ${toolName}`,
  };

  if (state === "input-streaming" || state === "input-available") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span>{labels.loading}</span>
      </div>
    );
  }

  if (state === "output-available") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        <Check className="size-3 text-green-600" />
        <span>{labels.done}</span>
      </div>
    );
  }

  if (state === "output-error") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
        <X className="size-3" />
        <span>Error</span>
      </div>
    );
  }

  return null;
}
