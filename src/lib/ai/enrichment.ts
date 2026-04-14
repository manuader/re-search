// ---------------------------------------------------------------------------
// AI Enrichment Module -- Anthropic Batch API client + prompt builder
// ---------------------------------------------------------------------------

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 256;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnalysisType =
  | "sentiment"
  | "classification"
  | "entities"
  | "summary"
  | "pain_points"
  | "spam_detection"
  | "custom";

export interface AnalysisConfig {
  categories?: string[];
  prompt?: string;
  [key: string]: unknown;
}

export interface EnrichmentItem {
  id: string;
  content: Record<string, unknown>;
}

interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: { role: "user"; content: string }[];
  };
}

export interface BatchStatus {
  id: string;
  processing_status: string;
  request_counts: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
  ended_at: string | null;
}

export interface BatchResultEntry {
  custom_id: string;
  result: {
    type: "succeeded" | "errored" | "canceled" | "expired";
    message?: {
      content: { type: string; text: string }[];
    };
    error?: { type: string; message: string };
  };
}

// ---------------------------------------------------------------------------
// 1. buildEnrichmentPrompt
// ---------------------------------------------------------------------------

const SYSTEM_PREAMBLE =
  "You are a data-analysis assistant. Follow the instruction precisely and respond with valid JSON only.";

const PROMPTS: Record<string, string> = {
  sentiment:
    'Classify the sentiment as positive, neutral, or negative. Also give a confidence score from 1-10. Respond with JSON only: {"sentiment": "positive|neutral|negative", "score": N}',
  classification:
    'Classify this into one of these categories: {categories}. Respond with JSON only: {"category": "..."}',
  entities:
    'Extract named entities (people, places, brands, organizations). Respond with JSON only: {"entities": [{"name": "...", "type": "..."}]}',
  summary:
    'Summarize in 1-2 sentences. Respond with JSON only: {"summary": "..."}',
  pain_points:
    'Identify specific problems, complaints, or pain points mentioned. Respond with JSON only: {"pain_points": ["..."]}',
  spam_detection:
    'Determine if this is genuine content or spam/bot-generated. Respond with JSON only: {"is_genuine": true|false, "confidence": N}',
};

export function buildEnrichmentPrompt(
  analysisType: AnalysisType,
  config: AnalysisConfig,
  item: EnrichmentItem
): { system: string; userMessage: string } {
  let instruction: string;

  if (analysisType === "custom") {
    instruction = `${config.prompt ?? "Analyze the following."} Respond with JSON only.`;
  } else if (analysisType === "classification" && config.categories) {
    instruction = PROMPTS.classification.replace(
      "{categories}",
      config.categories.join(", ")
    );
  } else {
    instruction = PROMPTS[analysisType];
  }

  const contentStr =
    typeof item.content === "string"
      ? item.content
      : JSON.stringify(item.content);

  return {
    system: `${SYSTEM_PREAMBLE}\n\n${instruction}`,
    userMessage: contentStr,
  };
}

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

async function anthropicFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${ANTHROPIC_API_URL}${path}`, {
    ...options,
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Anthropic API error ${res.status} on ${path}: ${body}`
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// 2. submitBatchAnalysis
// ---------------------------------------------------------------------------

export async function submitBatchAnalysis(
  analysisConfigId: string,
  projectId: string,
  items: EnrichmentItem[],
  analysisType: AnalysisType,
  config: AnalysisConfig
): Promise<string> {
  const requests: BatchRequest[] = items.map((item) => {
    const { system, userMessage } = buildEnrichmentPrompt(
      analysisType,
      config,
      item
    );

    return {
      custom_id: item.id,
      params: {
        model: HAIKU_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user" as const, content: userMessage }],
      },
    };
  });

  const batch = await anthropicFetch<{ id: string }>("/messages/batches", {
    method: "POST",
    body: JSON.stringify({ requests }),
  });

  return batch.id;
}

// ---------------------------------------------------------------------------
// 3. getBatchStatus
// ---------------------------------------------------------------------------

export async function getBatchStatus(
  batchId: string
): Promise<BatchStatus> {
  return anthropicFetch<BatchStatus>(`/messages/batches/${batchId}`);
}

// ---------------------------------------------------------------------------
// 4. getBatchResults
// ---------------------------------------------------------------------------

export async function getBatchResults(
  batchId: string
): Promise<BatchResultEntry[]> {
  // The results endpoint returns JSONL (one JSON object per line).
  const res = await fetch(
    `${ANTHROPIC_API_URL}/messages/batches/${batchId}/results`,
    {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Anthropic API error ${res.status} fetching batch results: ${body}`
    );
  }

  const text = await res.text();
  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  return lines.map((line) => JSON.parse(line) as BatchResultEntry);
}

// ---------------------------------------------------------------------------
// 5. parseBatchResult
// ---------------------------------------------------------------------------

export function parseBatchResult(
  resultText: string,
  _analysisType: AnalysisType
): Record<string, unknown> | null {
  try {
    // Claude may wrap JSON in markdown code fences -- strip them.
    const cleaned = resultText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed: unknown = JSON.parse(cleaned);

    if (parsed !== null && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }

    return null;
  } catch {
    return null;
  }
}
