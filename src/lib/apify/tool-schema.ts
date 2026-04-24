// ---------------------------------------------------------------------------
// Tool Schema — Rich parameter definitions for Apify scraping tools
//
// Each tool in the catalog can optionally link to a ToolSchema that declares
// every parameter the Apify actor supports, grouped by purpose, with metadata
// used by the chatbot (importance, clarifying questions), the config panel
// (kind, advanced flag), the pricing engine (volumeMultiplier), and the
// validator (validation rules).
//
// Adding a parameter to a tool requires editing only its schema file, its
// mapper, and the i18n labels — no UI or prompt changes.
// ---------------------------------------------------------------------------

/** Determines which UI control renders the parameter in the config panel. */
export type ParamKind =
  | "text"
  | "number"
  | "boolean"
  | "enum"
  | "multi_enum"
  | "date_range"
  | "date_distribution"
  | "geo"
  | "keyword_list";

/**
 * How important it is that this parameter is explicitly set before execution.
 *
 * - `critical`  — chatbot must ask before finalizing config
 * - `high`      — chatbot asks unless the user's brief clearly implies a value
 * - `medium`    — shown in config panel, mentioned by chatbot only in "advanced"
 * - `low`       — rarely touched, hidden behind "Advanced" toggle
 */
export type ParamImportance = "critical" | "high" | "medium" | "low";

/** A selectable option for `enum` / `multi_enum` params. */
export interface ParamOption {
  value: string;
  label: Record<string, string>; // keyed by locale (en, es, pt, fr, de)
}

/**
 * A single configurable parameter for a scraping tool.
 *
 * The `id` is the semantic key used in user-facing config objects.
 * The `apifyField` is the key expected by the Apify actor's input schema.
 * They may differ (e.g., id="dateRange" maps to apifyFields "start"/"end").
 */
export interface ToolParam {
  /** Stable identifier, used in config objects and mappers. */
  id: string;

  /**
   * Apify actor input field name. For params that map to multiple actor fields
   * (e.g., dateRange -> start + end), set this to the primary field name and
   * handle the multi-field mapping in the mapper.
   */
  apifyField: string;

  /** Determines the UI control and validation behavior. */
  kind: ParamKind;

  /** Human-readable label per locale. */
  label: Record<string, string>;

  /** Longer description/help text per locale. */
  description: Record<string, string>;

  /** Optional placeholder text per locale. */
  placeholder?: Record<string, string>;

  /** Controls chatbot questioning behavior and panel ordering. */
  importance: ParamImportance;

  /** If true, only visible when "Advanced mode" is enabled in the panel. */
  advanced: boolean;

  /** Whether the user must provide a value (no default is acceptable). */
  required: boolean;

  /** Default value applied when the user doesn't set this param. */
  defaultValue: unknown;

  // ── Validation constraints ──────────────────────────────────────────
  /** Minimum (for numbers). */
  min?: number;
  /** Maximum (for numbers). */
  max?: number;
  /** Allowed options (for enum / multi_enum). */
  options?: ParamOption[];
  /** Max items (for keyword_list / multi_enum). */
  maxItems?: number;

  // ── Cost impact ─────────────────────────────────────────────────────
  /**
   * Static multiplier applied to estimated results when this param is enabled.
   * Only used for boolean/enum params that increase data volume.
   * Example: `includeReplies` with multiplier 1.4 means 40% more data.
   * Undefined = no volume impact.
   */
  volumeMultiplier?: number;

  // ── Conditional visibility ──────────────────────────────────────────
  /**
   * This param is only relevant when another param has a specific value.
   * Example: Reddit `time` param only applies when `sort` = "top".
   */
  dependsOn?: {
    paramId: string;
    /** The value(s) of the dependency that make this param visible. */
    values: unknown[];
  };
}

/** A logical grouping of related parameters (shown as a section in the panel). */
export interface ParamGroup {
  id: string;
  label: Record<string, string>;
  params: ToolParam[];
}

/**
 * A question the chatbot should ask if certain params are missing from config.
 * The chatbot uses these to guide the user through configuration conversationally.
 */
