import type { ToolMapper } from "./types";

/**
 * Mapper for Contact Extractor (apify/contact-info-scraper).
 *
 * Transforms user-facing config into the Apify actor input format.
 * - effectiveResultCount = startUrls.length * maxPagesPerDomain
 */
export const mapContactExtractorConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const actorInput: Record<string, unknown> = { ...catalogDefaults };
  const warnings: string[] = [];

  // ── Pass-through fields ─────────────────────────────────────────────
  const startUrls = userConfig.startUrls as string[] | undefined;
  if (startUrls != null) {
    actorInput.startUrls = startUrls;
  }

  const maxDepth = userConfig.maxDepth as number | undefined;
  if (maxDepth != null) {
    actorInput.maxDepth = maxDepth;
  }

  const maxPagesPerDomain =
    typeof userConfig.maxPagesPerDomain === "number"
      ? userConfig.maxPagesPerDomain
      : undefined;
  if (maxPagesPerDomain != null) {
    actorInput.maxPagesPerDomain = maxPagesPerDomain;
  }

  const sameDomain = userConfig.sameDomain as boolean | undefined;
  if (sameDomain != null) {
    actorInput.sameDomain = sameDomain;
  }

  // ── Effective result count ──────────────────────────────────────────
  const urlCount = startUrls?.length ?? 1;
  const pagesPerDomain = maxPagesPerDomain ?? 20;
  const effectiveResultCount = urlCount * pagesPerDomain;

  return { actorInput, effectiveResultCount, warnings };
};
