import type { ToolMapper } from "./types";

/**
 * Mapper for TripAdvisor (maxcopell/tripadvisor).
 *
 * Transforms user-facing config into the Apify actor input format.
 * - checkInDate / checkOutDate only included if truthy
 * - Warns if checkOutDate < checkInDate
 */
export const mapTripadvisorConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const actorInput: Record<string, unknown> = { ...catalogDefaults };
  const warnings: string[] = [];

  // ── Pass-through fields ─────────────────────────────────────────────
  const startUrls = userConfig.startUrls as string[] | undefined;
  if (startUrls != null) {
    actorInput.startUrls = startUrls;
  }

  const query = userConfig.query as string | undefined;
  if (query != null) {
    actorInput.query = query;
  }

  const includeAttractions = userConfig.includeAttractions as boolean | undefined;
  if (includeAttractions != null) {
    actorInput.includeAttractions = includeAttractions;
  }

  const includeRestaurants = userConfig.includeRestaurants as boolean | undefined;
  if (includeRestaurants != null) {
    actorInput.includeRestaurants = includeRestaurants;
  }

  const includeHotels = userConfig.includeHotels as boolean | undefined;
  if (includeHotels != null) {
    actorInput.includeHotels = includeHotels;
  }

  const includeTags = userConfig.includeTags as boolean | undefined;
  if (includeTags != null) {
    actorInput.includeTags = includeTags;
  }

  const language = userConfig.language as string | undefined;
  if (language != null) {
    actorInput.language = language;
  }

  const currency = userConfig.currency as string | undefined;
  if (currency != null) {
    actorInput.currency = currency;
  }

  // checkInDate / checkOutDate — only if truthy
  const checkInDate = userConfig.checkInDate as string | undefined;
  if (checkInDate) {
    actorInput.checkInDate = checkInDate;
  }

  const checkOutDate = userConfig.checkOutDate as string | undefined;
  if (checkOutDate) {
    actorInput.checkOutDate = checkOutDate;
  }

  const maxItems =
    typeof userConfig.maxItems === "number" ? userConfig.maxItems : undefined;
  if (maxItems != null) {
    actorInput.maxItems = maxItems;
  }

  // ── Effective result count ──────────────────────────────────────────
  const effectiveResultCount = maxItems ?? 50;

  // ── Warnings ────────────────────────────────────────────────────────
  if (checkInDate && checkOutDate && checkOutDate < checkInDate) {
    warnings.push("Check-out date is before check-in date");
  }

  return { actorInput, effectiveResultCount, warnings };
};
