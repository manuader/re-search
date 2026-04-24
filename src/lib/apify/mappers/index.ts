import type { ToolMapper } from "./types";
import { mapTwitterConfig } from "./twitter";
import { mapGoogleMapsReviewsConfig } from "./google-maps-reviews";
import { mapGoogleSearchConfig } from "./google-search";
import { mapRedditConfig } from "./reddit";
import { mapGoogleMapsConfig } from "./google-maps";
import { mapInstagramConfig } from "./instagram";
import { mapTripadvisorConfig } from "./tripadvisor";
import { mapAmazonProductsConfig } from "./amazon-products";
import { mapWebCrawlerConfig } from "./web-crawler";
import { mapContactExtractorConfig } from "./contact-extractor";
import { mapLinkedinJobsConfig } from "./linkedin-jobs";
import { mapLinkedinProfilesConfig } from "./linkedin-profiles";

// ─── Registry ──────────────────────────────────────────────────────────────

const mapperRegistry: Record<string, ToolMapper> = {
  twitter: mapTwitterConfig,
  tweets: mapTwitterConfig, // same actor (apidojo/tweet-scraper)
  "google-maps-reviews": mapGoogleMapsReviewsConfig,
  "google-search": mapGoogleSearchConfig,
  reddit: mapRedditConfig,
  "google-maps": mapGoogleMapsConfig,
  instagram: mapInstagramConfig,
  tripadvisor: mapTripadvisorConfig,
  "amazon-products": mapAmazonProductsConfig,
  "web-crawler": mapWebCrawlerConfig,
  "contact-extractor": mapContactExtractorConfig,
  "linkedin-jobs": mapLinkedinJobsConfig,
  "linkedin-profiles": mapLinkedinProfilesConfig,
};

/**
 * Returns the dedicated mapper for a tool, or undefined if none is registered.
 */
export function getMapper(toolId: string): ToolMapper | undefined {
  return mapperRegistry[toolId];
}

// ─── Volume field names used across the catalog ────────────────────────────

const VOLUME_FIELDS = [
  "maxItems",
  "maxReviews",
  "resultsLimit",
  "maxCrawledPlacesPerSearch",
] as const;

/**
 * Backward-compatible default mapper.
 *
 * Merges catalog defaults with user config and extracts effectiveResultCount
 * from whichever common volume field is present (maxItems, maxReviews,
 * resultsLimit, or maxCrawledPlacesPerSearch). Falls back to 100.
 */
export const defaultMapper: ToolMapper = (ctx) => {
  const actorInput: Record<string, unknown> = {
    ...ctx.catalogDefaults,
    ...ctx.userConfig,
  };

  let effectiveResultCount = 100;
  for (const field of VOLUME_FIELDS) {
    const value = actorInput[field];
    if (typeof value === "number" && value > 0) {
      effectiveResultCount = value;
      break;
    }
  }

  return {
    actorInput,
    effectiveResultCount,
    warnings: [],
  };
};
