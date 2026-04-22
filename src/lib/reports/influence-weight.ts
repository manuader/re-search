// ---------------------------------------------------------------------------
// Report Pipeline — Source Type Mapping + Influence Weight + Field Extraction
// ---------------------------------------------------------------------------

import type { SourceType, EngagementRaw } from "./types";

// ---------------------------------------------------------------------------
// Source type mapping
// ---------------------------------------------------------------------------

const TOOL_SOURCE_MAP: Record<string, SourceType> = {
  // Catalog IDs
  "google-maps": "google_maps_places",
  "google-maps-reviews": "google_maps_reviews",
  twitter: "twitter",
  tweets: "twitter",
  reddit: "reddit",
  instagram: "instagram",
  tripadvisor: "tripadvisor",
  "amazon-products": "amazon",
  "linkedin-jobs": "linkedin",
  "linkedin-profiles": "linkedin",
  "google-search": "generic",
  "web-crawler": "generic",
  "contact-extractor": "generic",
};

// Display name fallbacks (English)
const DISPLAY_NAME_MAP: Record<string, SourceType> = {
  "google maps places": "google_maps_places",
  "google maps reviews": "google_maps_reviews",
  "twitter/x search": "twitter",
  "tweet collector": "twitter",
  "reddit scraper": "reddit",
  "instagram scraper": "instagram",
  "tripadvisor scraper": "tripadvisor",
  "amazon product scraper": "amazon",
  "linkedin jobs scraper": "linkedin",
  "linkedin profile scraper": "linkedin",
  "google search": "generic",
  "website content crawler": "generic",
  "contact info extractor": "generic",
};

export function mapToolNameToSourceType(toolName: string): SourceType {
  if (!toolName) return "generic";
  // Try direct catalog ID match
  const direct = TOOL_SOURCE_MAP[toolName.toLowerCase()];
  if (direct) return direct;
  // Try display name match
  const display = DISPLAY_NAME_MAP[toolName.toLowerCase()];
  if (display) return display;
  // Fuzzy keyword match
  const lower = toolName.toLowerCase();
  if (lower.includes("tweet") || lower.includes("twitter")) return "twitter";
  if (lower.includes("instagram")) return "instagram";
  if (lower.includes("reddit")) return "reddit";
  if (lower.includes("linkedin")) return "linkedin";
  if (lower.includes("tripadvisor")) return "tripadvisor";
  if (lower.includes("amazon")) return "amazon";
  if (lower.includes("review")) return "google_maps_reviews";
  if (lower.includes("google") && lower.includes("map")) return "google_maps_places";
  return "generic";
}

// ---------------------------------------------------------------------------
// Influence weight computation
// ---------------------------------------------------------------------------

const log10 = (x: number) => Math.log10(Math.max(x, 1));
const num = (v: unknown): number =>
  typeof v === "number" && isFinite(v) ? v : 0;

