"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface SelectedTool {
  toolId?: string;
  name: string;
  healthStatus: string;
  estimatedResults: number;
  cost: number;
}

interface CostCardProps {
  tools: SelectedTool[];
  totalCost: number;
  onStartResearch?: () => void;
  disabled?: boolean;
}

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

export function CostCard({ tools, totalCost, onStartResearch, disabled }: CostCardProps) {
  const [starting, setStarting] = useState(false);

  if (tools.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground text-center">
            Describe your research goal and I&apos;ll suggest tools with cost estimates
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasEstimates = tools.some((t) => t.cost > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Research Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tools.map((tool, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{tool.name}</span>
              <Badge variant={healthBadgeVariant(tool.healthStatus)} className="text-[10px]">
                {tool.healthStatus}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {tool.estimatedResults > 0
                  ? `~${tool.estimatedResults.toLocaleString()} results`
                  : "Configuring..."}
              </span>
              <span className="font-medium">
                {tool.cost > 0 ? `$${tool.cost.toFixed(2)}` : "—"}
              </span>
            </div>
          </div>
        ))}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 pt-3 border-t">
        <div className="flex w-full items-center justify-between">
          <span className="text-sm font-medium">Estimated Total</span>
          <span className="text-lg font-bold">
            {totalCost > 0 ? `$${totalCost.toFixed(2)}` : "—"}
          </span>
        </div>

        {hasEstimates && onStartResearch && (
          <Button
            className="w-full"
            size="lg"
            disabled={disabled || starting || totalCost <= 0}
            onClick={async () => {
              setStarting(true);
              onStartResearch();
            }}
          >
            {starting ? "Starting..." : "Start Research"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
