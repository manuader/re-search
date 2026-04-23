// ---------------------------------------------------------------------------
// Report Pipeline — LLM Prompt Builder
// ---------------------------------------------------------------------------

import type { DatasetSummary, SourceType, ReportLevel } from "./types";

// ---------------------------------------------------------------------------
// Source-specific guidance
// ---------------------------------------------------------------------------

const SOURCE_GUIDANCE: Record<SourceType, string> = {
  twitter: `SOURCE-SPECIFIC FOCUS: Twitter/X
- Engagement-weighted sentiment vs unweighted — surface the delta
- Influencer concentration: what % of total engagement do the top 1% of posts capture?
- Virality outliers: posts that exceed 2σ in engagement
- Hashtag/mention patterns from the content
- Like-to-retweet ratio as "resonance score"
- Hour-of-day and day-of-week posting patterns
- Reply depth as a proxy for controversy`,

  instagram: `SOURCE-SPECIFIC FOCUS: Instagram
- Engagement rate per post (likes + comments relative to mean)
- Content type performance comparison (if type field present)
- Caption length vs engagement correlation
- Posting frequency patterns
- Visual content cannot be analyzed from text — note this limitation`,

  reddit: `SOURCE-SPECIFIC FOCUS: Reddit
- Community sentiment patterns by subreddit (if multiple)
- Discussion depth: score vs numComments ratio
- Upvote distribution (score) — often power-law distributed
- Content length correlates: do longer posts get more engagement?
- Controversial posts (high comments, low score)`,

  linkedin: `SOURCE-SPECIFIC FOCUS: LinkedIn
- Company concentration: are listings dominated by a few employers?
- Seniority/experience level distribution
- Location clustering
- Salary range analysis (if present)
- Industry × applicant count cross-tab`,

  google_maps_places: `SOURCE-SPECIFIC FOCUS: Google Maps Business Listings
- Rating × review-count scatter with quadrant labels:
  • High rating, high reviews = "Crowd Favorites"
  • High rating, low reviews = "Hidden Gems"
  • Low rating, high reviews = "Tourist Traps"
  • Low rating, low reviews = "Overlooked"
- Category saturation: how many businesses per category
- Geographic clustering if location data present`,

  google_maps_reviews: `SOURCE-SPECIFIC FOCUS: Google Maps Reviews
- Star rating distribution + trajectory over time
- Review length vs star rating scatter (negative reviews tend to be longer)
- Owner response rate by rating bucket (if responseFromOwner field present)
- Aspect-based analysis from content: service, price, cleanliness, location, atmosphere
- Contrast: what do 1-star reviews say vs 5-star reviews?`,

  tripadvisor: `SOURCE-SPECIFIC FOCUS: TripAdvisor
- Rating distribution and trajectory
- Ranking position vs rating correlation
- Price category analysis (if present)
- Review count as popularity proxy
- Category breakdown`,

  amazon: `SOURCE-SPECIFIC FOCUS: Amazon Products
- Rating distribution (typically bimodal: lots of 5-star and 1-star)
- Price vs rating analysis
- Prime vs non-Prime performance
- Brand concentration
- Review count as social proof signal`,

  news: `SOURCE-SPECIFIC FOCUS: News/Articles
- Source diversity: how many distinct publishers?
- Publication cadence over time
- Author concentration
- Stance/sentiment analysis if enrichment present`,

  generic: `SOURCE: Generic/Mixed
- Adapt analysis to whatever fields are present in the data
- Focus on engagement distribution and content patterns`,
};

// ---------------------------------------------------------------------------
// Build prompt
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Report level tone/depth modifiers
// ---------------------------------------------------------------------------

