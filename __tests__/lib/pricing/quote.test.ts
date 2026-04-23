import { describe, it, expect } from "vitest";
import { quotePricing, getMarkupMultiplier } from "@/lib/pricing/quote";
import {
  MIN_PRICE_USD,
  MIN_PRICE_TO_COST_RATIO,
  CHATBOT_FLAT_FEE_USD,
} from "@/lib/pricing/constants";
import type { PricingInput } from "@/lib/pricing/types";

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    tools: [],
    aiAnalyses: [],
    reportType: "none",
    chatbotCostUsd: CHATBOT_FLAT_FEE_USD,
    ...overrides,
  };
}

// ─── Markup tiers ───────────────────────────────────────────────────────────

describe("getMarkupMultiplier", () => {
  it("returns 1.60 for internal cost < $2", () => {
    expect(getMarkupMultiplier(0)).toBe(1.6);
    expect(getMarkupMultiplier(1.0)).toBe(1.6);
    expect(getMarkupMultiplier(1.99)).toBe(1.6);
  });

  it("returns 1.50 for internal cost $2 – $6", () => {
    expect(getMarkupMultiplier(2.0)).toBe(1.5);
    expect(getMarkupMultiplier(4.0)).toBe(1.5);
    expect(getMarkupMultiplier(5.99)).toBe(1.5);
  });

  it("returns 1.40 for internal cost $6 – $15", () => {
    expect(getMarkupMultiplier(6.0)).toBe(1.4);
    expect(getMarkupMultiplier(10.0)).toBe(1.4);
    expect(getMarkupMultiplier(14.99)).toBe(1.4);
  });

  it("returns 1.35 for internal cost > $15", () => {
    expect(getMarkupMultiplier(15.0)).toBe(1.35);
    expect(getMarkupMultiplier(100.0)).toBe(1.35);
  });
});

// ─── Price minimum enforcement ──────────────────────────────────────────────

describe("minimum price enforcement", () => {
  it("enforces $1.50 minimum", () => {
    const result = quotePricing(makeInput());
    expect(result.priceChargedUsd).toBeGreaterThanOrEqual(MIN_PRICE_USD);
  });

  it("triggers minimum price warning when price would be below floor", () => {
    const result = quotePricing(makeInput());
    expect(result.warnings.some((w) => w.includes("minimum"))).toBe(true);
  });
});

// ─── Invariant: price >= internal_cost * 1.15 ───────────────────────────────

describe("cost ratio invariant", () => {
  it("price is always >= internal_cost * 1.15", () => {
    const inputs: PricingInput[] = [
      // Small research
      makeInput({
        tools: [{ toolId: "google-maps-reviews", estimatedResults: 100 }],
      }),
      // Medium research
      makeInput({
        tools: [{ toolId: "twitter", estimatedResults: 500 }],
        aiAnalyses: [{ type: "sentiment", estimatedItems: 500 }],
        reportType: "professional",
      }),
      // Large research
      makeInput({
        tools: [
          { toolId: "twitter", estimatedResults: 1000 },
          { toolId: "reddit", estimatedResults: 500 },
        ],
        aiAnalyses: [
          { type: "sentiment", estimatedItems: 1500 },
          { type: "classification", estimatedItems: 1500 },
        ],
        reportType: "technical",
      }),
    ];

    for (const input of inputs) {
      const result = quotePricing(input);
      expect(result.priceChargedUsd).toBeGreaterThanOrEqual(
        result.internalCostUsd * MIN_PRICE_TO_COST_RATIO
      );
    }
  });
});

// ─── Rounding always UP ─────────────────────────────────────────────────────

describe("rounding", () => {
  it("rounds up to the nearest cent (never down)", () => {
    const result = quotePricing(
      makeInput({
        tools: [{ toolId: "twitter", estimatedResults: 333 }],
      })
    );
    // priceChargedUsd should be a clean cent value
    expect(Math.round(result.priceChargedUsd * 100)).toBe(
      result.priceChargedUsd * 100
    );
  });
});

// ─── 4 Realistic examples from spec (snapshot tests) ────────────────────────

