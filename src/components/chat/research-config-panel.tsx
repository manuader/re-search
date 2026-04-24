"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Locale } from "@/types";
import type { ToolSchema, ToolParam } from "@/lib/apify/tool-schema";
import { getAllParams } from "@/lib/apify/tool-schema";
import { ParamInput } from "./param-inputs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

interface ResearchConfigPanelProps {
  projectId: string;
  locale: Locale;
  tools: ConfiguredTool[];
  onConfigChange: (
    toolId: string,
    config: Record<string, unknown>
  ) => void;
  onRemoveTool?: (toolId: string) => void;
  totalCost: number;
  onStartResearch: () => void;
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

function loc(record: Record<string, string>, locale: string): string {
  return record[locale] ?? record.en ?? "";
}

function shouldShowParam(
  param: ToolParam,
  config: Record<string, unknown>,
  showAdvanced: boolean
): boolean {
  if (param.advanced && !showAdvanced) return false;
  if (param.dependsOn) {
    const depValue = config[param.dependsOn.paramId];
    if (!param.dependsOn.values.includes(depValue)) return false;
  }
  return true;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ResearchConfigPanel({
  projectId,
  locale,
  tools,
  onConfigChange,
  onRemoveTool,
  totalCost,
  onStartResearch,
  disabled,
}: ResearchConfigPanelProps) {
  const t = useTranslations("chat");
  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("researchbot_advanced_mode") === "true";
  });
  const [starting, setStarting] = useState(false);

  const toggleAdvanced = (value: boolean) => {
    setShowAdvanced(value);
    localStorage.setItem("researchbot_advanced_mode", String(value));
  };

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

  const hasEstimates = tools.some((tool) => tool.cost > 0);
  const hasSchemas = tools.some((tool) => tool.schema);

  return (
    <div className="flex flex-col gap-3">
      {/* Advanced mode toggle — only show if any tool has a schema */}
      {hasSchemas && (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label htmlFor="advanced-mode" className="text-xs cursor-pointer">
            {t("showAdvanced")}
          </Label>
          <Switch
            id="advanced-mode"
            checked={showAdvanced}
            onCheckedChange={toggleAdvanced}
          />
        </div>
      )}

      {/* Tool cards */}
      <Accordion defaultValue={tools.map((_, i) => i)}>
        {tools.map((tool) => (
          <ToolCard
            key={tool.toolId}
            tool={tool}
            locale={locale}
            projectId={projectId}
            showAdvanced={showAdvanced}
            onConfigChange={onConfigChange}
            onRemove={onRemoveTool}
          />
        ))}
      </Accordion>

      {/* Footer: total cost + start button */}
      <Card>
        <CardFooter className="flex flex-col gap-3 pt-4">
          <div className="flex w-full items-center justify-between">
            <span className="text-sm font-medium">{t("estimatedTotal")}</span>
            <span className="text-lg font-bold">
              {totalCost > 0 ? `$${totalCost.toFixed(2)}` : "—"}
            </span>
          </div>
          {hasEstimates && (
            <Button
              className="w-full"
              size="lg"
              disabled={disabled || starting || totalCost <= 0}
              onClick={() => {
                setStarting(true);
                onStartResearch();
              }}
            >
              {starting ? t("starting") : t("startResearch")}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── Tool Card ──────────────────────────────────────────────────────────────

interface ToolCardProps {
  tool: ConfiguredTool;
  locale: string;
  projectId: string;
  showAdvanced: boolean;
  onConfigChange: (toolId: string, config: Record<string, unknown>) => void;
  onRemove?: (toolId: string) => void;
}

function ToolCard({
  tool,
  locale,
  projectId,
  showAdvanced,
  onConfigChange,
  onRemove,
}: ToolCardProps) {
  const t = useTranslations("chat");
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(
    tool.config
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

  // Sync local config when tool config changes externally
  useEffect(() => {
    setLocalConfig(tool.config);
  }, [tool.config]);

  const handleParamChange = useCallback(
    (paramId: string, value: unknown) => {
      setLocalConfig((prev) => {
        const next = { ...prev, [paramId]: value };

        // Debounce the server call
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();

        debounceRef.current = setTimeout(() => {
          const controller = new AbortController();
          abortRef.current = controller;

          fetch(`/api/projects/${projectId}/config`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toolId: tool.toolId, config: next }),
            signal: controller.signal,
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.estimate) {
                onConfigChange(tool.toolId, next);
              }
            })
            .catch(() => {
              // Aborted or network error — ignore
            });
        }, 400);

        return next;
      });
    },
    [tool.toolId, projectId, onConfigChange]
  );

  // If the tool has no schema, render a simple summary card
  if (!tool.schema) {
    return (
      <AccordionItem value={tool.toolId}>
        <AccordionTrigger className="px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{tool.name}</span>
            <Badge
              variant={healthBadgeVariant(tool.healthStatus)}
              className="text-[10px]"
            >
              {tool.healthStatus}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {tool.estimatedResults > 0
                ? t("results", {
                    count: tool.estimatedResults.toLocaleString(),
                  })
                : t("configuring")}
            </span>
            <span className="font-medium">
              {tool.cost > 0 ? `$${tool.cost.toFixed(2)}` : "—"}
            </span>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  // Rich schema-based card
  const allParams = getAllParams(tool.schema);
  const visibleGroups = tool.schema.paramGroups
    .map((group) => ({
      ...group,
      visibleParams: group.params.filter((p) =>
        shouldShowParam(p, localConfig, showAdvanced)
      ),
    }))
    .filter((g) => g.visibleParams.length > 0);

  return (
    <AccordionItem value={tool.toolId}>
      <AccordionTrigger className="px-3 py-2 text-sm">
        <div className="flex w-full items-center justify-between pr-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{tool.name}</span>
            <Badge
              variant={healthBadgeVariant(tool.healthStatus)}
              className="text-[10px]"
            >
              {tool.healthStatus}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {tool.cost > 0 ? `$${tool.cost.toFixed(2)}` : ""}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-3">
        <div className="flex flex-col gap-4">
          {visibleGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {loc(group.label, locale)}
              </p>
              {group.visibleParams.map((param) => (
                <ParamInput
                  key={param.id}
                  param={param}
                  value={localConfig[param.id] ?? param.defaultValue}
                  onChange={(val) => handleParamChange(param.id, val)}
                  locale={locale}
                  disabled={false}
                />
              ))}
            </div>
          ))}

          {/* Tool footer */}
          <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
            <span>
              {tool.estimatedResults > 0
                ? t("results", {
                    count: tool.estimatedResults.toLocaleString(),
                  })
                : t("configuring")}
            </span>
            {onRemove && (
              <button
                type="button"
                className="text-destructive hover:underline"
                onClick={() => onRemove(tool.toolId)}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
