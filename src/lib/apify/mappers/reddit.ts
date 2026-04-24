import type { ToolMapper } from "./types";

/**
 * Mapper for Reddit (trudax/reddit-scraper).
 *
 * Transforms user-facing config into the Apify actor input format.
 * - time is only included when sort === "top" AND time is set
 * - searchCommunityName / postDateLimit only included when truthy
 * - Warns if skipComments is true while searchComments is also true
 */
export const mapRedditConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const merged = { ...catalogDefaults, ...userConfig };

  const searches = merged.searches as string[] | undefined;
  const searchCommunityName = merged.searchCommunityName as string | undefined;
  const searchPosts = merged.searchPosts as boolean | undefined;
  const searchComments = merged.searchComments as boolean | undefined;
  const sort = (merged.sort as string | undefined) ?? "hot";
  const time = merged.time as string | undefined;
  const postDateLimit = merged.postDateLimit as string | undefined;
  const maxItems = (merged.maxItems as number | undefined) ?? 100;
  const maxComments = merged.maxComments as number | undefined;
  const includeNSFW = merged.includeNSFW as boolean | undefined;
  const skipComments = merged.skipComments as boolean | undefined;

  const actorInput: Record<string, unknown> = {};
  const warnings: string[] = [];

  if (searches != null) {
    actorInput.searches = searches;
  }

  // searchCommunityName — only if truthy
  if (searchCommunityName) {
    actorInput.searchCommunityName = searchCommunityName;
  }

  if (searchPosts != null) {
    actorInput.searchPosts = searchPosts;
  }

  if (searchComments != null) {
    actorInput.searchComments = searchComments;
  }

  actorInput.sort = sort;

  // time — only when sort === "top" AND time is set
  if (sort === "top" && time) {
    actorInput.time = time;
  }

  // postDateLimit — only if truthy
  if (postDateLimit) {
    actorInput.postDateLimit = postDateLimit;
  }

  actorInput.maxItems = maxItems;

  if (maxComments != null) {
    actorInput.maxComments = maxComments;
  }

  if (includeNSFW != null) {
    actorInput.includeNSFW = includeNSFW;
  }

  if (skipComments != null) {
    actorInput.skipComments = skipComments;
  }

  // Warn about contradictory comment settings
  if (skipComments === true && searchComments === true) {
    warnings.push(
      "skipComments is enabled but searchComments is also enabled. Comments will be searched but not included in results."
    );
  }

  return {
    actorInput,
    effectiveResultCount: maxItems,
    warnings,
  };
};
