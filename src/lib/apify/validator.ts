import type { ToolCatalogEntry } from "@/types";

export interface ValidationResult {
  validItems: Record<string, unknown>[];
  duplicatesRemoved: number;
  emptyFieldsCount: number;
  totalReceived: number;
  qualityScore: "high" | "medium" | "low";
  report: {
    totalReceived: number;
    afterDedup: number;
    duplicatesRemoved: number;
    emptyFieldsCount: number;
    qualityScore: string;
    issues: string[];
  };
}

export function validateScrapedData(
  items: Record<string, unknown>[],
  tool: ToolCatalogEntry
): ValidationResult {
  const issues: string[] = [];
  const totalReceived = items.length;

  // 1. Deduplicate by uniqueKey
  let deduped = items;
  let duplicatesRemoved = 0;

  if (tool.validation.uniqueKey) {
    const seen = new Set<string>();
    deduped = items.filter((item) => {
      const key = String(item[tool.validation.uniqueKey!] ?? "");
      if (!key || seen.has(key)) {
        duplicatesRemoved++;
        return false;
      }
      seen.add(key);
      return true;
    });

    if (duplicatesRemoved > 0) {
      issues.push(`Removed ${duplicatesRemoved} duplicate items`);
    }
  }

  // 2. Check required fields
  let emptyFieldsCount = 0;
  for (const item of deduped) {
    for (const field of tool.validation.requiredFields) {
      const val = item[field];
      if (val === undefined || val === null || val === "") {
        emptyFieldsCount++;
      }
    }
  }

  if (emptyFieldsCount > 0) {
    issues.push(
      `${emptyFieldsCount} empty required fields across ${deduped.length} items`
    );
  }

  // 3. Calculate quality score
  const dedupRatio = totalReceived > 0 ? duplicatesRemoved / totalReceived : 0;
  const emptyRatio =
    deduped.length > 0
      ? emptyFieldsCount / (deduped.length * tool.validation.requiredFields.length)
      : 0;

  let qualityScore: "high" | "medium" | "low";
  if (dedupRatio < 0.05 && emptyRatio < 0.05) {
    qualityScore = "high";
  } else if (dedupRatio < 0.2 && emptyRatio < 0.2) {
    qualityScore = "medium";
  } else {
    qualityScore = "low";
    issues.push("Data quality is low — high duplicate or empty field ratio");
  }

  return {
    validItems: deduped,
    duplicatesRemoved,
    emptyFieldsCount,
    totalReceived,
    qualityScore,
    report: {
      totalReceived,
      afterDedup: deduped.length,
      duplicatesRemoved,
      emptyFieldsCount,
      qualityScore,
      issues,
    },
  };
}