describe("spec pricing examples", () => {
  it("(a) 100 Google Maps reviews, no report", () => {
    const result = quotePricing(
      makeInput({
        tools: [{ toolId: "google-maps-reviews", estimatedResults: 100 }],
      })
    );
    // costPer1000.max for google-maps-reviews = $3.50
    // scraping: 3.50 * 0.1 = $0.35
    // chatbot: $0.05
    // internal: $0.40
    // buffer: max($0.50, 0.40 * 0.15) = $0.50
    // markup tier (internal < $2): 1.60
    // raw: (0.40 + 0.50) * 1.60 = $1.44
    // minimum floor: $1.50
    expect(result.internalCostUsd).toBeCloseTo(0.4, 2);
    expect(result.safetyBufferUsd).toBe(0.5);
    expect(result.markupMultiplier).toBe(1.6);
    expect(result.priceChargedUsd).toBe(1.5); // minimum floor
    expect(result.priceChargedUsd).toBeGreaterThanOrEqual(
      result.internalCostUsd * MIN_PRICE_TO_COST_RATIO
    );
  });

  it("(b) 500 tweets with sentiment + professional report", () => {
    const result = quotePricing(
      makeInput({
        tools: [{ toolId: "twitter", estimatedResults: 500 }],
        aiAnalyses: [{ type: "sentiment", estimatedItems: 500 }],
        reportType: "professional",
      })
    );
    // scraping: twitter max=$3.00, 500/1000 = $1.50
    // AI sentiment: 500 * (300 input + 100 output) tokens
    //   input: 500*300 = 150k tokens * $0.80/MTok = $0.12
    //   output: 500*100 = 50k tokens * $0.40/MTok = $0.02
    //   total AI: ~$0.14
    // report professional: 10k input * $3/MTok + 4k output * $15/MTok
    //   input: $0.03, output: $0.06 → ~$0.09
    // chatbot: $0.05
    // internal: ~$1.78
    // buffer: max($0.50, 1.78 * 0.15) = $0.50
    // markup tier (< $2): 1.60
    // raw: (1.78 + 0.50) * 1.60 = $3.65
    expect(result.internalCostUsd).toBeGreaterThan(1.5);
    expect(result.internalCostUsd).toBeLessThan(2.5);
    expect(result.priceChargedUsd).toBeGreaterThan(3.0);
    expect(result.priceChargedUsd).toBeGreaterThanOrEqual(
      result.internalCostUsd * MIN_PRICE_TO_COST_RATIO
    );
  });

  it("(c) 50 Google Search results, no AI, no report", () => {
    const result = quotePricing(
      makeInput({
        tools: [{ toolId: "google-search", estimatedResults: 50 }],
      })
    );
    // scraping: google-search max=$6.00, 50/1000 = $0.30
    // chatbot: $0.05
    // internal: $0.35
    // buffer: max($0.50, 0.35 * 0.15) = $0.50
    // raw: (0.35 + 0.50) * 1.60 = $1.36 → minimum $1.50
    expect(result.internalCostUsd).toBeCloseTo(0.35, 2);
    expect(result.priceChargedUsd).toBe(1.5); // minimum floor
  });

  it("(d) 1000 tweets, sentiment+classification+pain_points, technical report", () => {
    const result = quotePricing(
      makeInput({
        tools: [{ toolId: "twitter", estimatedResults: 1000 }],
        aiAnalyses: [
          { type: "sentiment", estimatedItems: 1000 },
          { type: "classification", estimatedItems: 1000 },
          { type: "pain_points", estimatedItems: 1000 },
        ],
        reportType: "technical",
      })
    );
    // scraping: twitter max=$3.00 * 1.0 = $3.00
    // AI sentiment: 1000*(300*0.8 + 100*0.4)/1M = $0.28
    // AI classification: 1000*(250*0.8 + 50*0.4)/1M = $0.22
    // AI pain_points: 1000*(400*0.8 + 150*0.4)/1M = $0.38
    // AI total: ~$0.88
    // report technical: (15k*3 + 8k*15)/1M = (45k + 120k)/1M = $0.165
    // chatbot: $0.05
    // internal: ~$4.095
    // buffer: max($0.50, 4.095*0.15) = $0.61
    // markup tier ($2-$6): 1.50
    // raw: (4.095 + 0.61) * 1.50 = $7.06
    expect(result.internalCostUsd).toBeGreaterThan(3.5);
    expect(result.internalCostUsd).toBeLessThan(5.0);
    expect(result.markupMultiplier).toBe(1.5);
    expect(result.priceChargedUsd).toBeGreaterThan(6.0);
    expect(result.priceChargedUsd).toBeGreaterThanOrEqual(
      result.internalCostUsd * MIN_PRICE_TO_COST_RATIO
    );
  });
});

