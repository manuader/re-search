"use client";

import { useState, useCallback } from "react";
import type { Locale } from "@/types";
import type { PanelTool, PanelAIAnalysis, PriceEstimate } from "./chat-interface";
import { getToolSchema } from "@/lib/apify/schemas";
import { getChatbotParams } from "@/lib/apify/tool-schema";
import { ParamInput } from "./param-inputs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";
import { X, Plus, Brain, ChevronDown, ChevronUp } from "lucide-react";

// ─── Props ──────────────────────────────────────────────────────────────────

interface ResearchConfigPanelProps {
  projectId: string;
  locale: Locale;
  tools: PanelTool[];
  aiAnalyses: PanelAIAnalysis[];
  priceEstimate: PriceEstimate;
  onKeywordChange: (toolId: string, keywords: string[]) => void;
  onConfigChange: (toolId: string, config: Record<string, unknown>) => void;
  onGoToCheckout: () => void;
  disabled: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function healthBadgeVariant(status: string) {
  switch (status) {
    case "healthy":
      return "default" as const;
    case "degraded":
      return "secondary" as const;
    case "down":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

const AI_LABELS: Record<string, Record<string, string>> = {
  sentiment: { en: "Sentiment", es: "Sentimiento" },
  classification: { en: "Classification", es: "Clasificacion" },
  pain_points: { en: "Pain Points", es: "Puntos de dolor" },
  summary: { en: "Summary", es: "Resumen" },
};

// ─── Main Component ─────────────────────────────────────────────────────────

export function ResearchConfigPanel({
  projectId,
  locale,
  tools,
  aiAnalyses,
  priceEstimate,
  onKeywordChange,
  onConfigChange,
  onGoToCheckout,
  disabled,
}: ResearchConfigPanelProps) {
  const t = useTranslations("chat");

  if (tools.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground text-center">
            {t("emptyState")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("summary")}</CardTitle>
        </CardHeader>
      </Card>

      {/* Tool cards */}
      {tools.map((tool) => (
        <ToolCard
          key={tool.toolId}
          tool={tool}
          locale={locale}
          projectId={projectId}
          onKeywordChange={onKeywordChange}
          onConfigChange={onConfigChange}
        />
      ))}

      {/* AI Analysis */}
      {aiAnalyses.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">
                {locale === "es" ? "Analisis IA" : "AI Analysis"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5 pb-3">
            {aiAnalyses.map((a) => (
              <Badge key={a.type} variant="secondary" className="text-xs">
                {AI_LABELS[a.type]?.[locale] ??
                  AI_LABELS[a.type]?.en ??
                  a.type}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Price breakdown + checkout */}
      <Card>
        <CardContent className="pb-0 pt-4 space-y-1">
          {/* Scraping costs per tool */}
          {tools.map((tool) => (
            <div
              key={tool.toolId}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-muted-foreground truncate max-w-[60%]">
                {tool.name}
              </span>
              <span className="font-medium">
                {tool.cost > 0 ? `$${tool.cost.toFixed(2)}` : "—"}
              </span>
            </div>
          ))}

          {/* AI analysis cost */}
          {priceEstimate.aiCost > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {locale === "es" ? "Analisis IA" : "AI Analysis"}
              </span>
              <span className="font-medium">${priceEstimate.aiCost.toFixed(2)}</span>
            </div>
          )}

          {/* Chatbot fee */}
          {priceEstimate.chatbotFee > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {locale === "es" ? "Planificacion" : "Planning"}
              </span>
              <span className="font-medium">${priceEstimate.chatbotFee.toFixed(2)}</span>
            </div>
          )}

          {/* Buffer */}
          {priceEstimate.buffer > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {locale === "es" ? "Margen de seguridad" : "Safety buffer"}
              </span>
              <span className="font-medium">${priceEstimate.buffer.toFixed(2)}</span>
            </div>
          )}

          {/* Markup */}
          {priceEstimate.markup > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {locale === "es" ? "Tarifa de servicio" : "Service fee"}
              </span>
              <span className="font-medium">${priceEstimate.markup.toFixed(2)}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-3 border-t">
          <div className="flex w-full items-center justify-between">
            <span className="text-sm font-medium">{t("estimatedTotal")}</span>
            <span className="text-lg font-bold">
              {priceEstimate.total > 0 ? `~$${priceEstimate.total.toFixed(2)}` : "—"}
            </span>
          </div>
          {priceEstimate.total > 0 && (
            <Button
              className="w-full"
              size="lg"
              disabled={disabled}
              onClick={onGoToCheckout}
            >
              {locale === "es" ? "Ir al checkout" : "Go to Checkout"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── Tool Card ──────────────────────────────────────────────────────────────

interface ToolCardProps {
  tool: PanelTool;
  locale: string;
  projectId: string;
  onKeywordChange: (toolId: string, keywords: string[]) => void;
  onConfigChange: (toolId: string, config: Record<string, unknown>) => void;
}

function ToolCard({
  tool,
  locale,
  projectId,
  onKeywordChange,
  onConfigChange,
}: ToolCardProps) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  // Load schema for parameter controls
  const schema = getToolSchema(tool.toolId);
  const schemaParams = schema ? getChatbotParams(schema) : [];
  // Filter out keyword_list params (shown separately above)
  const editableParams = schemaParams.filter((p) => p.kind !== "keyword_list");

  const addKeyword = useCallback(() => {
    const trimmed = newKeyword.trim();
    if (!trimmed || tool.keywords.includes(trimmed)) return;
    onKeywordChange(tool.toolId, [...tool.keywords, trimmed]);
    setNewKeyword("");
  }, [newKeyword, tool.toolId, tool.keywords, onKeywordChange]);

  const removeKeyword = useCallback(
    (keyword: string) => {
      onKeywordChange(
        tool.toolId,
        tool.keywords.filter((k) => k !== keyword)
      );
    },
    [tool.toolId, tool.keywords, onKeywordChange]
  );

  const startEdit = useCallback((index: number, value: string) => {
    setEditingIndex(index);
    setEditValue(value);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      const updated = tool.keywords.filter((_, i) => i !== editingIndex);
      onKeywordChange(tool.toolId, updated);
    } else {
      const updated = [...tool.keywords];
      updated[editingIndex] = trimmed;
      onKeywordChange(tool.toolId, updated);
    }
    setEditingIndex(null);
    setEditValue("");
  }, [editingIndex, editValue, tool.toolId, tool.keywords, onKeywordChange]);

  const handleParamChange = useCallback(
    (paramId: string, value: unknown) => {
      const newConfig = { ...tool.config, [paramId]: value };
      onConfigChange(tool.toolId, newConfig);
    },
    [tool.toolId, tool.config, onConfigChange]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          type="button"
          className="flex w-full items-center justify-between"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{tool.name}</span>
            <Badge
              variant={healthBadgeVariant(tool.healthStatus)}
              className="text-[10px]"
            >
              {tool.healthStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              {tool.cost > 0 ? `$${tool.cost.toFixed(2)}` : ""}
            </span>
            {expanded ? (
              <ChevronUp className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            )}
          </div>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="pb-3 space-y-3">
          {/* Keywords section */}
          {tool.keywords.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Keywords
              </p>
              <div className="flex flex-wrap gap-1">
                {tool.keywords.map((kw, i) =>
                  editingIndex === i ? (
                    <Input
                      key={`edit-${i}`}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                        if (e.key === "Escape") setEditingIndex(null);
                      }}
                      autoFocus
                      className="h-6 w-32 text-[11px] px-1.5"
                    />
                  ) : (
                    <Badge
                      key={kw}
                      variant="outline"
                      className="text-[11px] gap-1 cursor-pointer hover:bg-muted pr-1"
                      onClick={() => startEdit(i, kw)}
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeKeyword(kw); }}
                        className="hover:text-destructive"
                      >
                        <X className="size-2.5" />
                      </button>
                    </Badge>
                  )
                )}
              </div>
              <div className="flex items-center gap-1">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder={locale === "es" ? "Agregar keyword..." : "Add keyword..."}
                  className="h-6 text-[11px] flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={addKeyword}
                  disabled={!newKeyword.trim()}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Schema parameter controls */}
          {editableParams.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {locale === "es" ? "Configuracion" : "Configuration"}
                </p>
                {editableParams.map((param) => (
                  <ParamInput
                    key={param.id}
                    param={param}
                    value={tool.config[param.id] ?? param.defaultValue}
                    onChange={(val) => handleParamChange(param.id, val)}
                    locale={locale}
                  />
                ))}
              </div>
            </>
          )}

          {/* Results estimate */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            <span>
              {tool.estimatedResults > 0
                ? t("results", { count: tool.estimatedResults.toLocaleString() })
                : t("configuring")}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