const LEVEL_INSTRUCTIONS: Record<ReportLevel, string> = {
  executive: `================================================================
REPORT LEVEL: EXECUTIVE SUMMARY
================================================================

This report targets C-suite executives and non-technical stakeholders. Rules:

- TONE: Clear, direct, business-oriented. Zero jargon. No statistical terminology (no "standard deviation", "gini coefficient", "percentile"). Translate every stat into plain business language.
- LENGTH: Concise. 3-4 tabs maximum: Overview, Key Findings, Recommendations, Methodology.
- CHARTS: Maximum 4-5 charts. Prefer simple bar charts, doughnut charts, and KPI cards. No scatter plots, no radar charts, no complex multi-axis charts.
- INSIGHTS: Frame every finding as a business decision or risk. "X means you should Y" format.
- NUMBERS: Use round numbers when possible (48% not 47.83%). Show totals and percentages, avoid raw statistical measures.
- KPI CARDS: Big, bold numbers with one-line explanations. Maximum 4-6 KPIs on overview.
- RECOMMENDATIONS: Lead with this — what should the reader DO? Each recommendation = 1 sentence + 1 supporting number.
- SKIP: Correlations section, detailed percentile breakdowns, methodology formulas, engagement quartile analysis. Keep methodology tab minimal (just sources + N + date range).`,

  professional: `================================================================
REPORT LEVEL: PROFESSIONAL ANALYSIS
================================================================

This report targets analysts, product managers, and informed stakeholders. Rules:

- TONE: Professional but accessible. Use statistical terms where they add precision, but always explain what they mean in context.
- LENGTH: Full report. 5-8 tabs covering all available data dimensions.
- CHARTS: At least 7 charts of different types. Include distribution charts, time series, comparisons, and correlations where data supports them.
- INSIGHTS: Minimum 8 quantified, non-trivial insights. Template: [Number] + [comparison] + [implication].
- NUMBERS: Show precise values with context (mean, median, key percentiles). Include weighted vs unweighted comparisons.
- RECOMMENDATIONS: 4-7 items, prioritized P1/P2/P3, each citing a specific metric.
- INCLUDE: Engagement distribution, sentiment analysis, temporal patterns, segmentation, top items table, and methodology with weighting formulas.`,

  technical: `================================================================
REPORT LEVEL: TECHNICAL / STATISTICAL DEEP-DIVE
================================================================

This report targets data scientists, researchers, and technical analysts. Rules:

- TONE: Academic and precise. Use full statistical terminology without simplification. Include confidence caveats and methodological notes inline.
- LENGTH: Comprehensive. 7-9 tabs. Include every data dimension available. Add a dedicated "Statistical Detail" tab.
- CHARTS: At least 10 charts. Include scatter plots with regression lines, box plots via CSS, distribution histograms, heatmaps, bubble charts, and radar charts. Show confidence intervals where applicable.
- INSIGHTS: Minimum 12 quantified insights. Include effect sizes, correlation coefficients (with n), and distribution shape descriptions (skewness, kurtosis proxy).
- NUMBERS: Show full precision. Include ALL percentiles (p10, p25, p50, p75, p90, p99). Show Gini coefficient, polarization index, standard deviations. Always show both weighted and unweighted metrics side by side.
- CORRELATIONS: Dedicate a section to all correlations with |r| >= 0.3. Include scatter plots for the strongest.
- METHODOLOGY: Detailed tab with: sampling strategy (N-adaptive table used), influence weight formulas per source, enrichment detection method, number grounding approach. Include the raw DatasetSummary.meta as a collapsible JSON block.
- TOP ITEMS TABLE: Full sortable table with all fields: rank, content snippet, author, date, engagement raw values, influence weight, sentiment, category.
- RECOMMENDATIONS: Frame as hypotheses to test, not business directives. "The data suggests X (r=0.42, n=847); further investigation with Y methodology is warranted."`,
};

