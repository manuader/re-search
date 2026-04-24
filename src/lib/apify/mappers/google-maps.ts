import type { ToolMapper } from "./types";

/**
 * Mapper for Google Maps (compass/crawler-google-places).
 *
 * Transforms user-facing config into the Apify actor input format.
 * - categoriesArray only included if non-empty
 * - effectiveResultCount scales by search terms count and review multiplier
 */
export const mapGoogleMapsConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const actorInput: Record<string, unknown> = { ...catalogDefaults };
  const warnings: string[] = [];

  // ── Pass-through fields ─────────────────────────────────────────────
  const searchStringsArray = userConfig.searchStringsArray as string[] | undefined;
  if (searchStringsArray != null) {
    actorInput.searchStringsArray = searchStringsArray;
  }

  const location = userConfig.location as string | undefined;
  if (location != null) {
    actorInput.location = location;
  }

  const language = userConfig.language as string | undefined;
  if (language != null) {
    actorInput.language = language;
  }

  // categoriesArray — only if non-empty array
  const categoriesArray = userConfig.categoriesArray as string[] | undefined;
  if (categoriesArray && categoriesArray.length > 0) {
    actorInput.categoriesArray = categoriesArray;
  }

  const deeperCityScrape = userConfig.deeperCityScrape as boolean | undefined;
  if (deeperCityScrape != null) {
    actorInput.deeperCityScrape = deeperCityScrape;
  }

  const includeReviews = userConfig.includeReviews as boolean | undefined;
  if (includeReviews != null) {
    actorInput.includeReviews = includeReviews;
  }

  const enrichContactDetails = userConfig.enrichContactDetails as boolean | undefined;
  if (enrichContactDetails != null) {
    actorInput.enrichContactDetails = enrichContactDetails;
  }

  const maxCrawledPlacesPerSearch =
    typeof userConfig.maxCrawledPlacesPerSearch === "number"
      ? userConfig.maxCrawledPlacesPerSearch
      : undefined;
  if (maxCrawledPlacesPerSearch != null) {
    actorInput.maxCrawledPlacesPerSearch = maxCrawledPlacesPerSearch;
  }

  // ── Effective result count ──────────────────────────────────────────
  const perSearch = maxCrawledPlacesPerSearch ?? 50;
  const searchCount = searchStringsArray?.length || 1;
  let effectiveResultCount = perSearch * searchCount;

  if (includeReviews === true) {
    effectiveResultCount = Math.ceil(effectiveResultCount * 1.5);
  }

  return { actorInput, effectiveResultCount, warnings };
};
