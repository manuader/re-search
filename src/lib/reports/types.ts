// ---------------------------------------------------------------------------
// Report Pipeline — Type Definitions
// ---------------------------------------------------------------------------

export type SourceType =
  | "twitter"
  | "instagram"
  | "reddit"
  | "linkedin"
  | "google_maps_places"
  | "google_maps_reviews"
  | "tripadvisor"
  | "amazon"
  | "news"
  | "generic";

export type BucketLabel =
  | "top"
  | "bottom"
  | "median"
  | "sentiment_outlier"
  | "temporal"
  | "random";

export type TrendDirection = "rising" | "falling" | "flat" | "volatile";

export type TemporalGranularity = "hour" | "day" | "week" | "month";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface RawDataItem {
  id: string;
  content: Record<string, unknown>;
  ai_fields: Record<string, unknown> | null;
  created_at: string;
}

export interface EnrichmentFlags {
  sentiment: boolean;
  categories: boolean;
  painPoints: boolean;
  demographics: boolean;
  geo: boolean;
  topics: boolean;
}

export interface BuildSummaryInput {
  items: RawDataItem[];
  source: SourceType;
  userBrief: string;
  enrichments: EnrichmentFlags;
  locale: "en" | "es";
}

// ---------------------------------------------------------------------------
// Sample Items
// ---------------------------------------------------------------------------

export interface EngagementRaw {
  views?: number;
  likes?: number;
  reposts?: number;
  comments?: number;
  rating?: number;
  helpful?: number;
  score?: number;
  reviewCount?: number;
}

export interface SampleItem {
  id: string;
  content: string;
  author: string | null;
  date: string | null;
  influenceWeight: number;
  engagementRaw: EngagementRaw;
  sentiment: string | null;
  category: string | null;
  bucket: BucketLabel;
  url: string | null;
}

// ---------------------------------------------------------------------------
// Weighted Item (internal — used during processing)
// ---------------------------------------------------------------------------

export interface WeightedItem {
  id: string;
  content: string;
  author: string | null;
  date: string | null;
  influenceWeight: number;
  engagementTotal: number;
  engagementRaw: EngagementRaw;
  sentiment: string | null;
  sentimentScore: number | null;
  category: string | null;
  url: string | null;
}

// ---------------------------------------------------------------------------
// DatasetSummary — the payload sent to the LLM
// ---------------------------------------------------------------------------

export interface SummaryMeta {
  totalItems: number;
  sampleSize: number;
  source: SourceType;
  dateRange: { from: string; to: string } | null;
  generatedAt: string;
  userBrief: string;
  enrichmentsPresent: string[];
  enrichmentsRequestedButMissing: string[];
  limitations: string[];
}

export interface EngagementStats {
  primaryMetric: string;
  total: number;
  mean: number;
  median: number;
  stdDev: number;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p99: number;
  };
  top10ConcentrationPct: number;
  top1PctConcentrationPct: number;
  giniCoefficient: number;
  outlierCount: number;
}

export interface SentimentBucket {
  label: string;
  count: number;
}

export interface SentimentStats {
  unweighted: {
    mean: number;
    median: number;
    stdDev: number;
    distribution: SentimentBucket[];
  };
  weighted: {
    mean: number;
    median: number;
    stdDev: number;
    distribution: SentimentBucket[];
  };
  polarizationIndex: number;
  deltaWeightedVsUnweighted: number;
  negativeAmplified: boolean;
}

export interface TemporalBucket {
  bucket: string;
  count: number;
  avgEngagement: number;
  avgSentiment?: number;
}

export interface HourDayEntry {
  count: number;
  avgEngagement: number;
}

export interface TemporalStats {
  granularity: TemporalGranularity;
  series: TemporalBucket[];
  hourOfDay?: Record<number, HourDayEntry>;
  dayOfWeek?: Record<number, HourDayEntry>;
  trend: TrendDirection;
}

export interface CategorySegment {
  label: string;
  count: number;
  pctOfTotal: number;
  avgSentiment?: number;
  avgEngagement: number;
}

export interface PainPointEntry {
  painPoint: string;
  count: number;
}

export interface SegmentationStats {
  byCategory?: CategorySegment[];
  byLocation?: CategorySegment[];
}

export interface CorrelationEntry {
  fieldA: string;
  fieldB: string;
  r: number;
  n: number;
}

export interface KeywordEntry {
  word: string;
  count: number;
  avgSentiment?: number;
}

export interface TextPatterns {
  topKeywords: KeywordEntry[];
  avgLengthChars: number;
  avgLengthByEngagementQuartile: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  };
}

export interface DatasetSummary {
  meta: SummaryMeta;
  engagement: EngagementStats;
  sentiment: SentimentStats | null;
  temporal: TemporalStats | null;
  segmentation: SegmentationStats | null;
  topPainPoints: PainPointEntry[] | null;
  correlations: CorrelationEntry[];
  topItems: SampleItem[];
  representativeSample: SampleItem[];
  textPatterns: TextPatterns | null;
}
