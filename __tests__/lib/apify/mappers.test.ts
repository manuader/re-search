import { describe, it, expect } from "vitest";
import { mapTwitterConfig } from "@/lib/apify/mappers/twitter";
import { mapGoogleMapsReviewsConfig } from "@/lib/apify/mappers/google-maps-reviews";
import { mapGoogleSearchConfig } from "@/lib/apify/mappers/google-search";
import { mapRedditConfig } from "@/lib/apify/mappers/reddit";
import { defaultMapper, getMapper } from "@/lib/apify/mappers";
import {
  getAllParams,
  getChatbotParams,
  getSchemaDefaults,
  validateConfig,
} from "@/lib/apify/tool-schema";
import { twitterSchema } from "@/lib/apify/schemas/twitter";
import { googleMapsReviewsSchema } from "@/lib/apify/schemas/google-maps-reviews";
import { googleSearchSchema } from "@/lib/apify/schemas/google-search";
import { redditSchema } from "@/lib/apify/schemas/reddit";
import { getToolSchema } from "@/lib/apify/schemas";
import type { MapperContext } from "@/lib/apify/mappers/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(
  userConfig: Record<string, unknown> = {},
  catalogDefaults: Record<string, unknown> = {}
): MapperContext {
  return { locale: "en", userConfig, catalogDefaults };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Schema Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

describe("getAllParams", () => {
  it("returns all params from all groups", () => {
    const params = getAllParams(twitterSchema);
    expect(params.length).toBeGreaterThanOrEqual(15);
    expect(params.some((p) => p.id === "searchTerms")).toBe(true);
    expect(params.some((p) => p.id === "maxItems")).toBe(true);
    expect(params.some((p) => p.id === "tweetLanguage")).toBe(true);
    expect(params.some((p) => p.id === "minimumFavorites")).toBe(true);
  });

  it("returns params from all 4 schemas", () => {
    expect(getAllParams(googleMapsReviewsSchema).length).toBeGreaterThanOrEqual(7);
    expect(getAllParams(googleSearchSchema).length).toBeGreaterThanOrEqual(5);
    expect(getAllParams(redditSchema).length).toBeGreaterThanOrEqual(9);
  });
});

describe("getChatbotParams", () => {
  it("returns only critical + high importance, non-advanced params", () => {
    const params = getChatbotParams(twitterSchema);
    for (const p of params) {
      expect(["critical", "high"]).toContain(p.importance);
      expect(p.advanced).toBe(false);
    }
    // searchTerms (critical), maxItems (critical), tweetLanguage (high), dateRange (high) should be included
    expect(params.some((p) => p.id === "searchTerms")).toBe(true);
    expect(params.some((p) => p.id === "maxItems")).toBe(true);
    expect(params.some((p) => p.id === "tweetLanguage")).toBe(true);
    expect(params.some((p) => p.id === "dateRange")).toBe(true);
  });

  it("excludes medium/low and advanced params", () => {
    const params = getChatbotParams(twitterSchema);
    // onlyImage is medium+advanced, should not be included
    expect(params.some((p) => p.id === "onlyImage")).toBe(false);
    // minimumRetweets is medium, should not be included
    expect(params.some((p) => p.id === "minimumRetweets")).toBe(false);
    // geotaggedNear is medium+advanced
    expect(params.some((p) => p.id === "geotaggedNear")).toBe(false);
  });
});

describe("getSchemaDefaults", () => {
  it("returns defaults for params with defined defaultValue", () => {
    const defaults = getSchemaDefaults(twitterSchema);
    expect(defaults.maxItems).toBe(100);
    expect(defaults.sort).toBe("Latest");
    expect(defaults.onlyVerifiedUsers).toBe(false);
  });

  it("omits params where defaultValue is undefined", () => {
    const defaults = getSchemaDefaults(twitterSchema);
    expect("dateRange" in defaults).toBe(false);
    expect("tweetLanguage" in defaults).toBe(false);
    expect("minimumRetweets" in defaults).toBe(false);
  });

  it("includes array defaults", () => {
    const defaults = getSchemaDefaults(twitterSchema);
    expect(defaults.searchTerms).toEqual([]);
  });
});

describe("validateConfig", () => {
  it("returns error for missing required fields", () => {
    const errors = validateConfig(twitterSchema, {});
    expect(errors.some((e) => e.includes("searchTerms"))).toBe(true);
    expect(errors.some((e) => e.includes("maxItems"))).toBe(true);
  });

  it("returns no errors for valid config", () => {
    const errors = validateConfig(twitterSchema, {
      searchTerms: ["test"],
      maxItems: 100,
    });
    expect(errors).toEqual([]);
  });

  it("validates number min/max", () => {
    const errors = validateConfig(twitterSchema, {
      searchTerms: ["test"],
      maxItems: 0,
    });
    expect(errors.some((e) => e.includes("maxItems") && e.includes("at least"))).toBe(true);
  });

  it("validates enum values", () => {
    const errors = validateConfig(twitterSchema, {
      searchTerms: ["test"],
      maxItems: 100,
      sort: "Invalid",
    });
    expect(errors.some((e) => e.includes("sort") && e.includes("one of"))).toBe(true);
  });

  it("runs cross-validation on twitter schema", () => {
    const errors = validateConfig(twitterSchema, {
      searchTerms: ["test"],
      maxItems: 100,
      dateRange: { start: "2026-06-01", end: "2026-01-01" },
    });
    expect(errors.some((e) => e.toLowerCase().includes("date") || e.toLowerCase().includes("start"))).toBe(true);
  });

  it("runs cross-validation on google-maps-reviews schema", () => {
    const errors = validateConfig(googleMapsReviewsSchema, {
      maxReviews: 100,
      // placeUrls and placeIds both empty/missing
    });
    expect(errors.some((e) => e.toLowerCase().includes("place") || e.toLowerCase().includes("url"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Schema Registry
// ═══════════════════════════════════════════════════════════════════════════════

describe("getToolSchema", () => {
  it("returns schema for registered tools", () => {
    expect(getToolSchema("twitter")).toBeDefined();
    expect(getToolSchema("tweets")).toBeDefined();
    expect(getToolSchema("google-maps-reviews")).toBeDefined();
    expect(getToolSchema("google-search")).toBeDefined();
    expect(getToolSchema("reddit")).toBeDefined();
  });

  it("returns undefined for nonexistent tools", () => {
    expect(getToolSchema("nonexistent")).toBeUndefined();
    expect(getToolSchema("")).toBeUndefined();
  });

  it("all 13 catalog tools have schemas", () => {
    const catalogIds = ["twitter", "tweets", "google-maps-reviews", "google-search",
      "reddit", "google-maps", "instagram", "tripadvisor", "amazon-products",
      "web-crawler", "contact-extractor", "linkedin-jobs", "linkedin-profiles"];
    for (const id of catalogIds) {
      expect(getToolSchema(id), `${id} should have a schema`).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Mapper Registry
// ═══════════════════════════════════════════════════════════════════════════════

describe("getMapper", () => {
  it("returns mapper for registered tools", () => {
    expect(getMapper("twitter")).toBeDefined();
    expect(getMapper("tweets")).toBeDefined();
    expect(getMapper("google-maps-reviews")).toBeDefined();
    expect(getMapper("google-search")).toBeDefined();
    expect(getMapper("reddit")).toBeDefined();
  });

  it("returns undefined for nonexistent tools", () => {
    expect(getMapper("nonexistent")).toBeUndefined();
    expect(getMapper("")).toBeUndefined();
  });

  it("twitter and tweets share the same mapper", () => {
    expect(getMapper("twitter")).toBe(getMapper("tweets"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Twitter Mapper
// ═══════════════════════════════════════════════════════════════════════════════

describe("mapTwitterConfig", () => {
  const TWITTER_DEFAULTS = {
    searchTerms: [],
    maxItems: 100,
    sort: "Latest",
    onlyVerifiedUsers: false,
  };

  it("merges catalog defaults with user config", () => {
    const result = mapTwitterConfig(
      makeCtx({ searchTerms: ["milei"] }, TWITTER_DEFAULTS)
    );
    expect(result.actorInput.searchTerms).toEqual(["milei"]);
    expect(result.actorInput.sort).toBe("Latest");
    expect(result.actorInput.onlyVerifiedUsers).toBe(false);
  });

  it("maps dateRange to separate start/end fields", () => {
    const result = mapTwitterConfig(
      makeCtx(
        { searchTerms: ["test"], dateRange: { start: "2026-01-01", end: "2026-03-01" } },
        TWITTER_DEFAULTS
      )
    );
    expect(result.actorInput.start).toBe("2026-01-01");
    expect(result.actorInput.end).toBe("2026-03-01");
    expect(result.actorInput.dateRange).toBeUndefined();
  });

  it("handles dateRange with only start", () => {
    const result = mapTwitterConfig(
      makeCtx(
        { searchTerms: ["test"], dateRange: { start: "2026-01-01" } },
        TWITTER_DEFAULTS
      )
    );
    expect(result.actorInput.start).toBe("2026-01-01");
    expect(result.actorInput.end).toBeUndefined();
  });

  it("passes through engagement filters", () => {
    const result = mapTwitterConfig(
      makeCtx(
        { searchTerms: ["test"], minimumRetweets: 10, minimumFavorites: 50 },
        TWITTER_DEFAULTS
      )
    );
    expect(result.actorInput.minimumRetweets).toBe(10);
    expect(result.actorInput.minimumFavorites).toBe(50);
  });

  it("passes through language filter", () => {
    const result = mapTwitterConfig(
      makeCtx({ searchTerms: ["test"], tweetLanguage: "es" }, TWITTER_DEFAULTS)
    );
    expect(result.actorInput.tweetLanguage).toBe("es");
  });

  it("passes through geo fields", () => {
    const result = mapTwitterConfig(
      makeCtx(
        { searchTerms: ["test"], geotaggedNear: "Buenos Aires", withinRadius: "50km" },
        TWITTER_DEFAULTS
      )
    );
    expect(result.actorInput.geotaggedNear).toBe("Buenos Aires");
    expect(result.actorInput.withinRadius).toBe("50km");
  });

  it("warns when geo location set without radius", () => {
    const result = mapTwitterConfig(
      makeCtx(
        { searchTerms: ["test"], geotaggedNear: "Buenos Aires" },
        TWITTER_DEFAULTS
      )
    );
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("radius");
  });

  it("warns when date start is after end", () => {
    const result = mapTwitterConfig(
      makeCtx(
        { searchTerms: ["test"], dateRange: { start: "2026-06-01", end: "2026-01-01" } },
        TWITTER_DEFAULTS
      )
    );
    expect(result.warnings.some((w) => w.toLowerCase().includes("date"))).toBe(true);
  });

  it("does not warn for valid date range", () => {
    const result = mapTwitterConfig(
      makeCtx(
        { searchTerms: ["test"], dateRange: { start: "2026-01-01", end: "2026-06-01" } },
        TWITTER_DEFAULTS
      )
    );
    expect(result.warnings).toEqual([]);
  });

  it("calculates effectiveResultCount from maxItems", () => {
    const result = mapTwitterConfig(
      makeCtx({ searchTerms: ["test"], maxItems: 500 }, TWITTER_DEFAULTS)
    );
    expect(result.effectiveResultCount).toBe(500);
  });

  it("defaults effectiveResultCount to 100", () => {
    const result = mapTwitterConfig(
      makeCtx({ searchTerms: ["test"] }, TWITTER_DEFAULTS)
    );
    expect(result.effectiveResultCount).toBe(100);
  });

  it("ignores undefined/null values", () => {
    const result = mapTwitterConfig(
      makeCtx(
        { searchTerms: ["test"], author: undefined, mentioning: null },
        TWITTER_DEFAULTS
      )
    );
    expect("author" in result.actorInput).toBe(false);
    expect("mentioning" in result.actorInput).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Google Maps Reviews Mapper
// ═══════════════════════════════════════════════════════════════════════════════

describe("mapGoogleMapsReviewsConfig", () => {
  const REVIEWS_DEFAULTS = {
    placeUrls: [],
    maxReviews: 100,
    language: "en",
    sort: "mostRelevant",
  };

  it("maps placeUrls to startUrls", () => {
    const urls = ["https://maps.google.com/place/123"];
    const result = mapGoogleMapsReviewsConfig(
      makeCtx({ placeUrls: urls }, REVIEWS_DEFAULTS)
    );
    expect(result.actorInput.startUrls).toEqual(urls);
  });

  it("maps reviewsSort directly", () => {
    const result = mapGoogleMapsReviewsConfig(
      makeCtx({ placeUrls: ["url"], reviewsSort: "newest" }, REVIEWS_DEFAULTS)
    );
    expect(result.actorInput.reviewsSort).toBe("newest");
  });

  it("maps reviewsStartDate directly", () => {
    const result = mapGoogleMapsReviewsConfig(
      makeCtx(
        { placeUrls: ["url"], reviewsStartDate: "3 months" },
        REVIEWS_DEFAULTS
      )
    );
    expect(result.actorInput.reviewsStartDate).toBe("3 months");
  });

  it("includes placeIds only when non-empty", () => {
    const result1 = mapGoogleMapsReviewsConfig(
      makeCtx({ placeUrls: ["url"], placeIds: [] }, REVIEWS_DEFAULTS)
    );
    // placeIds should be absent or empty
    const hasPlaceIds1 =
      "placeIds" in result1.actorInput &&
      Array.isArray(result1.actorInput.placeIds) &&
      (result1.actorInput.placeIds as unknown[]).length > 0;
    expect(hasPlaceIds1).toBe(false);

    const result2 = mapGoogleMapsReviewsConfig(
      makeCtx(
        { placeUrls: ["url"], placeIds: ["ChIJ123"] },
        REVIEWS_DEFAULTS
      )
    );
    expect(result2.actorInput.placeIds).toEqual(["ChIJ123"]);
  });

  it("calculates effectiveResultCount from maxReviews", () => {
    const result = mapGoogleMapsReviewsConfig(
      makeCtx({ placeUrls: ["url"], maxReviews: 500 }, REVIEWS_DEFAULTS)
    );
    expect(result.effectiveResultCount).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Google Search Mapper
// ═══════════════════════════════════════════════════════════════════════════════

describe("mapGoogleSearchConfig", () => {
  const SEARCH_DEFAULTS = {
    queries: [],
    maxPagesPerQuery: 1,
    countryCode: "us",
    languageCode: "en",
  };

  it("passes queries as array", () => {
    const result = mapGoogleSearchConfig(
      makeCtx({ queries: ["best restaurants", "top cafes"] }, SEARCH_DEFAULTS)
    );
    expect(result.actorInput.queries).toEqual(["best restaurants", "top cafes"]);
  });

  it("passes countryCode and languageCode", () => {
    const result = mapGoogleSearchConfig(
      makeCtx(
        { queries: ["test"], countryCode: "es", languageCode: "es" },
        SEARCH_DEFAULTS
      )
    );
    expect(result.actorInput.countryCode).toBe("es");
    expect(result.actorInput.languageCode).toBe("es");
  });

  it("includes locationUule only when truthy", () => {
    const result1 = mapGoogleSearchConfig(
      makeCtx({ queries: ["test"] }, SEARCH_DEFAULTS)
    );
    expect(result1.actorInput.locationUule).toBeUndefined();

    const result2 = mapGoogleSearchConfig(
      makeCtx({ queries: ["test"], locationUule: "w+CAIQICI..." }, SEARCH_DEFAULTS)
    );
    expect(result2.actorInput.locationUule).toBe("w+CAIQICI...");
  });

  it("calculates effectiveResultCount from queries * pages * 10", () => {
    const result = mapGoogleSearchConfig(
      makeCtx(
        { queries: ["q1", "q2", "q3"], maxPagesPerQuery: 2 },
        SEARCH_DEFAULTS
      )
    );
    expect(result.effectiveResultCount).toBe(3 * 2 * 10);
  });

  it("handles empty queries for effectiveResultCount", () => {
    const result = mapGoogleSearchConfig(
      makeCtx({ queries: [], maxPagesPerQuery: 3 }, SEARCH_DEFAULTS)
    );
    expect(result.effectiveResultCount).toBe(3 * 10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Reddit Mapper
// ═══════════════════════════════════════════════════════════════════════════════

describe("mapRedditConfig", () => {
  const REDDIT_DEFAULTS = {
    searches: [],
    maxItems: 100,
    maxComments: 10,
    sort: "hot",
  };

  it("passes searches directly", () => {
    const result = mapRedditConfig(
      makeCtx({ searches: ["react", "nextjs"] }, REDDIT_DEFAULTS)
    );
    expect(result.actorInput.searches).toEqual(["react", "nextjs"]);
  });

  it("includes searchCommunityName only when truthy", () => {
    const result1 = mapRedditConfig(
      makeCtx({ searches: ["test"] }, REDDIT_DEFAULTS)
    );
    expect(result1.actorInput.searchCommunityName).toBeUndefined();

    const result2 = mapRedditConfig(
      makeCtx(
        { searches: ["test"], searchCommunityName: "technology" },
        REDDIT_DEFAULTS
      )
    );
    expect(result2.actorInput.searchCommunityName).toBe("technology");
  });

  it("includes time filter only when sort is top", () => {
    // sort=hot + time=week → time should NOT be in output
    const result1 = mapRedditConfig(
      makeCtx(
        { searches: ["test"], sort: "hot", time: "week" },
        REDDIT_DEFAULTS
      )
    );
    expect(result1.actorInput.time).toBeUndefined();

    // sort=top + time=week → time should be in output
    const result2 = mapRedditConfig(
      makeCtx(
        { searches: ["test"], sort: "top", time: "week" },
        REDDIT_DEFAULTS
      )
    );
    expect(result2.actorInput.time).toBe("week");
  });

  it("includes postDateLimit only when truthy", () => {
    const result = mapRedditConfig(
      makeCtx(
        { searches: ["test"], postDateLimit: "2026-01-01" },
        REDDIT_DEFAULTS
      )
    );
    expect(result.actorInput.postDateLimit).toBe("2026-01-01");
  });

  it("warns when skipComments and searchComments are both true", () => {
    const result = mapRedditConfig(
      makeCtx(
        { searches: ["test"], skipComments: true, searchComments: true },
        REDDIT_DEFAULTS
      )
    );
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => w.toLowerCase().includes("comment"))).toBe(true);
  });

  it("does not warn when skipComments is false", () => {
    const result = mapRedditConfig(
      makeCtx(
        { searches: ["test"], skipComments: false, searchComments: true },
        REDDIT_DEFAULTS
      )
    );
    expect(result.warnings).toEqual([]);
  });

  it("calculates effectiveResultCount from maxItems", () => {
    const result = mapRedditConfig(
      makeCtx({ searches: ["test"], maxItems: 200 }, REDDIT_DEFAULTS)
    );
    expect(result.effectiveResultCount).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Default Mapper (Backward Compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

describe("defaultMapper", () => {
  it("merges defaults with user config via spread", () => {
    const result = defaultMapper(
      makeCtx(
        { searchStringsArray: ["cafes"], language: "es" },
        { searchStringsArray: [], maxCrawledPlacesPerSearch: 100, language: "en" }
      )
    );
    expect(result.actorInput).toEqual({
      searchStringsArray: ["cafes"],
      maxCrawledPlacesPerSearch: 100,
      language: "es",
    });
  });

  it("extracts effectiveResultCount from maxItems", () => {
    const result = defaultMapper(
      makeCtx({ maxItems: 250 }, { maxItems: 100 })
    );
    expect(result.effectiveResultCount).toBe(250);
  });

  it("extracts effectiveResultCount from maxReviews", () => {
    const result = defaultMapper(
      makeCtx({}, { maxReviews: 500 })
    );
    expect(result.effectiveResultCount).toBe(500);
  });

  it("extracts effectiveResultCount from resultsLimit", () => {
    const result = defaultMapper(
      makeCtx({}, { resultsLimit: 75 })
    );
    expect(result.effectiveResultCount).toBe(75);
  });

  it("extracts effectiveResultCount from maxCrawledPlacesPerSearch", () => {
    const result = defaultMapper(
      makeCtx({}, { maxCrawledPlacesPerSearch: 200 })
    );
    expect(result.effectiveResultCount).toBe(200);
  });

  it("defaults effectiveResultCount to 100", () => {
    const result = defaultMapper(makeCtx({}, {}));
    expect(result.effectiveResultCount).toBe(100);
  });

  it("returns empty warnings", () => {
    const result = defaultMapper(makeCtx({}, {}));
    expect(result.warnings).toEqual([]);
  });

  it("user config overrides defaults (same as current behavior)", () => {
    const result = defaultMapper(
      makeCtx(
        { sort: "Latest", onlyVerifiedUsers: true },
        { sort: "Top", onlyVerifiedUsers: false, maxItems: 100 }
      )
    );
    expect(result.actorInput.sort).toBe("Latest");
    expect(result.actorInput.onlyVerifiedUsers).toBe(true);
    expect(result.actorInput.maxItems).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Schema Structural Integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe("schema structural integrity", () => {
  const schemas = [
    { name: "twitter", schema: twitterSchema },
    { name: "google-maps-reviews", schema: googleMapsReviewsSchema },
    { name: "google-search", schema: googleSearchSchema },
    { name: "reddit", schema: redditSchema },
  ];

  for (const { name, schema } of schemas) {
    describe(name, () => {
      it("has a valid toolId", () => {
        expect(schema.toolId).toBe(name);
      });

      it("has version >= 1", () => {
        expect(schema.version).toBeGreaterThanOrEqual(1);
      });

      it("has at least one param group", () => {
        expect(schema.paramGroups.length).toBeGreaterThanOrEqual(1);
      });

      it("every param has en and es labels", () => {
        for (const param of getAllParams(schema)) {
          expect(param.label.en).toBeTruthy();
          expect(param.label.es).toBeTruthy();
          expect(param.description.en).toBeTruthy();
          expect(param.description.es).toBeTruthy();
        }
      });

      it("every param group has en and es labels", () => {
        for (const group of schema.paramGroups) {
          expect(group.label.en).toBeTruthy();
          expect(group.label.es).toBeTruthy();
        }
      });

      it("has no duplicate param ids", () => {
        const ids = getAllParams(schema).map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("every enum param has options", () => {
        for (const param of getAllParams(schema)) {
          if (param.kind === "enum" || param.kind === "multi_enum") {
            expect(param.options).toBeDefined();
            expect(param.options!.length).toBeGreaterThanOrEqual(1);
          }
        }
      });

      it("every enum option has en and es labels", () => {
        for (const param of getAllParams(schema)) {
          if (param.options) {
            for (const opt of param.options) {
              expect(opt.label.en).toBeTruthy();
              expect(opt.label.es).toBeTruthy();
            }
          }
        }
      });

      it("has clarifying questions with en and es translations", () => {
        for (const q of schema.clarifyingQuestions) {
          expect(q.question.en).toBeTruthy();
          expect(q.question.es).toBeTruthy();
          expect(q.paramIds.length).toBeGreaterThanOrEqual(1);
        }
      });

      it("clarifying question paramIds reference existing params", () => {
        const paramIds = new Set(getAllParams(schema).map((p) => p.id));
        for (const q of schema.clarifyingQuestions) {
          for (const pid of q.paramIds) {
            expect(paramIds.has(pid)).toBe(true);
          }
        }
      });

      it("dependsOn references existing params", () => {
        const paramIds = new Set(getAllParams(schema).map((p) => p.id));
        for (const param of getAllParams(schema)) {
          if (param.dependsOn) {
            expect(paramIds.has(param.dependsOn.paramId)).toBe(true);
          }
        }
      });
    });
  }
});
