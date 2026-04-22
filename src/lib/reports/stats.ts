// ---------------------------------------------------------------------------
// Report Pipeline — Pure Statistical Functions
// ---------------------------------------------------------------------------
// All functions assume pre-sorted ascending input where noted.
// Zero external dependencies.
// ---------------------------------------------------------------------------

/**
 * Arithmetic mean. Returns 0 for empty arrays.
 */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

/**
 * Percentile using linear interpolation.
 * Expects a pre-sorted ascending array. p in [0, 100].
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Median (p50). Expects pre-sorted ascending.
 */
export function median(sorted: number[]): number {
  return percentile(sorted, 50);
}

/**
 * Population standard deviation.
 */
export function stdDev(arr: number[], populationMean: number): number {
  if (arr.length <= 1) return 0;
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - populationMean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / arr.length);
}

/**
 * Gini coefficient (0 = perfect equality, 1 = maximum inequality).
 * Expects pre-sorted ascending, all values >= 0.
 */
export function giniCoefficient(sorted: number[]): number {
  const n = sorted.length;
  if (n <= 1) return 0;
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let sumOfRanks = 0;
  for (let i = 0; i < n; i++) {
    sumOfRanks += (i + 1) * sorted[i];
  }
  return (2 * sumOfRanks) / (n * total) - (n + 1) / n;
}

/**
 * Pearson correlation coefficient.
 * Returns 0 if either array has zero variance or arrays differ in length.
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n !== ys.length || n < 2) return 0;

  const mx = mean(xs);
  const my = mean(ys);

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  if (denom === 0) return 0;
  return sumXY / denom;
}

/**
 * Simple linear trend classification via OLS.
 * - 'flat' if |slope/mean| < 0.05
 * - 'volatile' if R-squared < 0.3
 * - otherwise 'rising' or 'falling' by sign of slope
 */
export function linearTrend(
  ys: number[]
): "rising" | "falling" | "flat" | "volatile" {
  const n = ys.length;
  if (n < 3) return "flat";

  // xs = [0, 1, 2, ..., n-1]
  const xMean = (n - 1) / 2;
  const yMean = mean(ys);

  if (yMean === 0) return "flat";

  let sumXY = 0;
  let sumX2 = 0;
  let sumResid2 = 0;
  let sumTotal2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    const dy = ys[i] - yMean;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumTotal2 += dy * dy;
  }

  if (sumX2 === 0) return "flat";

  const slope = sumXY / sumX2;

  // R-squared
  for (let i = 0; i < n; i++) {
    const predicted = yMean + slope * (i - xMean);
    const resid = ys[i] - predicted;
    sumResid2 += resid * resid;
  }

  const rSquared = sumTotal2 === 0 ? 0 : 1 - sumResid2 / sumTotal2;

  if (Math.abs(slope / yMean) < 0.05) return "flat";
  if (rSquared < 0.3) return "volatile";
  return slope > 0 ? "rising" : "falling";
}
