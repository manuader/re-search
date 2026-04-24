import type { ToolMapper } from "./types";

/**
 * Mapper for Amazon Products (junglee/amazon-crawler).
 *
 * Transforms user-facing config into the Apify actor input format.
 */
export const mapAmazonProductsConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const actorInput: Record<string, unknown> = { ...catalogDefaults };
  const warnings: string[] = [];

  // ── Pass-through fields ─────────────────────────────────────────────
  const keyword = userConfig.keyword as string | undefined;
  if (keyword != null) {
    actorInput.keyword = keyword;
  }

  const country = userConfig.country as string | undefined;
  if (country != null) {
    actorInput.country = country;
  }

  const includeDescription = userConfig.includeDescription as boolean | undefined;
  if (includeDescription != null) {
    actorInput.includeDescription = includeDescription;
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
