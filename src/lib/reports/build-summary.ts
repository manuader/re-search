// ---------------------------------------------------------------------------
// Report Pipeline — Build Dataset Summary
// ---------------------------------------------------------------------------

import type {
  BuildSummaryInput,
  DatasetSummary,
  WeightedItem,
  SampleItem,
  SentimentStats,
  SentimentBucket,
  TemporalStats,
  TemporalBucket,
  TemporalGranularity,
  HourDayEntry,
  SegmentationStats,
  CategorySegment,
  PainPointEntry,
  CorrelationEntry,
  TextPatterns,
  KeywordEntry,
  EngagementStats,
} from "./types";

import {
  mean,
  median,
  percentile,
  stdDev,
  giniCoefficient,
  pearsonCorrelation,
  linearTrend,
} from "./stats";

import {
  computeInfluenceWeight,
  extractPrimaryEngagement,
  extractContentSnippet,
  extractDate,
  extractAuthor,
  extractUrl,
  extractEngagementRaw,
  primaryMetricName,
} from "./influence-weight";

import { determineSampleSize, stratifiedSample } from "./sampling";
import { filterStopWords } from "./stop-words";

// ---------------------------------------------------------------------------
// Detect requested enrichments from user brief
// ---------------------------------------------------------------------------

const ENRICHMENT_PATTERNS: Record<string, RegExp> = {
  sentiment: /sentimiento|sentiment|opini[oó]n|feeling/i,
  categories: /categor[ií]a|classification|classify|tema|topic/i,
  painPoints: /pain\s*point|problema|complaint|queja|dolor/i,
  demographics:
    /demogr[aá]fi|clase\s*social|socioeconomi|income|edad|age|rango\s*etario/i,
  geo: /ubicaci[oó]n|lugar|location|pa[ií]s|ciudad|city|provincia|geo/i,
  gender: /g[eé]nero|gender|sexo/i,
};

