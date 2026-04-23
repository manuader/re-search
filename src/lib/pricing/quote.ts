import { findToolById } from "@/lib/apify/catalog";
import type { PricingInput, PricingOutput, PricingBreakdown, ReportType, AnalysisType } from "./types";
import {
  MARKUP_TIERS,
  MIN_SAFETY_BUFFER_USD,
  SAFETY_BUFFER_PERCENT,
  MIN_PRICE_USD,
  MIN_PRICE_TO_COST_RATIO,
  AI_COST_PER_ANALYSIS,
  HAIKU_BATCH_INPUT_PER_MTOK,
  HAIKU_BATCH_OUTPUT_PER_MTOK,
  REPORT_COSTS,
  SONNET_INPUT_PER_MTOK,
  SONNET_OUTPUT_PER_MTOK,
} from "./constants";

/** Round up to the nearest cent. Never rounds down. */
function ceilToCent(usd: number): number {
  return Math.ceil(usd * 100) / 100;
}

/** Get the tiered markup multiplier for a given internal cost. */
export function getMarkupMultiplier(internalCost: number): number {
  for (const tier of MARKUP_TIERS) {
    if (internalCost < tier.maxCost) {
      return tier.multiplier;
    }
  }
  return MARKUP_TIERS[MARKUP_TIERS.length - 1].multiplier;
}

/** Calculate the cost of scraping for a single tool. Uses costPer1000.max for safety. */
function calcScrapingCost(toolId: string, estimatedResults: number): number {
  const tool = findToolById(toolId);
  if (!tool) return 0;
  return tool.pricing.costPer1000.max * (estimatedResults / 1000);
}

/** Calculate AI analysis cost for a single analysis type. */
function calcAiAnalysisCost(type: AnalysisType, estimatedItems: number): number {
  const spec = AI_COST_PER_ANALYSIS[type];
  if (!spec) return 0;

  const inputCost =
    (spec.inputTokensPerItem * estimatedItems * HAIKU_BATCH_INPUT_PER_MTOK) /
    1_000_000;
  const outputCost =
    (spec.outputTokensPerItem * estimatedItems * HAIKU_BATCH_OUTPUT_PER_MTOK) /
    1_000_000;

  return inputCost + outputCost;
}

/** Calculate report generation cost. */
function calcReportCost(reportType: ReportType): number {
  const spec = REPORT_COSTS[reportType];
  if (!spec || reportType === "none") return 0;

  const inputCost = (spec.inputTokens * SONNET_INPUT_PER_MTOK) / 1_000_000;
  const outputCost = (spec.outputTokens * SONNET_OUTPUT_PER_MTOK) / 1_000_000;

  return inputCost + outputCost;
}

/**
 * Calculate the full price for a research or report order.
 *
 * Pure, deterministic, no side effects.
 *
 * Invariants enforced:
 *  - price_charged >= internal_cost * 1.15
 *  - price_charged >= $1.50
 *  - All rounding goes UP to the nearest cent
 */
export function quotePricing(input: PricingInput): PricingOutput {
  const warnings: string[] = [];

  // ── Scraping costs ────────────────────────────────────────────────────
  const scrapingBreakdown = input.tools.map((t) => {
    const cost = calcScrapingCost(t.toolId, t.estimatedResults);
    if (cost === 0 && t.estimatedResults > 0) {
      warnings.push(`Tool "${t.toolId}" not found in catalog — cost estimated as $0`);
    }
    return { toolId: t.toolId, cost };
  });
  const totalScraping = scrapingBreakdown.reduce((s, b) => s + b.cost, 0);

  // ── AI analysis costs ─────────────────────────────────────────────────
  const aiBreakdown = input.aiAnalyses.map((a) => ({
    type: a.type,
    cost: calcAiAnalysisCost(a.type as AnalysisType, a.estimatedItems),
  }));
  const totalAi = aiBreakdown.reduce((s, b) => s + b.cost, 0);

  // ── Report cost ───────────────────────────────────────────────────────
  const reportCost = calcReportCost(input.reportType);

  // ── Chatbot cost ──────────────────────────────────────────────────────
  const chatbotCost = input.chatbotCostUsd;

  // ── Internal cost ─────────────────────────────────────────────────────
  const internalCostUsd = totalScraping + totalAi + reportCost + chatbotCost;

  // ── Safety buffer ─────────────────────────────────────────────────────
  const safetyBufferUsd = Math.max(
    MIN_SAFETY_BUFFER_USD,
    internalCostUsd * SAFETY_BUFFER_PERCENT
  );

  // ── Markup ────────────────────────────────────────────────────────────
  const markupMultiplier = getMarkupMultiplier(internalCostUsd);
  const rawPrice = (internalCostUsd + safetyBufferUsd) * markupMultiplier;
  const markupAmount = rawPrice - (internalCostUsd + safetyBufferUsd);

  // ── Enforce invariants ────────────────────────────────────────────────
  let priceChargedUsd = ceilToCent(rawPrice);

  // Invariant 1: price >= internal_cost * 1.15
  const minRatioPrice = ceilToCent(internalCostUsd * MIN_PRICE_TO_COST_RATIO);
  if (priceChargedUsd < minRatioPrice) {
    priceChargedUsd = minRatioPrice;
    warnings.push(
      `Price elevated to $${priceChargedUsd} to enforce ${MIN_PRICE_TO_COST_RATIO}x cost ratio`
    );
  }

  // Invariant 2: price >= minimum floor
  if (priceChargedUsd < MIN_PRICE_USD) {
    warnings.push(
      `Price elevated from $${priceChargedUsd.toFixed(2)} to minimum $${MIN_PRICE_USD.toFixed(2)}`
    );
    priceChargedUsd = MIN_PRICE_USD;
  }

  const breakdown: PricingBreakdown = {
    scraping: scrapingBreakdown,
    aiAnalysis: aiBreakdown,
    report: reportCost,
    chatbot: chatbotCost,
    buffer: safetyBufferUsd,
    markupAmount,
  };

  return {
    internalCostUsd,
    safetyBufferUsd,
    markupMultiplier,
    priceChargedUsd,
    breakdown,
    warnings,
  };
}
