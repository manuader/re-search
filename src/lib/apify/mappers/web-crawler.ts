import type { ToolMapper } from "./types";

/**
 * Mapper for Web Crawler (apify/web-scraper).
 *
 * Transforms user-facing config into the Apify actor input format.
 */
export const mapWebCrawlerConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const actorInput: Record<string, unknown> = { ...catalogDefaults };
  const warnings: string[] = [];

  // ── Pass-through fields ─────────────────────────────────────────────
  const startUrls = userConfig.startUrls as string[] | undefined;
  if (startUrls != null) {
    actorInput.startUrls = startUrls;
  }

  const crawlerType = userConfig.crawlerType as string | undefined;
  if (crawlerType != null) {
    actorInput.crawlerType = crawlerType;
  }

  const maxCrawlDepth = userConfig.maxCrawlDepth as number | undefined;
  if (maxCrawlDepth != null) {
    actorInput.maxCrawlDepth = maxCrawlDepth;
  }

  const maxCrawlPages =
    typeof userConfig.maxCrawlPages === "number"
      ? userConfig.maxCrawlPages
      : undefined;
  if (maxCrawlPages != null) {
    actorInput.maxCrawlPages = maxCrawlPages;
  }

  // ── Effective result count ──────────────────────────────────────────
  const effectiveResultCount = maxCrawlPages ?? 50;

  return { actorInput, effectiveResultCount, warnings };
};
