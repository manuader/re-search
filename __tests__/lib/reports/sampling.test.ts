import { describe, it, expect } from "vitest";
import { determineSampleSize, stratifiedSample } from "@/lib/reports/sampling";
import type { WeightedItem } from "@/lib/reports/types";

function makeItem(
  id: string,
  weight: number,
  opts?: {
    sentiment?: string;
    sentimentScore?: number;
    date?: string;
  }
): WeightedItem {
  return {
    id,
    content: `Content for ${id}`,
    author: null,
    date: opts?.date ?? null,
    influenceWeight: weight,
    engagementTotal: weight * 100,
    engagementRaw: { likes: Math.round(weight * 100) },
    sentiment: opts?.sentiment ?? null,
    sentimentScore: opts?.sentimentScore ?? null,
    category: null,
    url: null,
  };
}

function makeItems(
  n: number,
  opts?: { withSentiment?: boolean; withDates?: boolean }
): WeightedItem[] {
  const items: WeightedItem[] = [];
  const baseDate = new Date("2024-01-01").getTime();
  for (let i = 0; i < n; i++) {
    const sentiments = ["positive", "neutral", "negative"];
    items.push(
      makeItem(`item-${i}`, i + 1, {
        sentiment: opts?.withSentiment
          ? sentiments[i % 3]
          : undefined,
        sentimentScore: opts?.withSentiment
          ? [1, 0, -1][i % 3]
          : undefined,
        date: opts?.withDates
          ? new Date(baseDate + i * 86400000).toISOString()
          : undefined,
      })
    );
  }
  return items;
}

describe("determineSampleSize", () => {
  it("returns N for N <= 30", () => {
    expect(determineSampleSize(1)).toBe(1);
    expect(determineSampleSize(10)).toBe(10);
    expect(determineSampleSize(30)).toBe(30);
  });

  it("returns min(N, 40) for 30 < N <= 150", () => {
    expect(determineSampleSize(31)).toBe(31); // min(31, 40)
    expect(determineSampleSize(40)).toBe(40);
    expect(determineSampleSize(100)).toBe(40);
    expect(determineSampleSize(150)).toBe(40);
  });

  it("returns 50 for 150 < N <= 1000", () => {
    expect(determineSampleSize(151)).toBe(50);
    expect(determineSampleSize(500)).toBe(50);
    expect(determineSampleSize(1000)).toBe(50);
  });

  it("returns 80 for 1000 < N <= 10000", () => {
    expect(determineSampleSize(1001)).toBe(80);
    expect(determineSampleSize(5000)).toBe(80);
    expect(determineSampleSize(10000)).toBe(80);
  });

  it("returns 120 for N > 10000", () => {
    expect(determineSampleSize(10001)).toBe(120);
    expect(determineSampleSize(50000)).toBe(120);
  });
});

describe("stratifiedSample", () => {
  it("returns empty for empty input", () => {
    const result = stratifiedSample([], 10, {
      hasSentiment: false,
      hasDates: false,
    });
    expect(result).toEqual([]);
  });

  it("returns all items when N <= sampleSize", () => {
    const items = makeItems(5);
    const result = stratifiedSample(items, 10, {
      hasSentiment: false,
      hasDates: false,
    });
    expect(result).toHaveLength(5);
  });

  it("returns exactly sampleSize items for larger N", () => {
    const items = makeItems(200);
    const result = stratifiedSample(items, 40, {
      hasSentiment: false,
      hasDates: false,
    });
    expect(result).toHaveLength(40);
  });

  it("does not contain duplicate items", () => {
    const items = makeItems(200, { withSentiment: true, withDates: true });
    const result = stratifiedSample(items, 50, {
      hasSentiment: true,
      hasDates: true,
    });
    const ids = result.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains multiple bucket types for large N", () => {
    const items = makeItems(500, { withSentiment: true, withDates: true });
    const result = stratifiedSample(items, 50, {
      hasSentiment: true,
      hasDates: true,
    });
    const buckets = new Set(result.map((s) => s.bucket));
    expect(buckets.size).toBeGreaterThanOrEqual(4);
  });

  it("includes top-engagement items in the sample", () => {
    const items = makeItems(100);
    const result = stratifiedSample(items, 40, {
      hasSentiment: false,
      hasDates: false,
    });
    // The highest-weight item should be in the sample
    const hasTopItem = result.some((s) => s.id === "item-99");
    expect(hasTopItem).toBe(true);
  });

  it("redistributes sentiment bucket when hasSentiment=false", () => {
    const items = makeItems(200);
    const result = stratifiedSample(items, 40, {
      hasSentiment: false,
      hasDates: false,
    });
    const buckets = result.map((s) => s.bucket);
    expect(buckets).not.toContain("sentiment_outlier");
  });
});
