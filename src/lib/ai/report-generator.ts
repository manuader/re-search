// ---------------------------------------------------------------------------
// Report Generator -- Data aggregation + Sonnet prompt builder
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectRow {
  title: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface ScrapingJobRow {
  tool_name: string | null;
  status: string;
  actual_results: number | null;
  actual_cost: number | null;
}

interface RawDataRow {
  content: Record<string, unknown>;
  ai_fields: Record<string, unknown> | null;
  created_at: string;
}

interface AnalysisConfigRow {
  analysis_type: string;
  config: Record<string, unknown>;
  status: string;
}

interface ToolSummary {
  name: string;
  results: number;
  cost: number;
}

interface SampleItem {
  content: Record<string, unknown>;
  ai_fields: Record<string, unknown> | null;
}

export interface AggregatedProjectData {
  project: {
    title: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  };
  stats: {
    totalResults: number;
    resultsBySource: Record<string, number>;
    dateRange: { earliest: string | null; latest: string | null };
    tools: ToolSummary[];
  };
  aiAnalyses: { type: string; status: string; config: Record<string, unknown> }[];
  sentimentDistribution: Record<string, number> | null;
  topCategories: { category: string; count: number }[] | null;
  topPainPoints: { painPoint: string; count: number }[] | null;
  sampleItems: SampleItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Trim an object to a limited set of short string values for token economy. */
function trimContent(
  obj: Record<string, unknown>,
  maxKeys = 6,
  maxLen = 200
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (count >= maxKeys) break;
    if (typeof v === "string") {
      out[k] = v.length > maxLen ? v.slice(0, maxLen) + "..." : v;
    } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    } else {
      out[k] = "[omitted]";
    }
    count++;
  }
  return out;
}

