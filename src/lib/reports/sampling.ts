// ---------------------------------------------------------------------------
// Report Pipeline — N-Adaptive Stratified Sampling
// ---------------------------------------------------------------------------

import type { WeightedItem, SampleItem, BucketLabel } from "./types";

// ---------------------------------------------------------------------------
// Sample size table
// ---------------------------------------------------------------------------

export function determineSampleSize(n: number): number {
  if (n <= 30) return n;
  if (n <= 150) return Math.min(n, 40);
  if (n <= 1000) return 50;
  if (n <= 10000) return 80;
  return 120;
}

// ---------------------------------------------------------------------------
// Bucket allocation
// ---------------------------------------------------------------------------

interface BucketAlloc {
  bucket: BucketLabel;
  pct: number;
  available: boolean;
}

function allocateBuckets(
  sampleSize: number,
  hasSentiment: boolean,
  hasDates: boolean
): Map<BucketLabel, number> {
  const allocs: BucketAlloc[] = [
    { bucket: "top", pct: 0.3, available: true },
    { bucket: "bottom", pct: 0.15, available: true },
    { bucket: "median", pct: 0.2, available: true },
    { bucket: "sentiment_outlier", pct: 0.15, available: hasSentiment },
    { bucket: "temporal", pct: 0.1, available: hasDates },
    { bucket: "random", pct: 0.1, available: true },
  ];

  // Redistribute unavailable buckets proportionally
  const unavailablePct = allocs
    .filter((a) => !a.available)
    .reduce((s, a) => s + a.pct, 0);

  if (unavailablePct > 0) {
    const availableTotal = allocs
      .filter((a) => a.available)
      .reduce((s, a) => s + a.pct, 0);

    for (const a of allocs) {
      if (a.available) {
        a.pct += (a.pct / availableTotal) * unavailablePct;
      }
    }
  }

  const result = new Map<BucketLabel, number>();
  let remaining = sampleSize;

  for (const a of allocs) {
    if (!a.available) continue;
    const count = Math.round(sampleSize * a.pct);
    result.set(a.bucket, Math.min(count, remaining));
    remaining -= result.get(a.bucket)!;
  }

  // Assign any leftover to random
  if (remaining > 0) {
    result.set("random", (result.get("random") ?? 0) + remaining);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stratified sampling
// ---------------------------------------------------------------------------

function toSampleItem(item: WeightedItem, bucket: BucketLabel): SampleItem {
  return {
    id: item.id,
    content: item.content,
    author: item.author,
    date: item.date,
    influenceWeight: Math.round(item.influenceWeight * 1000) / 1000,
    engagementRaw: item.engagementRaw,
    sentiment: item.sentiment,
    category: item.category,
    bucket,
    url: item.url,
  };
}

export function stratifiedSample(
  items: WeightedItem[],
  sampleSize: number,
  opts: { hasSentiment: boolean; hasDates: boolean }
): SampleItem[] {
  if (items.length === 0) return [];
  if (sampleSize >= items.length) {
    // Return all items, assigned to "random" bucket
    return items.map((item) => toSampleItem(item, "random"));
  }

  const bucketAllocs = allocateBuckets(
    sampleSize,
    opts.hasSentiment,
    opts.hasDates
  );

  const taken = new Set<string>();
  const result: SampleItem[] = [];

  // Sort by influence weight descending for top/bottom/median selection
  const sortedByWeight = [...items].sort(
    (a, b) => b.influenceWeight - a.influenceWeight
  );

  // --- Top engagement ---
  const topCount = bucketAllocs.get("top") ?? 0;
  for (const item of sortedByWeight) {
    if (result.length >= topCount) break;
    if (taken.has(item.id)) continue;
    taken.add(item.id);
    result.push(toSampleItem(item, "top"));
  }

  // --- Bottom engagement ---
  const bottomCount = bucketAllocs.get("bottom") ?? 0;
  let bottomAdded = 0;
  for (let i = sortedByWeight.length - 1; i >= 0; i--) {
    if (bottomAdded >= bottomCount) break;
    const item = sortedByWeight[i];
    if (taken.has(item.id)) continue;
    taken.add(item.id);
    result.push(toSampleItem(item, "bottom"));
    bottomAdded++;
  }

  // --- Median engagement ---
  const medianCount = bucketAllocs.get("median") ?? 0;
  const medianIdx = Math.floor(sortedByWeight.length / 2);
  const medianRadius = Math.floor(medianCount / 2);
  const medianStart = Math.max(0, medianIdx - medianRadius);
  let medianAdded = 0;
  for (
    let i = medianStart;
    i < sortedByWeight.length && medianAdded < medianCount;
    i++
  ) {
    const item = sortedByWeight[i];
    if (taken.has(item.id)) continue;
    taken.add(item.id);
    result.push(toSampleItem(item, "median"));
    medianAdded++;
  }

  // --- Sentiment outliers ---
  const sentimentCount = bucketAllocs.get("sentiment_outlier") ?? 0;
  if (sentimentCount > 0 && opts.hasSentiment) {
    const withSentiment = items.filter(
      (item) => item.sentimentScore !== null && !taken.has(item.id)
    );
    withSentiment.sort((a, b) => (a.sentimentScore ?? 0) - (b.sentimentScore ?? 0));

    // Take half from most negative, half from most positive
    const halfNeg = Math.ceil(sentimentCount / 2);
    const halfPos = sentimentCount - halfNeg;

    let negAdded = 0;
    for (const item of withSentiment) {
      if (negAdded >= halfNeg) break;
      if (taken.has(item.id)) continue;
      taken.add(item.id);
      result.push(toSampleItem(item, "sentiment_outlier"));
      negAdded++;
    }

    let posAdded = 0;
    for (let i = withSentiment.length - 1; i >= 0; i--) {
      if (posAdded >= halfPos) break;
      const item = withSentiment[i];
      if (taken.has(item.id)) continue;
      taken.add(item.id);
      result.push(toSampleItem(item, "sentiment_outlier"));
      posAdded++;
    }
  }

  // --- Temporal ---
  const temporalCount = bucketAllocs.get("temporal") ?? 0;
  if (temporalCount > 0 && opts.hasDates) {
    const withDates = items.filter(
      (item) => item.date !== null && !taken.has(item.id)
    );
    withDates.sort(
      (a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()
    );

    if (withDates.length > 0) {
      const step = Math.max(1, Math.floor(withDates.length / temporalCount));
      let tempAdded = 0;
      for (
        let i = 0;
        i < withDates.length && tempAdded < temporalCount;
        i += step
      ) {
        const item = withDates[i];
        if (taken.has(item.id)) continue;
        taken.add(item.id);
        result.push(toSampleItem(item, "temporal"));
        tempAdded++;
      }
    }
  }

  // --- Random (reservoir sampling for large N) ---
  const randomCount = bucketAllocs.get("random") ?? 0;
  if (randomCount > 0) {
    const remaining = items.filter((item) => !taken.has(item.id));

    if (remaining.length <= randomCount) {
      for (const item of remaining) {
        taken.add(item.id);
        result.push(toSampleItem(item, "random"));
      }
    } else if (items.length > 10000) {
      // Reservoir sampling
      const reservoir: WeightedItem[] = remaining.slice(0, randomCount);
      for (let i = randomCount; i < remaining.length; i++) {
        const j = Math.floor(Math.random() * (i + 1));
        if (j < randomCount) {
          reservoir[j] = remaining[i];
        }
      }
      for (const item of reservoir) {
        taken.add(item.id);
        result.push(toSampleItem(item, "random"));
      }
    } else {
      // Fisher-Yates on indices
      const indices = remaining.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      for (let i = 0; i < Math.min(randomCount, indices.length); i++) {
        const item = remaining[indices[i]];
        taken.add(item.id);
        result.push(toSampleItem(item, "random"));
      }
    }
  }

  return result;
}