export function computeInfluenceWeight(
  source: SourceType,
  item: Record<string, unknown>
): number {
  switch (source) {
    case "twitter":
      return log10(
        Math.max(
          num(item.views),
          num(item.likeCount) * 10 +
            num(item.retweetCount) * 25 +
            num(item.replyCount) * 15,
          1
        )
      );
    case "instagram":
      return log10(
        Math.max(
          num(item.likesCount) * 10 + num(item.commentsCount) * 15,
          1
        )
      );
    case "reddit":
      return log10(
        1 + Math.abs(num(item.score)) + num(item.numComments) * 5
      );
    case "linkedin":
      return log10(
        1 +
          num(item.followers ?? item.connectionsCount) +
          num(item.reactions ?? item.applicantsCount) * 5
      );
    case "google_maps_reviews":
    case "tripadvisor":
      return (
        (1 + log10(1 + num(item.helpful ?? item.helpfulVotes))) *
        Math.min(
          2,
          (typeof item.reviewText === "string"
            ? item.reviewText.length
            : typeof item.text === "string"
              ? item.text.length
              : 0) / 200
        )
      );
    case "google_maps_places":
      return (
        log10(1 + num(item.reviewsCount)) *
        (num(item.totalScore) > 0 ? 1 : 0.5)
      );
    case "amazon":
      return (
        log10(1 + num(item.reviewsCount)) *
        (num(item.rating) > 0 ? 1 : 0.5)
      );
    default:
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Primary engagement (raw, not log-transformed)
// ---------------------------------------------------------------------------

export function extractPrimaryEngagement(
  source: SourceType,
  item: Record<string, unknown>
): number {
  switch (source) {
    case "twitter":
      return (
        num(item.likeCount) +
        num(item.retweetCount) +
        num(item.replyCount)
      );
    case "instagram":
      return num(item.likesCount) + num(item.commentsCount);
    case "reddit":
      return Math.abs(num(item.score)) + num(item.numComments);
    case "linkedin":
      return num(item.applicantsCount ?? item.reactions);
    case "google_maps_reviews":
      return num(item.stars);
    case "google_maps_places":
      return num(item.totalScore) * num(item.reviewsCount);
    case "tripadvisor":
      return num(item.rating) * num(item.reviewsCount);
    case "amazon":
      return num(item.rating) * num(item.reviewsCount);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Engagement raw fields (for SampleItem)
// ---------------------------------------------------------------------------

export function extractEngagementRaw(
  source: SourceType,
  item: Record<string, unknown>
): EngagementRaw {
  const raw: EngagementRaw = {};
  switch (source) {
    case "twitter":
      raw.likes = num(item.likeCount);
      raw.reposts = num(item.retweetCount);
      raw.comments = num(item.replyCount);
      if (item.views !== undefined) raw.views = num(item.views);
      break;
    case "instagram":
      raw.likes = num(item.likesCount);
      raw.comments = num(item.commentsCount);
      break;
    case "reddit":
      raw.score = num(item.score);
      raw.comments = num(item.numComments);
      break;
    case "linkedin":
      if (item.applicantsCount !== undefined)
        raw.views = num(item.applicantsCount);
      break;
    case "google_maps_reviews":
      raw.rating = num(item.stars);
      break;
    case "google_maps_places":
      raw.rating = num(item.totalScore);
      raw.reviewCount = num(item.reviewsCount);
      break;
    case "tripadvisor":
      raw.rating = num(item.rating);
      raw.reviewCount = num(item.reviewsCount);
      break;
    case "amazon":
      raw.rating = num(item.rating);
      raw.reviewCount = num(item.reviewsCount);
      break;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Content snippet extraction
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export function extractContentSnippet(
  source: SourceType,
  item: Record<string, unknown>
): string {
  let text: string | undefined;

  switch (source) {
    case "twitter":
      text = item.text as string | undefined;
      break;
    case "instagram":
      text = item.caption as string | undefined;
      break;
    case "reddit":
      text = (item.body as string | undefined) || (item.title as string | undefined);
      break;
    case "google_maps_reviews":
      text = item.reviewText as string | undefined;
      break;
    case "google_maps_places":
      text = item.title as string | undefined;
      break;
    case "tripadvisor":
      text = item.name as string | undefined;
      break;
    case "linkedin": {
      const title = item.title as string | undefined;
      const desc = item.description as string | undefined;
      text = title && desc ? `${title} — ${desc}` : title || desc;
      break;
    }
    case "amazon":
      text = item.title as string | undefined;
      break;
    default:
      // Find first string field
      for (const v of Object.values(item)) {
        if (typeof v === "string" && v.length > 10) {
          text = v;
          break;
        }
      }
  }

  return truncate(text ?? "", 280);
}

// ---------------------------------------------------------------------------
// Date extraction
// ---------------------------------------------------------------------------

export function extractDate(
  source: SourceType,
  item: Record<string, unknown>
): string | null {
  let raw: unknown;

  switch (source) {
    case "twitter":
      raw = item.createdAt;
      break;
    case "instagram":
      raw = item.timestamp;
      break;
    case "reddit":
      raw = item.createdAt;
      break;
    case "google_maps_reviews":
      raw = item.publishedAtDate;
      break;
    case "linkedin":
      raw = item.postedAt;
      break;
    default:
      raw = item.createdAt ?? item.date ?? item.timestamp ?? item.publishedAt;
  }

  if (!raw) return null;
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof raw === "number") {
    // Unix timestamp (seconds or milliseconds)
    const ts = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Author extraction
// ---------------------------------------------------------------------------

export function extractAuthor(
  source: SourceType,
  item: Record<string, unknown>
): string | null {
  let v: unknown;
  switch (source) {
    case "twitter":
      v = item.authorUsername ?? item.authorName;
      break;
    case "instagram":
      v = item.ownerUsername;
      break;
    case "reddit":
      v = item.author;
      break;
    case "google_maps_reviews":
      v = item.authorName;
      break;
    case "linkedin":
      v = item.companyName;
      break;
    case "amazon":
      v = item.brand;
      break;
    default:
      v = item.author ?? item.authorName ?? item.username;
  }
  return typeof v === "string" ? v : null;
}

// ---------------------------------------------------------------------------
// URL extraction
// ---------------------------------------------------------------------------

export function extractUrl(
  source: SourceType,
  item: Record<string, unknown>
): string | null {
  const v = item.url ?? item.reviewUrl ?? item.jobUrl ?? item.profileUrl;
  return typeof v === "string" ? v : null;
}

// ---------------------------------------------------------------------------
// Primary engagement metric name (for display)
// ---------------------------------------------------------------------------

export function primaryMetricName(source: SourceType): string {
  switch (source) {
    case "twitter":
      return "likes+retweets+replies";
    case "instagram":
      return "likes+comments";
    case "reddit":
      return "score+comments";
    case "linkedin":
      return "applicants";
    case "google_maps_reviews":
      return "stars";
    case "google_maps_places":
      return "score×reviews";
    case "tripadvisor":
    case "amazon":
      return "rating×reviews";
    default:
      return "engagement";
  }
}