function countFrequencies(arr: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of arr) {
    const key = item.trim().toLowerCase();
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function topN(
  freq: Map<string, number>,
  n: number
): { key: string; count: number }[] {
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

// ---------------------------------------------------------------------------
// 1. aggregateProjectData
// ---------------------------------------------------------------------------

export async function aggregateProjectData(
  projectId: string,
  supabase: SupabaseClient
): Promise<AggregatedProjectData> {
  // Run all queries in parallel
  const [projectRes, jobsRes, rawDataRes, analysisRes] = await Promise.all([
    supabase
      .from("research_projects")
      .select("title, status, created_at, completed_at")
      .eq("id", projectId)
      .single<ProjectRow>(),
    supabase
      .from("scraping_jobs")
      .select("tool_name, status, actual_results, actual_cost")
      .eq("project_id", projectId)
      .returns<ScrapingJobRow[]>(),
    supabase
      .from("raw_data")
      .select("content, ai_fields, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .returns<RawDataRow[]>(),
    supabase
      .from("ai_analysis_configs")
      .select("analysis_type, config, status")
      .eq("project_id", projectId)
      .returns<AnalysisConfigRow[]>(),
  ]);

  const project = projectRes.data;
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const jobs = jobsRes.data ?? [];
  const rawData = rawDataRes.data ?? [];
  const analyses = analysisRes.data ?? [];

  // --- Stats ---
  const totalResults = rawData.length;

  // Results per source tool
  const resultsBySource: Record<string, number> = {};
  for (const job of jobs) {
    const name = job.tool_name ?? "unknown";
    resultsBySource[name] = (resultsBySource[name] ?? 0) + (job.actual_results ?? 0);
  }

  // Date range
  const dates = rawData.map((r) => r.created_at).filter(Boolean);
  const dateRange = {
    earliest: dates.length > 0 ? dates[0] : null,
    latest: dates.length > 0 ? dates[dates.length - 1] : null,
  };

  // Tools summary
  const toolMap = new Map<string, ToolSummary>();
  for (const job of jobs) {
    const name = job.tool_name ?? "unknown";
    const existing = toolMap.get(name);
    if (existing) {
      existing.results += job.actual_results ?? 0;
      existing.cost += job.actual_cost ?? 0;
    } else {
      toolMap.set(name, {
        name,
        results: job.actual_results ?? 0,
        cost: job.actual_cost ?? 0,
      });
    }
  }

  // --- AI field aggregations ---
  let sentimentDistribution: Record<string, number> | null = null;
  let topCategories: { category: string; count: number }[] | null = null;
  let topPainPoints: { painPoint: string; count: number }[] | null = null;

  const sentiments: string[] = [];
  const categories: string[] = [];
  const painPoints: string[] = [];

  for (const row of rawData) {
    const ai = row.ai_fields;
    if (!ai) continue;

    // Sentiment
    if (typeof ai.sentiment === "string") {
      sentiments.push(ai.sentiment);
    }

    // Category / classification
    if (typeof ai.category === "string") {
      categories.push(ai.category);
    }

    // Pain points
    if (Array.isArray(ai.pain_points)) {
      for (const pp of ai.pain_points) {
        if (typeof pp === "string") painPoints.push(pp);
      }
    }
  }

  if (sentiments.length > 0) {
    sentimentDistribution = {};
    for (const s of sentiments) {
      const key = s.toLowerCase();
      sentimentDistribution[key] = (sentimentDistribution[key] ?? 0) + 1;
    }
  }

  if (categories.length > 0) {
    const freq = countFrequencies(categories);
    topCategories = topN(freq, 10).map((e) => ({
      category: e.key,
      count: e.count,
    }));
  }

  if (painPoints.length > 0) {
    const freq = countFrequencies(painPoints);
    topPainPoints = topN(freq, 10).map((e) => ({
      painPoint: e.key,
      count: e.count,
    }));
  }

  // --- Sample items (first 5 + last 5) ---
  const sampleItems: SampleItem[] = [];
  const first5 = rawData.slice(0, 5);
  const last5 = rawData.length > 5 ? rawData.slice(-5) : [];
  for (const row of [...first5, ...last5]) {
    sampleItems.push({
      content: trimContent(row.content),
      ai_fields: row.ai_fields ? trimContent(row.ai_fields) : null,
    });
  }

  return {
    project: {
      title: project.title,
      status: project.status,
      createdAt: project.created_at,
      completedAt: project.completed_at,
    },
    stats: {
      totalResults,
      resultsBySource,
      dateRange,
      tools: [...toolMap.values()],
    },
    aiAnalyses: analyses.map((a) => ({
      type: a.analysis_type,
      status: a.status,
      config: a.config,
    })),
    sentimentDistribution,
    topCategories,
    topPainPoints,
    sampleItems,
  };
}

// ---------------------------------------------------------------------------
// 2. generateReportPrompt
// ---------------------------------------------------------------------------

export function generateReportPrompt(
  aggregatedData: AggregatedProjectData,
  projectTitle: string,
  locale: Locale
): { system: string; user: string } {
  const system = `You are a professional data-analyst report generator.

Your task: produce a COMPLETE, self-contained HTML document that renders a polished research report.

Technical requirements:
- Include React 18 via unpkg CDN: https://unpkg.com/react@18/umd/react.production.min.js and https://unpkg.com/react-dom@18/umd/react-dom.production.min.js
- Include Recharts 2 via unpkg CDN: https://unpkg.com/recharts@2/umd/Recharts.js
- Include Babel standalone for JSX: https://unpkg.com/@babel/standalone/babel.min.js
- All styles must be inline or in a <style> block — no external CSS
- The design must be responsive and use a professional dark theme (dark backgrounds #0f172a / #1e293b, light text, accent colors for charts)
- Use modern typography and generous spacing

Required report sections:
1. **Executive Summary** — 3-5 bullet points covering the most important findings
2. **Key Insights** — data-driven insights derived from the numbers and AI analysis results
3. **Visualizations** — use Recharts (BarChart, PieChart, LineChart as appropriate) to visualize:
   - Results distribution by source/tool
   - Sentiment distribution (if available)
   - Top categories (if available)
   - Any other relevant metrics
4. **Breakdown by Source** — detailed stats per data source tool
5. **Recommendations** — actionable next steps based on the data

Content rules:
- The entire report (headings, body text, labels, chart labels) must be written in ${locale === "es" ? "Spanish (Latin American)" : "English"}
- Project title: "${projectTitle}"
- Base all analysis strictly on the provided data — do not invent numbers
- If sentiment/category/pain-point data is null, skip those visualizations gracefully

Response format:
- Respond with ONLY the raw HTML document (starting with <!DOCTYPE html>)
- Do NOT wrap it in markdown code fences
- Do NOT include any explanation before or after the HTML`;

  const user = JSON.stringify(aggregatedData, null, 2);

  return { system, user };
}
