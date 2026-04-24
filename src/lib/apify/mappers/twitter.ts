import type { ToolMapper, MapperContext, MapperResult } from "./types";

// ---------------------------------------------------------------------------
// Twitter Mapper — apidojo/tweet-scraper
//
// Transforms user-facing config (keyed by ToolParam.id from the Twitter
// schema) into the Apify actor input format.
// ---------------------------------------------------------------------------

/** Fields that pass through 1:1 (same key in user config and Apify input). */
const PASSTHROUGH_FIELDS = [
  "searchTerms",
  "maxItems",
  "sort",
  "onlyVerifiedUsers",
  "tweetLanguage",
  "onlyImage",
  "onlyVideo",
  "author",
  "mentioning",
  "geotaggedNear",
  "withinRadius",
  "minimumRetweets",
  "minimumFavorites",
  "minimumReplies",
] as const;

interface DateRange {
  start?: string;
  end?: string;
}

export const mapTwitterConfig: ToolMapper = (ctx: MapperContext): MapperResult => {
  const { userConfig, catalogDefaults } = ctx;
  const actorInput: Record<string, unknown> = { ...catalogDefaults };
  const warnings: string[] = [];

  // ── 1. Direct pass-through fields ────────────────────────────────────
  for (const key of PASSTHROUGH_FIELDS) {
    const value = userConfig[key];
    if (value !== undefined && value !== null) {
      actorInput[key] = value;
    }
  }

  // ── 2. Date range → separate start / end fields ─────────────────────
  const dateRange = userConfig.dateRange as DateRange | undefined;
  if (dateRange) {
    if (dateRange.start !== undefined && dateRange.start !== null) {
      actorInput.start = dateRange.start;
    }
    if (dateRange.end !== undefined && dateRange.end !== null) {
      actorInput.end = dateRange.end;
    }
  }

  // ── 3. Effective result count ────────────────────────────────────────
  const maxItems =
    typeof userConfig.maxItems === "number" ? userConfig.maxItems : 100;
  const effectiveResultCount = maxItems;

  // ── 4. Warnings ──────────────────────────────────────────────────────
  if (userConfig.geotaggedNear && !userConfig.withinRadius) {
    warnings.push(
      "Geo location set without radius — defaulting to 25km"
    );
  }

  if (dateRange?.start && dateRange?.end && dateRange.start > dateRange.end) {
    warnings.push("Date range start is after end");
  }

  return { actorInput, effectiveResultCount, warnings };
};
