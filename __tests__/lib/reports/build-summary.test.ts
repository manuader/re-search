import { describe, it, expect } from "vitest";
import { buildDatasetSummary, detectRequestedFields } from "@/lib/reports/build-summary";
import type { BuildSummaryInput, RawDataItem } from "@/lib/reports/types";

function makeTweet(
  id: string,
  likes: number,
  retweets: number,
  opts?: { sentiment?: string; category?: string; date?: string }
): RawDataItem {
  return {
    id,
    content: {
      text: `This is tweet ${id} with some content for testing purposes. #test`,
      likeCount: likes,
      retweetCount: retweets,
      replyCount: Math.floor(likes / 5),
      authorUsername: `user_${id}`,
      createdAt: opts?.date ?? "2024-06-15T12:00:00Z",
      url: `https://x.com/user/status/${id}`,
    },
    ai_fields: opts?.sentiment
      ? {
          sentiment: opts.sentiment,
          ...(opts.category ? { category: opts.category } : {}),
        }
      : null,
    created_at: opts?.date ?? "2024-06-15T12:00:00Z",
  };
}

function makeInput(
  items: RawDataItem[],
  opts?: Partial<BuildSummaryInput>
): BuildSummaryInput {
  return {
    items,
    source: opts?.source ?? "twitter",
    userBrief:
      opts?.userBrief ??
      "Analyze public opinion about technology trends on Twitter",
    enrichments: opts?.enrichments ?? {
      sentiment: false,
      categories: false,
      painPoints: false,
      demographics: false,
      geo: false,
      topics: false,
    },
    locale: opts?.locale ?? "en",
  };
}

describe("buildDatasetSummary", () => {
  it("throws for N=0", () => {
    expect(() => buildDatasetSummary(makeInput([]))).toThrow("No data");
  });

  it("works for N=1", () => {
    const items = [makeTweet("1", 10, 2)];
    const summary = buildDatasetSummary(makeInput(items));
    expect(summary.meta.totalItems).toBe(1);
    expect(summary.engagement.mean).toBeGreaterThanOrEqual(0);
    expect(summary.meta.limitations.length).toBeGreaterThan(0);
  });

  it("works for N=5 with limitation flag", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeTweet(`${i}`, i * 10, i * 3)
    );
    const summary = buildDatasetSummary(makeInput(items));
    expect(summary.meta.totalItems).toBe(5);
    expect(summary.meta.limitations.some((l) => l.includes("small"))).toBe(true);
  });

  it("works for N=30 (all items in sample)", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeTweet(`${i}`, (i + 1) * 5, i * 2)
    );
    const summary = buildDatasetSummary(makeInput(items));
    expect(summary.meta.totalItems).toBe(30);
    expect(summary.representativeSample.length).toBe(30);
  });

  it("correctly sizes sample for N=200", () => {
    const items = Array.from({ length: 200 }, (_, i) =>
      makeTweet(`${i}`, Math.floor(Math.random() * 1000), Math.floor(Math.random() * 100))
    );
    const summary = buildDatasetSummary(makeInput(items));
    expect(summary.meta.totalItems).toBe(200);
    expect(summary.representativeSample.length).toBe(50); // 150 < 200 <= 1000 → 50
  });

  it("omits sentiment when enrichment not present", () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      makeTweet(`${i}`, i * 10, i)
    );
    const summary = buildDatasetSummary(makeInput(items));
    expect(summary.sentiment).toBeNull();
  });

  it("includes sentiment stats when enrichment present", () => {
    const sentiments = ["positive", "neutral", "negative"];
    const items = Array.from({ length: 50 }, (_, i) =>
      makeTweet(`${i}`, i * 10, i, { sentiment: sentiments[i % 3] })
    );
    const summary = buildDatasetSummary(
      makeInput(items, {
        enrichments: {
          sentiment: true,
          categories: false,
          painPoints: false,
          demographics: false,
          geo: false,
          topics: false,
        },
      })
    );
    expect(summary.sentiment).not.toBeNull();
    expect(summary.sentiment!.unweighted.distribution.length).toBeGreaterThan(0);
  });

  it("computes gini=0 when all engagement is equal", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeTweet(`${i}`, 50, 10)
    );
    const summary = buildDatasetSummary(makeInput(items));
    expect(summary.engagement.giniCoefficient).toBe(0);
  });

  it("includes temporal stats when dates are present", () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      makeTweet(`${i}`, i * 10, i, {
        date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString(),
      })
    );
    const summary = buildDatasetSummary(makeInput(items));
    expect(summary.temporal).not.toBeNull();
    expect(summary.temporal!.series.length).toBeGreaterThan(0);
  });

  it("includes text patterns", () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      makeTweet(`${i}`, i * 10, i)
    );
    const summary = buildDatasetSummary(makeInput(items));
    expect(summary.textPatterns).not.toBeNull();
    expect(summary.textPatterns!.topKeywords.length).toBeGreaterThan(0);
  });

  it("has no duplicate items in sample", () => {
    const items = Array.from({ length: 200 }, (_, i) =>
      makeTweet(`${i}`, Math.floor(Math.random() * 500), Math.floor(Math.random() * 50))
    );
    const summary = buildDatasetSummary(makeInput(items));
    const ids = summary.representativeSample.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("top items are sorted by influence weight descending", () => {
    const items = Array.from({ length: 100 }, (_, i) =>
      makeTweet(`${i}`, (i + 1) * 100, (i + 1) * 20)
    );
    const summary = buildDatasetSummary(makeInput(items));
    for (let i = 1; i < summary.topItems.length; i++) {
      expect(summary.topItems[i - 1].influenceWeight).toBeGreaterThanOrEqual(
        summary.topItems[i].influenceWeight
      );
    }
  });
});

describe("detectRequestedFields", () => {
  it("detects sentiment from Spanish brief", () => {
    const result = detectRequestedFields(
      "Quiero analizar el sentimiento público sobre Milei",
      "es"
    );
    expect(result).toContain("sentiment");
  });

  it("detects demographics from English brief", () => {
    const result = detectRequestedFields(
      "Analyze by age group and socioeconomic class",
      "en"
    );
    expect(result).toContain("demographics");
  });

  it("detects location from brief", () => {
    const result = detectRequestedFields(
      "Quiero ver la ubicación de los negocios",
      "es"
    );
    expect(result).toContain("geo");
  });

  it("returns empty for unrelated brief", () => {
    const result = detectRequestedFields(
      "Just show me the data",
      "en"
    );
    expect(result).toHaveLength(0);
  });
});
