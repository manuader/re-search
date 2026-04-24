import type { ToolMapper } from "./types";

/**
 * Mapper for Instagram (apify/instagram-scraper).
 *
 * Transforms user-facing config into the Apify actor input format.
 */
export const mapInstagramConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const actorInput: Record<string, unknown> = { ...catalogDefaults };
  const warnings: string[] = [];

  // ── Pass-through fields ─────────────────────────────────────────────
  const directUrls = userConfig.directUrls as string[] | undefined;
  if (directUrls != null) {
    actorInput.directUrls = directUrls;
  }

  const search = userConfig.search as string | undefined;
  if (search != null) {
    actorInput.search = search;
  }

  const searchType = userConfig.searchType as string | undefined;
  if (searchType != null) {
    actorInput.searchType = searchType;
  }

  const resultsType = userConfig.resultsType as string | undefined;
  if (resultsType != null) {
    actorInput.resultsType = resultsType;
  }

  const addParentData = userConfig.addParentData as boolean | undefined;
  if (addParentData != null) {
    actorInput.addParentData = addParentData;
  }

  const resultsLimit =
    typeof userConfig.resultsLimit === "number"
      ? userConfig.resultsLimit
      : undefined;
  if (resultsLimit != null) {
    actorInput.resultsLimit = resultsLimit;
  }

  const searchLimit = userConfig.searchLimit as number | undefined;
  if (searchLimit != null) {
    actorInput.searchLimit = searchLimit;
  }

  // ── Effective result count ──────────────────────────────────────────
  const effectiveResultCount = resultsLimit ?? 50;

  return { actorInput, effectiveResultCount, warnings };
};