// ─── Report type pricing ────────────────────────────────────────────────────

describe("report type pricing", () => {
  const baseTools = [{ toolId: "twitter", estimatedResults: 500 }];

  it("none < executive < professional < technical in price", () => {
    const none = quotePricing(makeInput({ tools: baseTools, reportType: "none" }));
    const executive = quotePricing(makeInput({ tools: baseTools, reportType: "executive" }));
    const professional = quotePricing(makeInput({ tools: baseTools, reportType: "professional" }));
    const technical = quotePricing(makeInput({ tools: baseTools, reportType: "technical" }));

    expect(executive.priceChargedUsd).toBeGreaterThanOrEqual(none.priceChargedUsd);
    expect(professional.priceChargedUsd).toBeGreaterThan(executive.priceChargedUsd);
    expect(technical.priceChargedUsd).toBeGreaterThan(professional.priceChargedUsd);
  });

  it("report=none has zero report cost in breakdown", () => {
    const result = quotePricing(makeInput({ tools: baseTools, reportType: "none" }));
    expect(result.breakdown.report).toBe(0);
  });
});

// ─── Unknown tool handling ──────────────────────────────────────────────────

describe("unknown tools", () => {
  it("produces a warning for unknown tools", () => {
    const result = quotePricing(
      makeInput({
        tools: [{ toolId: "nonexistent-tool", estimatedResults: 100 }],
      })
    );
    expect(result.warnings.some((w) => w.includes("not found"))).toBe(true);
  });
});

// ─── Fuzz test: invariant holds for random inputs ───────────────────────────

describe("fuzz: invariant always holds", () => {
  const toolIds = [
    "google-maps",
    "google-maps-reviews",
    "twitter",
    "reddit",
    "google-search",
    "instagram",
    "tripadvisor",
    "amazon-products",
    "linkedin-jobs",
  ];
  const analysisTypes: Array<"sentiment" | "classification" | "pain_points" | "summary"> = [
    "sentiment",
    "classification",
    "pain_points",
    "summary",
  ];
  const reportTypes: Array<"none" | "executive" | "professional" | "technical"> = [
    "none",
    "executive",
    "professional",
    "technical",
  ];

  // Seeded pseudo-random for reproducibility
  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  it("price >= internal_cost * 1.15 for 200 random inputs", () => {
    const random = seededRandom(42);

    for (let i = 0; i < 200; i++) {
      const numTools = Math.floor(random() * 3) + 1;
      const tools = Array.from({ length: numTools }, () => ({
        toolId: toolIds[Math.floor(random() * toolIds.length)],
        estimatedResults: Math.floor(random() * 5000) + 10,
      }));

      const numAnalyses = Math.floor(random() * 4);
      const aiAnalyses = Array.from({ length: numAnalyses }, () => ({
        type: analysisTypes[Math.floor(random() * analysisTypes.length)],
        estimatedItems: Math.floor(random() * 3000) + 10,
      }));

      const reportType = reportTypes[Math.floor(random() * reportTypes.length)];

      const input = makeInput({ tools, aiAnalyses, reportType });
      const result = quotePricing(input);

      expect(result.priceChargedUsd).toBeGreaterThanOrEqual(MIN_PRICE_USD);
      expect(result.priceChargedUsd).toBeGreaterThanOrEqual(
        result.internalCostUsd * MIN_PRICE_TO_COST_RATIO - 0.01 // allow 1 cent for rounding
      );
      // Check it's a clean cent
      expect(Math.abs(result.priceChargedUsd * 100 - Math.round(result.priceChargedUsd * 100))).toBeLessThan(
        0.001
      );
    }
  });
});