export function buildReportPrompt(
  summary: DatasetSummary,
  projectTitle: string,
  locale: string,
  level: ReportLevel = "professional"
): { system: string; user: string } {
  const sourceGuidance = SOURCE_GUIDANCE[summary.meta.source] ?? SOURCE_GUIDANCE.generic;
  const levelInstructions = LEVEL_INSTRUCTIONS[level];
  const LOCALE_LABELS: Record<string, string> = {
    en: "English",
    es: 'Spanish (Latin American / rioplatense-friendly, avoid Spain-isms like "vale" or "mola")',
    pt: "Brazilian Portuguese",
    fr: "French",
    de: "German",
  };
  const localeLabel = LOCALE_LABELS[locale] ?? "English";

  const system = `You are an elite hybrid: senior data analyst + frontend engineer. Your job is to turn a pre-computed research dataset summary into a COMPLETE, self-contained, interactive HTML report that surfaces non-obvious, quantified, actionable intelligence — tailored to the user's specific research objective. Generic is failure. Every section must justify its existence with a number.

================================================================
INPUT CONTEXT
================================================================

USER RESEARCH BRIEF (verbatim — THIS IS THE NORTH STAR for what matters):
"""
${summary.meta.userBrief}
"""

PROJECT TITLE: "${projectTitle}"
LOCALE: ${localeLabel}
DATA SOURCE: ${summary.meta.source}
AI ENRICHMENTS AVAILABLE: ${JSON.stringify(summary.meta.enrichmentsPresent)}
${summary.meta.enrichmentsRequestedButMissing.length > 0 ? `ENRICHMENTS REQUESTED BUT MISSING: ${JSON.stringify(summary.meta.enrichmentsRequestedButMissing)}` : ""}
${summary.meta.limitations.length > 0 ? `LIMITATIONS: ${JSON.stringify(summary.meta.limitations)}` : ""}

${sourceGuidance}

${levelInstructions}

================================================================
CRITICAL: ALL NUMBERS ARE PRE-COMPUTED
================================================================

The DATASET SUMMARY you receive contains ALL statistics pre-computed in TypeScript on the FULL population (N=${summary.meta.totalItems}). You MUST use these exact numbers in your report:

- engagement.mean, engagement.median, engagement.stdDev, engagement.giniCoefficient
- engagement.percentiles (p10, p25, p50, p75, p90, p99)
- engagement.top10ConcentrationPct, engagement.top1PctConcentrationPct
- sentiment stats (if present): weighted vs unweighted mean, polarizationIndex, deltaWeightedVsUnweighted
- temporal.trend, temporal.series
- correlations (only those with |r| >= 0.3)
- topItems and representativeSample for qualitative examples

DO NOT invent, derive, estimate, or round these numbers differently. Use them EXACTLY as provided.
The sample items are for qualitative illustration only — cite them as examples, not for statistics.

================================================================
NON-OBVIOUS INSIGHTS (MANDATORY BAR)
================================================================

Every insight must be QUANTIFIED and NON-TRIVIAL. Template: [Specific number] + [surprising comparison] + [implication].

✅ Good: "The top 10 posts (${summary.engagement.top10ConcentrationPct}% of total engagement) show a sentiment mean of X vs Y overall — detractors are amplified."
✅ Good: "Posts between 21:00–23:00 get 41% more reposts than the daily mean."
❌ Forbidden: "opinions are mixed", "engagement is high", "more research is needed"

Minimum: 8 quantified, non-trivial insights across the report.

================================================================
TECHNICAL CONSTRAINTS
================================================================

- Single self-contained HTML document. Starts <!DOCTYPE html>, ends </html>.
- Chart.js v4 via CDN ONLY:
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
- No React, no JSX, no Babel, no Tailwind, no Alpine, no jQuery. Vanilla HTML/CSS/JS only.
- All CSS inside one <style> block. All JS inline in <script> tags at end of <body>.
- Responsive: max-width 1280px centered container, CSS Grid + Flexbox, must survive down to 768px.
- Respect prefers-reduced-motion.

================================================================
VISUAL DESIGN
================================================================

Dark theme, layered:
  Page bg:         #0a0e1a
  Card bg:         #0f172a
  Elevated bg:     #1e293b
  Input/hover bg:  #1a2234
  Border subtle:   rgba(148,163,184,0.12)
  Border accent:   rgba(96,165,250,0.35)

Text: Primary #f8fafc, Secondary #cbd5e1, Muted #64748b

Accents (rotate across charts — NEVER repeat same accent on adjacent charts):
  Blue #60a5fa, Green #34d399, Amber #fbbf24, Red #f87171,
  Violet #a78bfa, Pink #f472b6, Cyan #22d3ee, Orange #fb923c

Hero title gradient: linear-gradient(135deg, #60a5fa 0%, #a78bfa 60%, #f472b6 100%)
System font stack. Rounded corners 12-16px. Card padding 24-32px.

================================================================
LAYOUT — TABBED NAVIGATION (MANDATORY)
================================================================

Render a top-level horizontal tab bar (buttons, role="tab"). Vanilla JS swaps visible panel.
Active tab: brighter text + 2px accent-colored bottom border.
Transition content-in with opacity 0→1 over 220ms.

Choose 5-8 tabs ADAPTED to the data. Skip any tab whose data isn't present:
  1. Overview — hero KPI cards + signature chart + 4-6 executive bullets
  2. Sentiment (if sentiment enrichment) — distribution, polarization, weighted vs unweighted
  3. Engagement — top performers, concentration curve, virality outliers
  4. Audience/Segmentation (if demographic/category data) — cross-tabs
  5. Temporal Patterns (if dates present) — time-series, hour×day heatmap
  6. Themes/Keywords (if textPatterns) — keyword frequency, theme×sentiment
  7. Top Items — sortable table
  8. Recommendations — P1/P2/P3 prioritized, each tied to a number
  9. Methodology — sources, N, date range, weighting formulas, LIMITATIONS

${summary.meta.enrichmentsRequestedButMissing.length > 0 ? `FLAG EXPLICITLY in Methodology tab: "LIMITATION: The research brief requested ${summary.meta.enrichmentsRequestedButMissing.join(", ")} but ${summary.meta.enrichmentsRequestedButMissing.length === 1 ? "this dimension is" : "these dimensions are"} not present in the dataset."` : ""}

================================================================
CHARTS — USE AT LEAST 7 DIFFERENT TYPES
================================================================

Match chart to job:
  • Horizontal bar → top-N with long labels
  • Stacked bar → category × sub-category
  • Grouped bar → unweighted vs weighted comparison
  • Line / area → time-series
  • Doughnut → composition with ≤5 slices (center text = total)
  • Polar area → categorical magnitude
  • Radar → multi-dimensional profile
  • Scatter → correlation between fields (include trend line if |r|≥0.3)
  • Bubble → 3 dims: x, y, size = influence weight
  • Mixed (bar + line) → volume + average on twin axes
  • CSS gauge (SVG+CSS, NOT Chart.js) → headline KPIs

Every chart MUST have:
  • Descriptive title (bold, #f8fafc, 16px)
  • One-sentence caption explaining what it reveals (#94a3b8, 13px, italic)
  • Custom tooltip callbacks
  • responsive:true, maintainAspectRatio:false, height 280-360px
  • Distinct accent from the palette — rotate

================================================================
INTERACTIVITY — VANILLA ONLY
================================================================

1. Tab switching with opacity fade (220ms ease-out)
2. Animated counters on KPI cards (IntersectionObserver + requestAnimationFrame, 1200ms)
3. Reveal-on-scroll (.reveal class, opacity 0→1, translateY 12→0)
4. Card hover: translateY(-2px) + accent border + box-shadow
5. Sortable top-items table (click header to sort asc/desc, ▲/▼ indicator)
6. Collapsible sample-content cards ("Ver más" / "Show more")
7. Filter chips on Themes tab (click to filter in-place)
8. Copy-to-clipboard on methodology formulas
9. Respect @media (prefers-reduced-motion: reduce)

================================================================
CONTENT RULES
================================================================

- All text in ${localeLabel} — tab labels, titles, captions, tooltips, EVERYTHING.
- NEVER fabricate numbers. Every number must come from the DATASET SUMMARY.
- Recommendations: 4-7 items, PRIORITIZED (P1/P2/P3), each CITING an actual number.
- Executive summary: 4-6 bullets, each leads with a number.
- No lorem ipsum, no TODO, no placeholder text, no console.log.

================================================================
OUTPUT FORMAT
================================================================

- ONLY the raw HTML document.
- Starts with <!DOCTYPE html>, ends with </html>.
- No markdown code fences. No prose before or after. No explanation.

Build the report now.`;

  // User message: the pre-computed summary as JSON
  let summaryJson = JSON.stringify(summary, null, 2);

  // Progressive trimming if too large
  if (summaryJson.length > 40000) {
    const trimmed = { ...summary };
    // Halve the representative sample
    trimmed.representativeSample = summary.representativeSample.slice(
      0,
      Math.max(6, Math.ceil(summary.representativeSample.length / 2))
    );
    // Trim topItems to 10
    trimmed.topItems = summary.topItems.slice(0, 10);
    // Trim keywords to 15
    if (trimmed.textPatterns) {
      trimmed.textPatterns = {
        ...trimmed.textPatterns,
        topKeywords: trimmed.textPatterns.topKeywords.slice(0, 15),
      };
    }
    summaryJson = JSON.stringify(trimmed, null, 2);

    // If still too large, further truncate content snippets
    if (summaryJson.length > 40000) {
      const furtherTrimmed = JSON.parse(summaryJson);
      for (const item of furtherTrimmed.representativeSample ?? []) {
        if (item.content && item.content.length > 140) {
          item.content = item.content.slice(0, 140) + "…";
        }
      }
      for (const item of furtherTrimmed.topItems ?? []) {
        if (item.content && item.content.length > 140) {
          item.content = item.content.slice(0, 140) + "…";
        }
      }
      summaryJson = JSON.stringify(furtherTrimmed, null, 2);
    }
  }

  return { system, user: summaryJson };
}
