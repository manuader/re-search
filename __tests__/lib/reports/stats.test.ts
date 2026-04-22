import { describe, it, expect } from "vitest";
import {
  mean,
  median,
  percentile,
  stdDev,
  giniCoefficient,
  pearsonCorrelation,
  linearTrend,
} from "@/lib/reports/stats";

describe("mean", () => {
  it("returns 0 for empty array", () => {
    expect(mean([])).toBe(0);
  });
  it("computes mean of [1,2,3,4,5]", () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });
  it("computes mean of single element", () => {
    expect(mean([42])).toBe(42);
  });
});

describe("percentile", () => {
  it("returns 0 for empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });
  it("returns the element for single-element array", () => {
    expect(percentile([7], 50)).toBe(7);
  });
  it("computes p0 correctly", () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
  });
  it("computes p100 correctly", () => {
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });
  it("computes p50 (median) correctly for odd-length", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });
  it("computes p50 correctly for even-length", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
  });
  it("computes p25 correctly", () => {
    expect(percentile([1, 2, 3, 4, 5], 25)).toBe(2);
  });
  it("computes p75 correctly", () => {
    expect(percentile([1, 2, 3, 4, 5], 75)).toBe(4);
  });
});

describe("median", () => {
  it("delegates to percentile p50", () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("stdDev", () => {
  it("returns 0 for single element", () => {
    expect(stdDev([5], 5)).toBe(0);
  });
  it("returns 0 for empty array", () => {
    expect(stdDev([], 0)).toBe(0);
  });
  it("computes population stddev for [2,4,4,4,5,5,7,9]", () => {
    // mean = 5, variance = 4, stddev = 2
    const arr = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(stdDev(arr, 5)).toBe(2);
  });
  it("returns 0 when all values are the same", () => {
    expect(stdDev([3, 3, 3, 3], 3)).toBe(0);
  });
});

describe("giniCoefficient", () => {
  it("returns 0 for empty array", () => {
    expect(giniCoefficient([])).toBe(0);
  });
  it("returns 0 for single element", () => {
    expect(giniCoefficient([5])).toBe(0);
  });
  it("returns 0 for all equal values", () => {
    expect(giniCoefficient([1, 1, 1, 1])).toBe(0);
  });
  it("returns ~0.75 for [0,0,0,100]", () => {
    const g = giniCoefficient([0, 0, 0, 100]);
    expect(g).toBeCloseTo(0.75, 1);
  });
  it("returns 0 for all zeros", () => {
    expect(giniCoefficient([0, 0, 0, 0])).toBe(0);
  });
  it("returns positive value for unequal distribution", () => {
    const g = giniCoefficient([1, 2, 3, 4, 5]);
    expect(g).toBeGreaterThan(0);
    expect(g).toBeLessThan(1);
  });
});

describe("pearsonCorrelation", () => {
  it("returns 1 for perfect positive correlation", () => {
    expect(pearsonCorrelation([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });
  it("returns -1 for perfect negative correlation", () => {
    expect(pearsonCorrelation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 5);
  });
  it("returns 0 for zero variance in x", () => {
    expect(pearsonCorrelation([5, 5, 5], [1, 2, 3])).toBe(0);
  });
  it("returns 0 for zero variance in y", () => {
    expect(pearsonCorrelation([1, 2, 3], [5, 5, 5])).toBe(0);
  });
  it("returns 0 for mismatched lengths", () => {
    expect(pearsonCorrelation([1, 2], [1, 2, 3])).toBe(0);
  });
  it("returns 0 for single element", () => {
    expect(pearsonCorrelation([1], [1])).toBe(0);
  });
});

describe("linearTrend", () => {
  it("returns flat for fewer than 3 points", () => {
    expect(linearTrend([1, 2])).toBe("flat");
  });
  it("returns rising for monotonically increasing", () => {
    expect(linearTrend([1, 2, 3, 4, 5])).toBe("rising");
  });
  it("returns falling for monotonically decreasing", () => {
    expect(linearTrend([5, 4, 3, 2, 1])).toBe("falling");
  });
  it("returns flat for constant values", () => {
    expect(linearTrend([3, 3, 3, 3, 3])).toBe("flat");
  });
  it("returns volatile for noisy data with no clear trend", () => {
    expect(linearTrend([1, 10, 2, 9, 3, 8, 4, 7])).toBe("volatile");
  });
});
