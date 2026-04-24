import type { ToolMapper } from "./types";

/**
 * Mapper for LinkedIn Profiles (bebity/linkedin-profile-scraper).
 *
 * Transforms user-facing config into the Apify actor input format.
 */
export const mapLinkedinProfilesConfig: ToolMapper = (ctx) => {
  const { userConfig, catalogDefaults } = ctx;
  const actorInput: Record<string, unknown> = { ...catalogDefaults };
  const warnings: string[] = [];

  // ── Pass-through fields ─────────────────────────────────────────────
  const profileUrls = userConfig.profileUrls as string[] | undefined;
  if (profileUrls != null) {
    actorInput.profileUrls = profileUrls;
  }

  const includeSkills = userConfig.includeSkills as boolean | undefined;
  if (includeSkills != null) {
    actorInput.includeSkills = includeSkills;
  }

  const includeExperience = userConfig.includeExperience as boolean | undefined;
  if (includeExperience != null) {
    actorInput.includeExperience = includeExperience;
  }

  const maxItems =
    typeof userConfig.maxItems === "number" ? userConfig.maxItems : undefined;
  if (maxItems != null) {
    actorInput.maxItems = maxItems;
  }

  // ── Effective result count ──────────────────────────────────────────
  const effectiveResultCount = maxItems ?? 25;

  return { actorInput, effectiveResultCount, warnings };
};