export interface ClarifyingQuestion {
  /** Stable identifier. */
  id: string;
  /** The question template per locale. May include {brief} interpolation. */
  question: Record<string, string>;
  /** Which params this question covers. */
  paramIds: string[];
  /**
   * Condition under which the chatbot should ask this question.
   * Expressed as a human-readable hint for the system prompt.
   */
  triggerWhen: string;
}

/**
 * Complete parameter schema for one scraping tool.
 *
 * Links to the catalog via `toolId`. Consumed by the chatbot (to know what to
 * ask), the config panel (to render controls), the mapper (to translate to
 * Apify input), and the pricing engine (volume multipliers).
 */
export interface ToolSchema {
  toolId: string;

  /** Schema version — increment when adding/removing params. */
  version: number;

  /** Grouped parameters, rendered as collapsible sections in the panel. */
  paramGroups: ParamGroup[];

  /**
   * Cross-parameter validation. Returns an array of human-readable error
   * messages (empty = valid). Called after individual param validation.
   */
  crossValidate?: (config: Record<string, unknown>) => string[];

  /** Questions the chatbot should ask when key params are unconfigured. */
  clarifyingQuestions: ClarifyingQuestion[];
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Flatten all params from a schema into a single array. */
export function getAllParams(schema: ToolSchema): ToolParam[] {
  return schema.paramGroups.flatMap((g) => g.params);
}

/**
 * Get params the chatbot should actively ask about:
 * critical + high importance, non-advanced.
 */
export function getChatbotParams(schema: ToolSchema): ToolParam[] {
  return getAllParams(schema).filter(
    (p) =>
      (p.importance === "critical" || p.importance === "high") && !p.advanced
  );
}

/**
 * Build the default config from a schema — one entry per param with a
 * defined defaultValue (skips params where default is undefined).
 */
export function getSchemaDefaults(
  schema: ToolSchema
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const param of getAllParams(schema)) {
    if (param.defaultValue !== undefined) {
      defaults[param.id] = param.defaultValue;
    }
  }
  return defaults;
}

/**
 * Validate a config object against a schema. Returns error messages.
 * Checks required fields, min/max, enum membership, and cross-validation.
 */
export function validateConfig(
  schema: ToolSchema,
  config: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  const allParams = getAllParams(schema);

  for (const param of allParams) {
    const value = config[param.id];

    // Required check
    if (param.required && (value === undefined || value === null || value === "")) {
      errors.push(`${param.id} is required`);
      continue;
    }

    // Skip further validation if no value
    if (value === undefined || value === null) continue;

    // Number range checks
    if (param.kind === "number" && typeof value === "number") {
      if (param.min !== undefined && value < param.min) {
        errors.push(`${param.id} must be at least ${param.min}`);
      }
      if (param.max !== undefined && value > param.max) {
        errors.push(`${param.id} must be at most ${param.max}`);
      }
    }

    // Enum membership check
    if (param.kind === "enum" && param.options) {
      const validValues = param.options.map((o) => o.value);
      if (!validValues.includes(value as string)) {
        errors.push(`${param.id} must be one of: ${validValues.join(", ")}`);
      }
    }

    // Multi-enum membership check
    if (param.kind === "multi_enum" && param.options && Array.isArray(value)) {
      const validValues = param.options.map((o) => o.value);
      for (const v of value) {
        if (!validValues.includes(v as string)) {
          errors.push(`${param.id} contains invalid value: ${v}`);
        }
      }
      if (param.maxItems !== undefined && value.length > param.maxItems) {
        errors.push(`${param.id} allows at most ${param.maxItems} selections`);
      }
    }

    // Keyword list max items
    if (param.kind === "keyword_list" && Array.isArray(value)) {
      if (param.maxItems !== undefined && value.length > param.maxItems) {
        errors.push(`${param.id} allows at most ${param.maxItems} items`);
      }
    }
  }

  // Cross-validation
  if (schema.crossValidate) {
    errors.push(...schema.crossValidate(config));
  }

  return errors;
}
