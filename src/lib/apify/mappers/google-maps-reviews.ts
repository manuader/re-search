import type { ToolMapper } from "./types";

/**
 * Mapper for Google Maps Reviews (compass/google-maps-reviews-scraper).
 *
 * Transforms user-facing config into the Apify actor input format.
 * - placeUrls -> startUrls (array of URL strings)
 * - placeIds  -> placeIds  (direct, only if non-empty)
 * - All other fields map 1:1
 */
export const mapGoogleMapsReviewsConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const merged = { ...catalogDefaults, ...userConfig };

  const placeUrls = merged.placeUrls as string[] | undefined;
  const placeIds = merged.placeIds as string[] | undefined;
  const reviewsSort = merged.reviewsSort as string | undefined;
  const reviewsStartDate = merged.reviewsStartDate as string | undefined;
  const language = merged.language as string | undefined;
  const reviewsOrigin = merged.reviewsOrigin as string | undefined;
  const maxReviews = (merged.maxReviews as number | undefined) ?? 100;
  const personalData = merged.personalData as boolean | undefined;

  const actorInput: Record<string, unknown> = {};

  // placeUrls -> startUrls (Apify expects array of URL strings)
  if (placeUrls && placeUrls.length > 0) {
    actorInput.startUrls = placeUrls;
  }

  // placeIds — only if non-empty array
  if (placeIds && placeIds.length > 0) {
    actorInput.placeIds = placeIds;
  }

  if (reviewsSort != null) {
    actorInput.reviewsSort = reviewsSort;
  }

  if (reviewsStartDate != null) {
    actorInput.reviewsStartDate = reviewsStartDate;
  }

  if (language != null) {
    actorInput.language = language;
  }

  if (reviewsOrigin != null) {
    actorInput.reviewsOrigin = reviewsOrigin;
  }

  actorInput.maxReviews = maxReviews;

  if (personalData != null) {
    actorInput.personalData = personalData;
  }

  return {
    actorInput,
    effectiveResultCount: maxReviews,
    warnings: [],
  };
};
