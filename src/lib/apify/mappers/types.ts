// ---------------------------------------------------------------------------
// Mapper Types — Transform semantic config into Apify actor input
//
// Each tool with a ToolSchema has a corresponding mapper that converts the
// user-facing config (paramId-keyed) into the exact JSON the Apify actor
// expects (apifyField-keyed, with format transformations).
// ---------------------------------------------------------------------------

/** Context provided to every mapper. */
export interface MapperContext {
  /** Current user locale (for locale-dependent defaults). */
  locale: string;
  /** User-provided config values, keyed by ToolParam.id. */
  userConfig: Record<string, unknown>;
  /** Catalog defaults for this tool (from catalog.ts inputSchema.defaults). */
  catalogDefaults: Record<string, unknown>;
}

/** Result returned by every mapper. */
export interface MapperResult {
  /** The JSON object to send as Apify actor input. */
  actorInput: Record<string, unknown>;
  /**
   * Effective result count after applying volume multipliers.
   * Used by pricing to recalculate cost based on config changes.
   */
  effectiveResultCount: number;
  /** Human-readable warnings about the config (e.g., conflicting params). */
  warnings: string[];
}

/** Signature for a tool-specific mapper function. */
export type ToolMapper = (ctx: MapperContext) => MapperResult;