export function detectRequestedFields(
  brief: string,
  _locale: "en" | "es"
): string[] {
  const found: string[] = [];
  for (const [key, pattern] of Object.entries(ENRICHMENT_PATTERNS)) {
    if (pattern.test(brief)) found.push(key);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Sentiment score mapping
// ---------------------------------------------------------------------------

function sentimentToScore(s: unknown): number | null {
  if (typeof s === "number") return s;
  if (typeof s !== "string") return null;
  const lower = s.toLowerCase().trim();
  if (lower === "positive") return 1;
  if (lower === "neutral") return 0;
  if (lower === "negative") return -1;
  return null;
}

// ---------------------------------------------------------------------------
// Main: buildDatasetSummary
// ---------------------------------------------------------------------------

export function buildDatasetSummary(input: BuildSummaryInput): DatasetSummary {
  const { items, source, userBrief, enrichments, locale } = input;
  const N = items.length;

  if (N === 0) {
    throw new Error("No data to summarize (N=0)");
  }

  // ── 1. Build weighted items ──────────────────────────────────────────
  const weighted: WeightedItem[] = items.map((item) => {
    const ai = item.ai_fields ?? {};
    return {
      id: item.id,
      content: extractContentSnippet(source, item.content),
      author: extractAuthor(source, item.content),
      date: extractDate(source, item.content) ?? item.created_at,
      influenceWeight: computeInfluenceWeight(source, item.content),
      engagementTotal: extractPrimaryEngagement(source, item.content),
      engagementRaw: extractEngagementRaw(source, item.content),
      sentiment: typeof ai.sentiment === "string" ? ai.sentiment : null,
      sentimentScore: sentimentToScore(ai.sentiment ?? ai.score),
      category: typeof ai.category === "string" ? ai.category : null,
      url: extractUrl(source, item.content),
    };
  });

  // ── 2. Engagement stats (on full population) ────────────────────────
  const engagementValues = weighted
    .map((w) => w.engagementTotal)
    .sort((a, b) => a - b);

  const engMean = mean(engagementValues);
  const engMedian = median(engagementValues);
  const engStdDev = stdDev(engagementValues, engMean);
  const engTotal = engagementValues.reduce((a, b) => a + b, 0);

  // Top 10 concentration
  const sortedDesc = [...engagementValues].sort((a, b) => b - a);
  const top10Sum = sortedDesc.slice(0, 10).reduce((a, b) => a + b, 0);
  const top10Pct = engTotal > 0 ? (top10Sum / engTotal) * 100 : 0;

  // Top 1% concentration
  const top1PctCount = Math.max(1, Math.ceil(N * 0.01));
  const top1PctSum = sortedDesc.slice(0, top1PctCount).reduce((a, b) => a + b, 0);
  const top1PctPct = engTotal > 0 ? (top1PctSum / engTotal) * 100 : 0;

  // Outliers (> mean + 2σ)
  const outlierThreshold = engMean + 2 * engStdDev;
  const outlierCount = engagementValues.filter((v) => v > outlierThreshold).length;

  const engagement: EngagementStats = {
    primaryMetric: primaryMetricName(source),
    total: engTotal,
    mean: round2(engMean),
    median: round2(engMedian),
    stdDev: round2(engStdDev),
    percentiles: {
      p10: round2(percentile(engagementValues, 10)),
      p25: round2(percentile(engagementValues, 25)),
      p50: round2(percentile(engagementValues, 50)),
      p75: round2(percentile(engagementValues, 75)),
      p90: round2(percentile(engagementValues, 90)),
      p99: round2(percentile(engagementValues, 99)),
    },
    top10ConcentrationPct: round2(top10Pct),
    top1PctConcentrationPct: round2(top1PctPct),
    giniCoefficient: round4(giniCoefficient(engagementValues)),
    outlierCount,
  };

  // ── 3. Sentiment stats ──────────────────────────────────────────────
  let sentiment: SentimentStats | null = null;
  if (enrichments.sentiment) {
    const withSentiment = weighted.filter((w) => w.sentimentScore !== null);
    if (withSentiment.length > 0) {
      const scores = withSentiment
        .map((w) => w.sentimentScore!)
        .sort((a, b) => a - b);
      const sMean = mean(scores);
      const sMedian = median(scores);
      const sStdDev = stdDev(scores, sMean);

      // Unweighted distribution
      const unweightedDist = countSentimentDistribution(withSentiment);

      // Weighted
      const weightedScores: number[] = [];
      const weightedDist: Record<string, number> = {};
      for (const w of withSentiment) {
        const label = w.sentiment ?? "unknown";
        weightedDist[label] =
          (weightedDist[label] ?? 0) + w.influenceWeight;
        // For weighted mean: repeat score by weight
        weightedScores.push(w.sentimentScore! * w.influenceWeight);
      }
      const totalWeight = withSentiment.reduce(
        (s, w) => s + w.influenceWeight,
        0
      );
      const wMean = totalWeight > 0
        ? weightedScores.reduce((a, b) => a + b, 0) / totalWeight
        : 0;

      // Weighted stddev
      let wSumSq = 0;
      for (const w of withSentiment) {
        wSumSq += w.influenceWeight * (w.sentimentScore! - wMean) ** 2;
      }
      const wStdDev = totalWeight > 0 ? Math.sqrt(wSumSq / totalWeight) : 0;

      // Weighted median (approximate)
      const sortedW = [...withSentiment].sort(
        (a, b) => a.sentimentScore! - b.sentimentScore!
      );
      let cumWeight = 0;
      let wMedian = sMean;
      for (const w of sortedW) {
        cumWeight += w.influenceWeight;
        if (cumWeight >= totalWeight / 2) {
          wMedian = w.sentimentScore!;
          break;
        }
      }

      const wDistBuckets: SentimentBucket[] = Object.entries(weightedDist).map(
        ([label, wt]) => ({ label, count: round2(wt) })
      );

      // Polarization: stddev / max possible stddev
      // For values in [-1, 1], max stddev = 1 (when half at -1 and half at +1)
      const polarizationIndex = round4(Math.min(1, sStdDev));

      // Check if negative is amplified among top-engaged
      const topEngaged = [...withSentiment]
        .sort((a, b) => b.influenceWeight - a.influenceWeight)
        .slice(0, Math.max(1, Math.ceil(withSentiment.length * 0.1)));
      const topMeanSentiment = mean(topEngaged.map((w) => w.sentimentScore!));

      sentiment = {
        unweighted: {
          mean: round4(sMean),
          median: round4(sMedian),
          stdDev: round4(sStdDev),
          distribution: unweightedDist,
        },
        weighted: {
          mean: round4(wMean),
          median: round4(wMedian),
          stdDev: round4(wStdDev),
          distribution: wDistBuckets,
        },
        polarizationIndex,
        deltaWeightedVsUnweighted: round4(wMean - sMean),
        negativeAmplified: topMeanSentiment < sMean,
      };
    }
  }

  // ── 4. Temporal stats ───────────────────────────────────────────────
  let temporal: TemporalStats | null = null;
  const withDates = weighted.filter((w) => w.date !== null);
  if (withDates.length >= 3) {
    const dates = withDates
      .map((w) => new Date(w.date!).getTime())
      .sort((a, b) => a - b);
    const rangeMs = dates[dates.length - 1] - dates[0];
    const rangeDays = rangeMs / (1000 * 60 * 60 * 24);

    let granularity: TemporalGranularity;
    if (rangeDays <= 2) granularity = "hour";
    else if (rangeDays <= 30) granularity = "day";
    else if (rangeDays <= 180) granularity = "week";
    else granularity = "month";

    // Group into buckets
    const bucketMap = new Map<
      string,
      { engagements: number[]; sentiments: number[]; count: number }
    >();

    for (const w of withDates) {
      const d = new Date(w.date!);
      let key: string;
      switch (granularity) {
        case "hour":
          key = `${d.toISOString().slice(0, 13)}:00`;
          break;
        case "day":
          key = d.toISOString().slice(0, 10);
          break;
        case "week": {
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          key = weekStart.toISOString().slice(0, 10);
          break;
        }
        case "month":
          key = d.toISOString().slice(0, 7);
          break;
      }

      if (!bucketMap.has(key)) {
        bucketMap.set(key, { engagements: [], sentiments: [], count: 0 });
      }
      const b = bucketMap.get(key)!;
      b.count++;
      b.engagements.push(w.engagementTotal);
      if (w.sentimentScore !== null) b.sentiments.push(w.sentimentScore);
    }

    const series: TemporalBucket[] = [...bucketMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, data]) => {
        const entry: TemporalBucket = {
          bucket,
          count: data.count,
          avgEngagement: round2(mean(data.engagements)),
        };
        if (data.sentiments.length > 0) {
          entry.avgSentiment = round4(mean(data.sentiments));
        }
        return entry;
      });

    const trend = linearTrend(series.map((s) => s.count));

    // Hour of day / day of week (only for granularity ≤ day)
    let hourOfDay: Record<number, HourDayEntry> | undefined;
    let dayOfWeek: Record<number, HourDayEntry> | undefined;

    if (granularity === "hour" || granularity === "day") {
      hourOfDay = {};
      dayOfWeek = {};
      for (let h = 0; h < 24; h++)
        hourOfDay[h] = { count: 0, avgEngagement: 0 };
      for (let d = 0; d < 7; d++)
        dayOfWeek[d] = { count: 0, avgEngagement: 0 };

      const hourEngagements: Record<number, number[]> = {};
      const dayEngagements: Record<number, number[]> = {};

      for (const w of withDates) {
        const d = new Date(w.date!);
        const h = d.getUTCHours();
        const dow = d.getUTCDay();
        if (!hourEngagements[h]) hourEngagements[h] = [];
        if (!dayEngagements[dow]) dayEngagements[dow] = [];
        hourEngagements[h].push(w.engagementTotal);
        dayEngagements[dow].push(w.engagementTotal);
        hourOfDay[h].count++;
        dayOfWeek[dow].count++;
      }

      for (let h = 0; h < 24; h++) {
        if (hourEngagements[h]?.length) {
          hourOfDay[h].avgEngagement = round2(mean(hourEngagements[h]));
        }
      }
      for (let d = 0; d < 7; d++) {
        if (dayEngagements[d]?.length) {
          dayOfWeek[d].avgEngagement = round2(mean(dayEngagements[d]));
        }
      }
    }

    temporal = { granularity, series, hourOfDay, dayOfWeek, trend };
  }

  // ── 5. Date range ──────────────────────────────────────────────────
  const sortedDates = withDates
    .map((w) => w.date!)
    .sort()
    .filter(Boolean);
  const dateRange =
    sortedDates.length >= 2
      ? { from: sortedDates[0], to: sortedDates[sortedDates.length - 1] }
      : null;

  // ── 6. Segmentation ───────────────────────────────────────────────
  let segmentation: SegmentationStats | null = null;
  if (enrichments.categories) {
    const catMap = new Map<
      string,
      { count: number; sentiments: number[]; engagements: number[] }
    >();
    for (const w of weighted) {
      if (!w.category) continue;
      const key = w.category.toLowerCase().trim();
      if (!catMap.has(key))
        catMap.set(key, { count: 0, sentiments: [], engagements: [] });
      const entry = catMap.get(key)!;
      entry.count++;
      entry.engagements.push(w.engagementTotal);
      if (w.sentimentScore !== null) entry.sentiments.push(w.sentimentScore);
    }

    if (catMap.size > 0) {
      const byCategory: CategorySegment[] = [...catMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 15)
        .map(([label, data]) => {
          const seg: CategorySegment = {
            label,
            count: data.count,
            pctOfTotal: round2((data.count / N) * 100),
            avgEngagement: round2(mean(data.engagements)),
          };
          if (data.sentiments.length > 0) {
            seg.avgSentiment = round4(mean(data.sentiments));
          }
          return seg;
        });
      segmentation = { byCategory };
    }
  }

  // ── 7. Pain points ────────────────────────────────────────────────
  let topPainPoints: PainPointEntry[] | null = null;
  if (enrichments.painPoints) {
    const ppMap = new Map<string, number>();
    for (const w of weighted) {
      const ai = items.find((i) => i.id === w.id)?.ai_fields;
      if (!ai) continue;
      const pps = ai.pain_points;
      if (!Array.isArray(pps)) continue;
      for (const pp of pps) {
        if (typeof pp !== "string") continue;
        const key = pp.toLowerCase().trim();
        if (key) ppMap.set(key, (ppMap.get(key) ?? 0) + 1);
      }
    }
    if (ppMap.size > 0) {
      topPainPoints = [...ppMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([painPoint, count]) => ({ painPoint, count }));
    }
  }

  // ── 8. Correlations ───────────────────────────────────────────────
  const correlations: CorrelationEntry[] = [];

  // Sentiment vs engagement
  if (enrichments.sentiment) {
    const pairs = weighted.filter((w) => w.sentimentScore !== null);
    if (pairs.length >= 10) {
      const r = pearsonCorrelation(
        pairs.map((w) => w.sentimentScore!),
        pairs.map((w) => w.engagementTotal)
      );
      if (Math.abs(r) >= 0.3) {
        correlations.push({
          fieldA: "sentiment",
          fieldB: "engagement",
          r: round4(r),
          n: pairs.length,
        });
      }
    }
  }

  // Content length vs engagement
  const contentLengths = weighted.map((w) => w.content.length);
  if (contentLengths.length >= 10) {
    const r = pearsonCorrelation(
      contentLengths,
      weighted.map((w) => w.engagementTotal)
    );
    if (Math.abs(r) >= 0.3) {
      correlations.push({
        fieldA: "contentLength",
        fieldB: "engagement",
        r: round4(r),
        n: contentLengths.length,
      });
    }
  }

  // ── 9. Top items ──────────────────────────────────────────────────
  const topItems: SampleItem[] = [...weighted]
    .sort((a, b) => b.influenceWeight - a.influenceWeight)
    .slice(0, 20)
    .map((w) => ({
      id: w.id,
      content: w.content,
      author: w.author,
      date: w.date,
      influenceWeight: round3(w.influenceWeight),
      engagementRaw: w.engagementRaw,
      sentiment: w.sentiment,
      category: w.category,
      bucket: "top" as const,
      url: w.url,
    }));

  // ── 10. Representative sample ─────────────────────────────────────
  const sampleSize = determineSampleSize(N);
  const representativeSample = stratifiedSample(weighted, sampleSize, {
    hasSentiment: enrichments.sentiment,
    hasDates: withDates.length >= 3,
  });

  // ── 11. Text patterns ─────────────────────────────────────────────
  let textPatterns: TextPatterns | null = null;
  const allContent = weighted.map((w) => w.content).filter((c) => c.length > 0);

  if (allContent.length > 0) {
    // Word frequency
    const wordCounts = new Map<string, { count: number; sentiments: number[] }>();
    for (let i = 0; i < weighted.length; i++) {
      const words = weighted[i].content
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3);

      const filtered = filterStopWords(words, locale);
      const seen = new Set<string>();
      for (const word of filtered) {
        if (seen.has(word)) continue;
        seen.add(word);
        if (!wordCounts.has(word))
          wordCounts.set(word, { count: 0, sentiments: [] });
        const entry = wordCounts.get(word)!;
        entry.count++;
        if (weighted[i].sentimentScore !== null) {
          entry.sentiments.push(weighted[i].sentimentScore!);
        }
      }
    }

    const topKeywords: KeywordEntry[] = [...wordCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([word, data]) => {
        const entry: KeywordEntry = { word, count: data.count };
        if (data.sentiments.length > 0) {
          entry.avgSentiment = round4(mean(data.sentiments));
        }
        return entry;
      });

    // Average length
    const lengths = allContent.map((c) => c.length);
    const avgLengthChars = round2(mean(lengths));

    // Length by engagement quartile
    const sorted = [...weighted].sort(
      (a, b) => a.engagementTotal - b.engagementTotal
    );
    const q1Slice = sorted.slice(0, Math.floor(N / 4));
    const q2Slice = sorted.slice(Math.floor(N / 4), Math.floor(N / 2));
    const q3Slice = sorted.slice(Math.floor(N / 2), Math.floor((3 * N) / 4));
    const q4Slice = sorted.slice(Math.floor((3 * N) / 4));

    textPatterns = {
      topKeywords,
      avgLengthChars,
      avgLengthByEngagementQuartile: {
        q1: round2(mean(q1Slice.map((w) => w.content.length))),
        q2: round2(mean(q2Slice.map((w) => w.content.length))),
        q3: round2(mean(q3Slice.map((w) => w.content.length))),
        q4: round2(mean(q4Slice.map((w) => w.content.length))),
      },
    };
  }

  // ── 12. Limitations ───────────────────────────────────────────────
  const limitations: string[] = [];
  if (N < 10) {
    limitations.push(
      `Very small sample size (N=${N}) — results may not be statistically representative.`
    );
  }
  if (engStdDev === 0 && N > 1) {
    limitations.push("No engagement variance detected — all items have identical engagement.");
  }
  if (withDates.length === 0) {
    limitations.push("No date information available — temporal analysis omitted.");
  }

  // ── 13. Missing enrichments ───────────────────────────────────────
  const requested = detectRequestedFields(userBrief, locale);
  const present = Object.entries(enrichments)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const missing = requested.filter((r) => !present.includes(r));

  // ── 14. Assemble ──────────────────────────────────────────────────
  return {
    meta: {
      totalItems: N,
      sampleSize: representativeSample.length,
      source,
      dateRange,
      generatedAt: new Date().toISOString(),
      userBrief,
      enrichmentsPresent: present,
      enrichmentsRequestedButMissing: missing,
      limitations,
    },
    engagement,
    sentiment,
    temporal,
    segmentation,
    topPainPoints,
    correlations,
    topItems,
    representativeSample,
    textPatterns,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function countSentimentDistribution(
  items: WeightedItem[]
): SentimentBucket[] {
  const dist = new Map<string, number>();
  for (const w of items) {
    const label = w.sentiment ?? "unknown";
    dist.set(label, (dist.get(label) ?? 0) + 1);
  }
  return [...dist.entries()].map(([label, count]) => ({ label, count }));
}
