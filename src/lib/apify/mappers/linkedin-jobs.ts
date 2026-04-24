import type { ToolMapper } from "./types";

/**
 * Mapper for LinkedIn Jobs (bebity/linkedin-jobs-scraper).
 *
 * Transforms user-facing config into the Apify actor input format.
 * - location only included if truthy
 */
export const mapLinkedinJobsConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const actorInput: Record<string, unknown> = { ...catalogDefaults };
  const warnings: string[] = [];

  // ── Pass-through fields ─────────────────────────────────────────────
  const searchUrl = userConfig.searchUrl as string | undefined;
  if (searchUrl != null) {
    actorInput.searchUrl = searchUrl;
  }

  // location — only if truthy
  const location = userConfig.location as string | undefined;
  if (location) {
    actorInput.location = location;
  }

  const scrapeCompany = userConfig.scrapeCompany as boolean | undefined;
  if (scrapeCompany != null) {
    actorInput.scrapeCompany = scrapeCompany;
  }

  const maxItems =
    typeof userConfig.maxItems === "number" ? userConfig.maxItems : undefined;
  if (maxItems != null) {
    actorInput.maxItems = maxItems;
  }

  // ── Effective result count ──────────────────────────────────────────
  const effectiveResultCount = maxItems ?? 50;

  return { actorInput, effectiveResultCount, warnings };
};
