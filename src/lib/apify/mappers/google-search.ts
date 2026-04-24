import type { ToolMapper } from "./types";

/**
 * Mapper for Google Search (apify/google-search-scraper).
 *
 * Transforms user-facing config into the Apify actor input format.
 * - queries -> queries (direct, kept as array)
 * - locationUule only included when truthy
 * - effectiveResultCount = queries.length * maxPagesPerQuery * 10
 */
export const mapGoogleSearchConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const merged = { ...catalogDefaults, ...userConfig };

  const queries = merged.queries as string[] | undefined;
  const countryCode = merged.countryCode as string | undefined;
  const languageCode = merged.languageCode as string | undefined;
  const locationUule = merged.locationUule as string | undefined;
  const maxPagesPerQuery = (merged.maxPagesPerQuery as number | undefined) ?? 1;
  const mobileResults = merged.mobileResults as boolean | undefined;
  const includeUnfilteredResults = merged.includeUnfilteredResults as
    | boolean
    | undefined;

  const actorInput: Record<string, unknown> = {};

  if (queries != null) {
    actorInput.queries = queries;
  }

  if (countryCode != null) {
    actorInput.countryCode = countryCode;
  }

  if (languageCode != null) {
    actorInput.languageCode = languageCode;
  }

  // locationUule — only if truthy
  if (locationUule) {
    actorInput.locationUule = locationUule;
  }

  actorInput.maxPagesPerQuery = maxPagesPerQuery;

  if (mobileResults != null) {
    actorInput.mobileResults = mobileResults;
  }

  if (includeUnfilteredResults != null) {
    actorInput.includeUnfilteredResults = includeUnfilteredResults;
  }

  const RESULTS_PER_PAGE = 10;
  const queryCount = Array.isArray(queries) ? queries.length : 0;
  const effectiveResultCount =
    queryCount > 0
      ? queryCount * maxPagesPerQuery * RESULTS_PER_PAGE
      : maxPagesPerQuery * RESULTS_PER_PAGE;

  return {
    actorInput,
    effectiveResultCount,
    warnings: [],
  };
};
