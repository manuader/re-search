"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SelectedTool {
  name: string;
  healthStatus: string;
  estimatedResults: number;
  cost: number;
}

interface AIAnalysisConfig {
  type: string;
  description?: string;
}

interface CostCardProps {
  tools: SelectedTool[];
  totalCost: number;
  aiAnalysis?: AIAnalysisConfig[];
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

export function CostCard({ tools, totalCost, aiAnalysis }: CostCardProps) {
  if (tools.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tools.map((tool, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{tool.name}</span>
              <Badge variant={healthBadgeVariant(tool.healthStatus)}>
                {tool.healthStatus}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>~{tool.estimatedResults} results</span>
              <span>${tool.cost.toFixed(2)}</span>
            </div>
          </div>
        ))}

        {aiAnalysis && aiAnalysis.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">AI Analysis</span>
              {aiAnalysis.map((config, i) => (
                <span key={i} className="text-xs text-muted-foreground">
                  {config.description ?? config.type}
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-center justify-between">
          <span className="text-sm font-medium">Estimated Total</span>
          <span className="text-sm font-semibold">${totalCost.toFixed(2)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
