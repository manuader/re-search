export type Locale = "en" | "es";

export type ToolCategory =
  | "maps"
  | "social"
  | "search"
  | "ecommerce"
  | "travel"
  | "reviews"
  | "professional";

export type ToolFieldType = "string" | "number" | "boolean" | "string[]";

export interface ToolField {
  key: string;
  type: ToolFieldType;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
  required: boolean;
  default?: string | number | boolean | string[];
  userFacing: boolean;
  min?: number;
  max?: number;
}

export interface ToolPricing {
  model: "per-result" | "per-run" | "per-page";
  costPer1000: { min: number; max: number };
  freeResultsIncluded?: number;
}

export interface ToolHealthCheck {
  input: Record<string, unknown>;
  expectedMinResults: number;
  maxDurationSeconds: number;
}

export interface ToolValidation {
  requiredFields: string[];
  uniqueKey?: string;
}

export interface ToolCatalogEntry {
  id: string;
  actorId: string;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  category: ToolCategory;
  useCases: string[];
  inputSchema: {
    fields: ToolField[];
    defaults: Record<string, unknown>;
  };
  outputFields: string[];
  pricing: ToolPricing;
  healthCheck: ToolHealthCheck;
  validation: ToolValidation;
  pairsWellWith: string[];
  maintainer: string;
}

export interface CostEstimate {
  min: number;
  max: number;
  expected: number;
  breakdown: string;
}

export interface ToolSearchResult {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  healthStatus: string;
  costPer1000: { min: number; max: number };
  pairsWellWith: string[];
}

export interface ToolConfigResult {
  toolId: string;
  toolName: string;
  fields: {
    key: string;
    label: string;
    description: string;
    type: ToolFieldType;
    required: boolean;
    default?: string | number | boolean | string[];
    min?: number;
    max?: number;
  }[];
  defaults: Record<string, unknown>;
}
