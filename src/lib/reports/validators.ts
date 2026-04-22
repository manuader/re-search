// ---------------------------------------------------------------------------
// Report Pipeline — Post-Generation Validators
// ---------------------------------------------------------------------------

import type { DatasetSummary } from "./types";

// ---------------------------------------------------------------------------
// 1. Structural HTML Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  checks: Record<string, boolean>;
}

export function validateReportHTML(html: string): ValidationResult {
  const trimmed = html.trim();
  const checks: Record<string, boolean> = {
    startsWithDoctype: /^<!DOCTYPE html>/i.test(trimmed),
    hasChartJsCDN: trimmed.includes("cdn.jsdelivr.net/npm/chart.js@4"),
    noReact: !/\bReact\b|ReactDOM|from\s+['"]react['"]/.test(trimmed),
    noMarkdownFences: !trimmed.startsWith("```"),
    hasTabs:
      /role=['"]tab['"]/.test(trimmed) ||
      /class=['"][^'"]*tab/i.test(trimmed),
    minCharts: (trimmed.match(/new\s+Chart\s*\(/g) ?? []).length >= 5,
    closesHtml: trimmed.endsWith("</html>"),
  };

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
  };
}

/**
 * Build a feedback message from failed checks for a retry prompt.
 */
export function buildValidationFeedback(checks: Record<string, boolean>): string {
  const failures: string[] = [];
  if (!checks.startsWithDoctype)
    failures.push("- Must start with <!DOCTYPE html>");
  if (!checks.hasChartJsCDN)
    failures.push(
      '- Must include Chart.js CDN: <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>'
    );
  if (!checks.noReact)
    failures.push("- Must NOT use React, ReactDOM, or JSX — vanilla HTML/JS only");
  if (!checks.noMarkdownFences)
    failures.push("- Must NOT wrap in markdown code fences (```)");
  if (!checks.hasTabs)
    failures.push('- Must include tabbed navigation with role="tab" elements');
  if (!checks.minCharts)
    failures.push("- Must include at least 5 charts using new Chart()");
  if (!checks.closesHtml)
    failures.push("- Must end with </html>");

  return `The generated report has the following issues:\n${failures.join("\n")}\n\nPlease regenerate fixing these issues. Remember: raw HTML only, no markdown wrapping.`;
}

// ---------------------------------------------------------------------------
// 2. Numeric Grounding Validation (Anti-Hallucination)
// ---------------------------------------------------------------------------

export interface GroundingResult {
  ok: boolean;
  suspicious: number[];
  totalChecked: number;
}

/**
 * Recursively collect all numeric values from an object.
 */
function collectAllNumbers(obj: unknown, out: Set<number> = new Set()): Set<number> {
  if (typeof obj === "number" && isFinite(obj)) {
    out.add(obj);
    // Also add common derivations
    out.add(Math.round(obj));
    out.add(Math.round(obj * 10) / 10);
    out.add(Math.round(obj * 100) / 100);
    return out;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectAllNumbers(item, out);
    return out;
  }
  if (obj !== null && typeof obj === "object") {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      collectAllNumbers(value, out);
    }
  }
  return out;
}

/**
 * Extract visible numbers from HTML (strip tags, script/style blocks, Chart.js configs).
 */
function extractVisibleNumbers(html: string): number[] {
  // Remove script and style blocks (which contain chart config numbers)
  let textOnly = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  textOnly = textOnly.replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Remove HTML tags
  textOnly = textOnly.replace(/<[^>]+>/g, " ");
  // Decode common entities
  textOnly = textOnly.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");

  // Match numbers with 3+ digits (including decimals and comma-separated)
  const matches = textOnly.match(/\b\d[\d,]*\.?\d*\b/g) ?? [];

  const numbers: number[] = [];
  for (const m of matches) {
    const cleaned = m.replace(/,/g, "");
    const n = parseFloat(cleaned);
    if (isFinite(n) && n >= 100) {
      numbers.push(n);
    }
  }

  return [...new Set(numbers)];
}

export function numbersAreGrounded(
  html: string,
  summary: DatasetSummary
): GroundingResult {
  const knownNumbers = collectAllNumbers(summary);

  // Also add derived percentages for common totals
  const total = summary.meta.totalItems;
  if (total > 0) {
    // Add percentages that could be derived from counts
    for (const n of [...knownNumbers]) {
      if (n > 0 && n <= total) {
        const pct = Math.round((n / total) * 100);
        knownNumbers.add(pct);
        knownNumbers.add(Math.round((n / total) * 1000) / 10); // one decimal %
      }
    }
  }

  const htmlNumbers = extractVisibleNumbers(html);
  const suspicious: number[] = [];

  for (const n of htmlNumbers) {
    // Check exact, ±1, ±2 tolerance
    let grounded = false;
    for (const tol of [0, 1, 2]) {
      if (knownNumbers.has(n + tol) || knownNumbers.has(n - tol)) {
        grounded = true;
        break;
      }
    }
    // Also check if it's a year (2020-2030 range) — always allowed
    if (!grounded && n >= 2020 && n <= 2030) {
      grounded = true;
    }
    if (!grounded) {
      suspicious.push(n);
    }
  }

  return {
    ok: suspicious.length <= 3,
    suspicious,
    totalChecked: htmlNumbers.length,
  };
}
