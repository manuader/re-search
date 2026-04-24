import type { ToolSchema } from "../tool-schema";
import { contactExtractorSchema } from "./contact-extractor";
import { googleMapsReviewsSchema } from "./google-maps-reviews";
import { googleSearchSchema } from "./google-search";
import { linkedinJobsSchema } from "./linkedin-jobs";
import { linkedinProfilesSchema } from "./linkedin-profiles";
import { redditSchema } from "./reddit";
import { tweetsSchema } from "./tweets";
import { twitterSchema } from "./twitter";
import { googleMapsSchema } from "./google-maps";
import { instagramSchema } from "./instagram";
import { tripadvisorSchema } from "./tripadvisor";
import { amazonProductsSchema } from "./amazon-products";
import { webCrawlerSchema } from "./web-crawler";

/**
 * Registry of all tool schemas, keyed by catalog tool ID.
 * Tools not listed here use the legacy catalog inputSchema (backward compat).
 */
const toolSchemas: Record<string, ToolSchema> = {
  twitter: twitterSchema,
  tweets: tweetsSchema,
  "contact-extractor": contactExtractorSchema,
  "google-maps-reviews": googleMapsReviewsSchema,
  "google-search": googleSearchSchema,
  "linkedin-jobs": linkedinJobsSchema,
  "linkedin-profiles": linkedinProfilesSchema,
  reddit: redditSchema,
  "google-maps": googleMapsSchema,
  instagram: instagramSchema,
  tripadvisor: tripadvisorSchema,
  "amazon-products": amazonProductsSchema,
  "web-crawler": webCrawlerSchema,
};

/** Get the rich schema for a tool, or undefined if it uses legacy config. */
export function getToolSchema(toolId: string): ToolSchema | undefined {
  return toolSchemas[toolId];
}

/** Check if a tool has a rich schema (vs. legacy catalog-only config). */
export function hasToolSchema(toolId: string): boolean {
  return toolId in toolSchemas;
}

/** Get all registered tool IDs that have schemas. */
export function getSchemaToolIds(): string[] {
  return Object.keys(toolSchemas);
}
