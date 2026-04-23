export type ReportType = "none" | "executive" | "professional" | "technical";

export type AnalysisType =
  | "sentiment"
  | "classification"
  | "pain_points"
  | "summary";

export interface PricingToolInput {
  toolId: string;
  estimatedResults: number;
}

export interface PricingAnalysisInput {
  type: AnalysisType;
  estimatedItems: number;
}

export interface PricingInput {
  tools: PricingToolInput[];
  aiAnalyses: PricingAnalysisInput[];
  reportType: ReportType;
  chatbotCostUsd: number;
}

export interface PricingBreakdown {
  scraping: Array<{ toolId: string; cost: number }>;
  aiAnalysis: Array<{ type: string; cost: number }>;
  report: number;
  chatbot: number;
  buffer: number;
  markupAmount: number;
}

export interface PricingOutput {
  internalCostUsd: number;
  safetyBufferUsd: number;
  markupMultiplier: number;
  priceChargedUsd: number;
  breakdown: PricingBreakdown;
  warnings: string[];
}
