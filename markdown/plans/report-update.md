# Misión

Empezá por la Fase 0 y mostrameón de reportes de investigación para que produzca informes interactivos, precisos y adaptados al contexto del usuario. El sistema debe funcionar de forma robusta para datasets de **cualquier tamaño N** (desde 20 filas hasta 50.000+), y cada número que aparezca en el reporte final debe ser trazable a una estadística pre-computada — cero alucinación numérica.

---

# Fase 0 — Exploración (OBLIGATORIA antes de escribir código)

Antes de modificar nada:

1. Listá el árbol del repo con `tree -L 3 -I 'node_modules|.next|.git|dist|build'` o equivalente.
2. Encontrá y leé **completos** estos archivos (buscalos por nombre aproximado, los nombres exactos varían):
   - El archivo donde vive el prompt actual de generación de reportes se encuentran en la carpeta /scr/lib.ai (contiene el string `"You are a professional data-analyst report generator"`).
   - La función/endpoint que llama al LLM para generar el HTML del reporte.
   - El código que recibe los datos crudos del scraping (tweets, reviews, etc.) y los pasa al generador.
   - Los tipos/schemas de los datos scrapeados (buscá `interface`, `type`, `zod`, `z.object`).
   - El componente que renderiza el HTML devuelto (buscá `dangerouslySetInnerHTML`, `iframe srcDoc`, o similar).
1. Identificá qué fuentes de datos existen hoy estan en /scr/apify/catalog.ts (twitter, google_maps_reviews, linkedin, etc.) y qué campos trae cada una.
2. Resumime en ≤10 bullets qué encontraste antes de tocar código. **No asumas estructura — leé.**

Si algo no está claro, preguntame antes de avanzar. No inventes rutas ni nombres de funciones.

---

# Fase 1 — Construir el módulo `buildDatasetSummary`

Este es el componente crítico. Creá un módulo nuevo (ubicalo donde tenga sentido dado el repo que exploraste — probablemente `lib/reports/` o `server/reports/`).

## Objetivo

Convertir el dataset crudo (array de N items) en un objeto `DatasetSummary` denso, estadísticamente sólido y de tamaño acotado, que será inyectado en el prompt del LLM. **El LLM nunca debe ver las N filas crudas** — sólo este summary.

## Firma

```typescript
type SourceType = 'twitter' | 'instagram' | 'tiktok' | 'linkedin' 
                | 'google_maps_reviews' | 'tripadvisor'
                | 'google_maps_places' | 'news' | 'generic';

interface BuildSummaryInput {
  items: RawItem[];          // dataset completo, cualquier N
  source: SourceType;
  userBrief: string;         // brief del usuario (verbatim)
  enrichments: {             // flags de qué enriquecimientos de IA corrieron
    sentiment: boolean;
    categories: boolean;
    demographics: boolean;
    geo: boolean;
    topics: boolean;
  };
  locale: 'es' | 'en';
}

function buildDatasetSummary(input: BuildSummaryInput): DatasetSummary
```

## Reglas de muestreo N-adaptativas (CRÍTICAS)

El tamaño de la muestra `representativeSample` **debe adaptarse a N**, no ser fijo:

| N (tamaño del dataset) | Muestra a incluir         | Estrategia                                                        |
|------------------------|---------------------------|-------------------------------------------------------------------|
| N ≤ 30                 | N (todos)                 | Dataset chico: incluir todo, caveat en `methodology.limitations`  |
| 30 < N ≤ 150           | min(N, 40)                | Estratificado por engagement + random fill                        |
| 150 < N ≤ 1.000        | 50                        | Estratificado completo (ver abajo)                                |
| 1.000 < N ≤ 10.000     | 80                        | Estratificado completo                                            |
| N > 10.000             | 120                       | Estratificado completo + reservoir sampling para el bucket random |

**Las estadísticas agregadas (medias, percentiles, correlaciones, totales) se computan SIEMPRE sobre los N items completos, jamás sobre la muestra.** La muestra es sólo para que el LLM vea contenido representativo; los números vienen de la población entera.

## Estratificación de `representativeSample`

Distribuí los slots de la muestra así (ajustá proporciones si alguna dimensión no aplica):

- **30% top engagement** — los ítems con mayor `influenceWeight` (fórmulas abajo).
- **15% bottom engagement** — los de menor influencia (baseline del "ruido").
- **20% muestra del percentil medio** — items cerca de la mediana de engagement.
- **15% outliers de sentimiento** — si hay sentiment: los más positivos y más negativos.
- **10% distribuidos temporalmente** — uno por bucket de tiempo equiespaciado en el rango de fechas.
- **10% random uniforme** — para capturar cola larga (usar reservoir sampling si N > 10k).

Si un bucket no tiene suficientes ítems (ej. no hay sentiment enrichment), redistribuí sus slots proporcionalmente al resto. **Nunca duplicar items** entre buckets — marcá cada item como "ya tomado" al asignarlo.

Para cada item en la muestra, incluí **sólo estos campos** (truncá `content` a 280 chars con "…" si excede):

```typescript
interface SampleItem {
  id: string;
  content: string;              // truncado a 280 chars
  author?: string;
  date?: string;                // ISO
  influenceWeight: number;      // pre-calculado
  engagementRaw: {              // sólo campos presentes en la fuente
    views?: number; likes?: number; reposts?: number; 
    comments?: number; rating?: number; helpful?: number;
  };
  sentiment?: number;           // si existe enrichment
  category?: string;
  bucket: 'top' | 'bottom' | 'median' | 'sentiment_outlier' | 'temporal' | 'random';
  url?: string;
}
```

## Fórmulas de `influenceWeight` (por fuente)

```typescript
// Usar Math.log10(Math.max(x, 1)) para evitar -Infinity
const w = (source, item) => {
  switch (source) {
    case 'twitter':
    case 'instagram':
    case 'tiktok':
      return log10(max(
        item.views ?? 0,
        (item.likes ?? 0)*10 + (item.reposts ?? 0)*25 + (item.comments ?? 0)*15,
        1
      ));
    case 'linkedin':
      return log10(1 + (item.followers ?? 0) + (item.reactions ?? 0)*5);
    case 'google_maps_reviews':
    case 'tripadvisor':
    case 'yelp':
      return (1 + log10(1 + (item.helpful ?? 0))) 
           * min(2, (item.content?.length ?? 0) / 200);
    case 'google_maps_places':
      return log10(1 + (item.reviewCount ?? 0)) * (item.rating ? 1 : 0.5);
    default:
      return 1;
  }
};
```

## Estadísticas a pre-computar (sobre los N completos)

El objeto `DatasetSummary` debe exponer, como mínimo:

```typescript
interface DatasetSummary {
  meta: {
    totalItems: number;              // N real
    sampleSize: number;
    source: SourceType;
    dateRange: { from: string; to: string } | null;
    generatedAt: string;
    userBrief: string;
    enrichmentsPresent: string[];
    enrichmentsRequestedButMissing: string[];  // detectar del brief
  };

  engagement: {
    metric: 'views' | 'likes' | 'reposts' | 'rating' | 'reviewCount';
    total: number;
    mean: number;
    median: number;
    stdDev: number;
    percentiles: { p10; p25; p50; p75; p90; p99 };
    top10ConcentrationPct: number;   // % del total que capturan los top 10
    top1PctConcentrationPct: number; // % que capturan el top 1%
    giniCoefficient: number;         // 0 = igualdad, 1 = máxima desigualdad
    outlierCount: number;            // items > mean + 2σ
  };

  sentiment?: {                       // sólo si enrichment presente
    unweighted: { mean; median; stdDev; distribution: Record<bucket, count> };
    weighted:   { mean; median; stdDev; distribution: Record<bucket, count> };
    polarizationIndex: number;       // std/maxStd, 0–1
    deltaWeightedVsUnweighted: number;
    negativeAmplified: boolean;      // true si los top-engaged son más negativos que el promedio
  };

  temporal: {
    granularity: 'hour' | 'day' | 'week' | 'month'; // elegir según rango
    series: Array<{ bucket: string; count: number; avgEngagement: number; avgSentiment?: number }>;
    hourOfDay?: Record<0..23, { count; avgEngagement }>;
    dayOfWeek?: Record<0..6,  { count; avgEngagement }>;
    trend: 'rising' | 'falling' | 'flat' | 'volatile';  // regresión simple
  };

  segmentation: {                    // incluir sólo las dimensiones presentes
    byCategory?: Array<{ label; count; pctOfTotal; avgSentiment?; avgEngagement }>;
    byDemographic?: { age?: ...; class?: ...; gender?: ... };
    byLocation?: Array<{ label; count; pctOfTotal; avgSentiment? }>;
    crossTabs?: Array<{ dimA; dimB; matrix }>;  // ej. sentimiento × clase social
  };

  correlations: Array<{              // sólo |r| ≥ 0.3
    fieldA: string; fieldB: string; r: number; n: number;
  }>;

  topItems: SampleItem[];            // top 20 por influenceWeight
  representativeSample: SampleItem[];// la muestra estratificada

  textPatterns?: {                   // heurística simple, NO LLM
    topKeywords: Array<{ word; count; avgSentiment? }>;  // stop-words filtradas
    avgLengthChars: number;
    avgLengthByEngagementQuartile: Record<'q1'|'q2'|'q3'|'q4', number>;
  };
}
```

## Edge cases que DEBÉS manejar explícitamente

- **N === 0** → tirar error antes de llamar al LLM con mensaje claro.
- **N < 10** → generar summary pero añadir `limitations: ["dataset insuficiente para estadística robusta (N=X)"]`.
- **Todos los items con mismo engagement** → `giniCoefficient = 0`, no dividir por cero.
- **Sin fechas** → `dateRange = null`, omitir `temporal`.
- **Sin enrichments** → omitir `sentiment`, `segmentation.byCategory`, etc. y poblar `meta.enrichmentsRequestedButMissing` parseando el brief con regex simple (palabras como "sentimiento", "clase social", "edad", "ubicación").
- **Campos faltantes por item** → tolerar con `?? 0` / `?? null`, no crashear.

## Detección de campos requeridos por el brief (simple, sin LLM)

Implementá una función `detectRequestedFields(brief: string, locale): string[]` con regex/keywords:

```typescript
const patterns = {
  sentiment:    /sentimiento|sentiment|opini[oó]n/i,
  class:        /clase\s*social|socioeconomic|income/i,
  age:          /edad|rango\s*etario|age/i,
  location:     /ubicaci[oó]n|lugar|location|pa[ií]s|ciudad|provincia/i,
  gender:       /g[eé]nero|gender/i,
  // ...
};
```

Cruzá contra los campos efectivamente presentes; la diferencia va a `enrichmentsRequestedButMissing`.

## Tests unitarios (obligatorios)

Creá tests para `buildDatasetSummary` cubriendo:
- N = 0 (throw)
- N = 1, 5, 30 (paths de muestra chica)
- N = 200, 1.000, 10.000, 50.000 (tamaños variados, generar fixtures con faker o similar)
- Dataset sin enrichments
- Dataset con todos los enrichments
- Todos los items iguales (tests de división por cero)
- Cálculos de percentiles verificados contra valores conocidos
- Gini contra casos de referencia (array `[1,1,1,1]` → 0; `[0,0,0,100]` → cerca de 0.75)
- Que la muestra estratificada no repita items
- Que el tamaño de muestra respete la tabla N-adaptativa

---

# Fase 2 — Actualizar el prompt del generador de reportes

Reemplazá el prompt actual por el siguiente (mantenelo en un archivo dedicado, tipo `lib/reports/reportPrompt.ts`, exportando una función `buildReportPrompt(summary, projectTitle, locale)`):

“const prompt = `You are an elite hybrid: senior data analyst + frontend engineer. Your job is to turn a research dataset into a COMPLETE, self-contained, interactive HTML report that surfaces non-obvious, quantified, actionable intelligence — tailored to the user's specific research objective. Generic is failure. Every section must justify its existence with a number.

================================================================
INPUT CONTEXT
================================================================

USER RESEARCH BRIEF (verbatim — THIS IS THE NORTH STAR for what matters):
"""
${userContext}
"""

PROJECT TITLE: "${projectTitle}"
LOCALE: ${locale === "es" ? "Spanish (Latin American / rioplatense-friendly, avoid Spain-isms)" : "English"}
DATA SOURCES PRESENT: ${sourcesList}   // e.g. ["twitter", "google_maps_reviews", "linkedin"]
AI ENRICHMENTS AVAILABLE: ${enrichmentFlags}   // { sentiment, categories, demographics, geo, topics, ... } booleans
DATASET SUMMARY (pre-aggregated stats, top items, representative samples):
${datasetSummary}

================================================================
PHASE 1 — THINK BEFORE YOU WRITE (silently)
================================================================

Before emitting any HTML, internally do this:

1. Parse USER RESEARCH BRIEF and extract:
   • Primary decision the report must inform (election forecast? product launch? location scouting? hiring signal?)
   • Domain (politics, hospitality, SaaS UX, recruiting, competitive intel, tourism, etc.)
   • Entities named (people, brands, places, products)
   • Implicit hypotheses (what does the user EXPECT to find? The report should confirm or contradict them explicitly.)
   • Fields the user requested that ARE and ARE NOT present in the dataset.

2. Inspect DATASET SUMMARY and classify each available field as:
   • RELEVANCE SIGNAL (views, likes, reposts, comments, followers, rating, review_count, helpful_votes, review_length…)
   • SEGMENTATION DIMENSION (age, class, location, gender, platform, language, date, role, industry…)
   • CONTENT (free text — to mine for themes, keywords, aspects)
   • IDENTIFIER (username, post_id, url — for linking, not stats)

3. Design the report AROUND this use case. A political opinion study needs polarization + influencer concentration + geographic breakdown. A hotel review study needs rating trajectory + aspect-based sentiment (service/cleanliness/price) + owner response rate. Do NOT apply a generic template.

================================================================
PHASE 2 — WEIGHTED STATISTICS (NON-NEGOTIABLE)
================================================================

Not all rows are equal. A tweet seen by 50,000 people is NOT equivalent to one seen by 20. Reflect this.

Compute an influence weight per row based on source:
  • Social posts (Twitter/Instagram/TikTok):
      weight = log10( max( views, likes*10 + reposts*25 + comments*15, 1 ) )
  • Reviews (Google Maps / TripAdvisor / Yelp):
      weight = (1 + log10(1 + helpful_votes)) * min(2, review_length_chars / 200)
  • LinkedIn / professional:
      weight = log10( 1 + followers + reactions*5 )
  • Business listings / places:
      weight = log10( 1 + review_count ) * rating_confidence

For EVERY aggregate metric that can be weighted (sentiment, category share, demographic distribution), report BOTH:
  • Unweighted (one row = one vote)
  • Engagement-weighted (impact-adjusted)
And surface the delta when it's non-trivial. Example insight:
  "Average sentiment: 5.8/10 unweighted vs 3.9/10 engagement-weighted — the loudest voices are markedly more negative."

Always compute, where data supports it:
  • Mean, median, mode, std deviation
  • Percentiles P10 / P25 / P50 / P75 / P90 / P99
  • Top-10 concentration (share of total engagement captured by top 10 items)
  • Distribution shape (symmetric / left-skewed / right-skewed / bimodal)
  • Temporal patterns (hour-of-day, day-of-week, trend over the date window)
  • Correlations between numeric fields (only report when |r| ≥ 0.3)
  • Outliers (> 2σ from mean on influence-weighted metrics)
  • Polarization index for sentiment: std(sentiment) / max_possible_std — report 0–100%.

================================================================
PHASE 3 — NON-OBVIOUS INSIGHTS (MANDATORY BAR)
================================================================

Every insight must be QUANTIFIED and NON-TRIVIAL. Use the template: [Specific number] + [surprising comparison] + [implication].

✅ Good: "The 12 most-liked posts (1.2% of the dataset) account for 48% of total engagement, and their engagement-weighted sentiment is 2.1 points lower than the median — detractors are amplified."
✅ Good: "Negative reviews are 2.3× longer than positive ones (avg 340 vs 147 chars); complainers invest more effort, making their content more search-indexable."
✅ Good: "Posts between 21:00–23:00 get 41% more reposts than the daily mean, but only 8% more likes — night audiences share, day audiences endorse."
✅ Good: "'Upper-middle' class shows sentiment σ = 3.1 vs 1.8 dataset-wide — this segment is the most internally divided."
❌ Forbidden: "opinions are mixed", "engagement is high", "more research is needed", "there are both positive and negative views".

Minimum: 8 quantified, non-trivial insights across the report.

================================================================
TECHNICAL CONSTRAINTS (DO NOT BREAK)
================================================================

- Single self-contained HTML document. Starts <!DOCTYPE html>, ends </html>.
- Chart.js v4 via CDN, ONLY this library:
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
- No React, no JSX, no Babel, no Tailwind, no Alpine, no jQuery. Vanilla HTML/CSS/JS only.
- All CSS inside one <style> block. All JS inline in <script> tags (prefer at end of <body>).
- Responsive: max-width 1280px centered container, CSS Grid + Flexbox, must survive down to 768px without horizontal scroll.
- Respect prefers-reduced-motion (disable non-essential animations).

================================================================
VISUAL DESIGN (EXPANDED PALETTE — USE IT)
================================================================

Dark theme, layered:
  Page bg:         #0a0e1a
  Card bg:         #0f172a
  Elevated bg:     #1e293b
  Input/hover bg:  #1a2234
  Border subtle:   rgba(148,163,184,0.12)
  Border accent:   rgba(96,165,250,0.35)

Text:
  Primary:   #f8fafc
  Secondary: #cbd5e1
  Muted:     #64748b

Accents (rotate across charts — NEVER use the same primary accent on two adjacent charts):
  Blue     #60a5fa
  Green    #34d399
  Amber    #fbbf24
  Red      #f87171
  Violet   #a78bfa
  Pink     #f472b6
  Cyan     #22d3ee
  Orange   #fb923c

Use gradients on the hero title and top stat cards:
  background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 60%, #f472b6 100%);
  -webkit-background-clip: text; color: transparent;

System font stack. Rounded corners 12–16px. Card padding 24–32px. Line-height 1.6. Headings tight (1.2).

================================================================
LAYOUT — TABBED NAVIGATION (MANDATORY)
================================================================

Render a top-level horizontal tab bar (buttons, role="tab"). Vanilla JS swaps the visible panel. Active tab: brighter text + 2px accent-colored bottom border + subtle bg tint. Inactive panels: display:none. Transition content-in with opacity 0→1 over 220ms.

Choose 5–8 tabs ADAPTED to the research context. Skip any tab whose data isn't present. Suggested set:
  1. 📊 Resumen / Overview — hero KPI cards + signature chart + 4–6 executive bullets
  2. 💬 Sentimiento / Sentiment — distribution, polarization index, weighted vs unweighted
  3. 🔥 Alcance & Engagement — top performers, concentration curve, virality outliers
  4. 👥 Audiencia / Audience — segmentation (age, class, geo, role, industry) with cross-tabs
  5. ⏱️ Patrones Temporales / Temporal — time-series, hour×day heatmap, trend direction
  6. 🎯 Temas / Themes — keyword frequency, theme×sentiment matrix, category filter chips
  7. ⭐ Top Voces / Top Items — sortable table (rank, user/item, metric, sentiment, link)
  8. 🧭 Recomendaciones / Recommendations — P1/P2/P3 prioritized, each tied to a number
  9. 📋 Metodología / Methodology — sources, N, date range, weighting formulas, LIMITATIONS

If the user's brief promised a field (e.g. "clase social estimada") that isn't in the dataset, FLAG IT EXPLICITLY in Methodology:
  "LIMITACIÓN: El brief solicitaba clase social estimada; esta dimensión no está presente en el dataset. Recomendación: re-ejecutar enriquecimiento demográfico para habilitar la pestaña Audiencia."

================================================================
CHARTS — USE AT LEAST 7 DIFFERENT TYPES
================================================================

Don't default to bar+pie. Match chart to job:
  • Horizontal bar → top-N with long labels
  • Stacked bar → category × sub-category
  • Grouped bar → unweighted vs weighted comparison
  • Line / area → time-series
  • Doughnut → composition with ≤5 slices (center text = total)
  • Polar area → categorical magnitude
  • Radar → multi-dimensional profile (e.g. sentiment across 6 topics)
  • Scatter → correlation between two numeric fields (include regression line as a second dataset if |r|≥0.3)
  • Bubble → 3 dims: x, y, size = influence weight
  • Mixed (bar + line) → volume + average on twin axes
  • CSS gauge / progress ring (NOT Chart.js, pure SVG+CSS) → for headline KPIs (e.g. "Probabilidad estimada de reelección según este dataset: 38%")
  • Heatmap via Chart.js matrix-style stacked bars OR pure HTML grid with rgb() cells → hour × day engagement

Every chart MUST have:
  • Descriptive title above (bold, #f8fafc, 16px)
  • One-sentence caption below explaining what it reveals (#94a3b8, 13px, italic)
  • Custom tooltip callbacks showing: raw count, % of total, weighted value where relevant
  • responsive:true, maintainAspectRatio:false, inside a container with fixed height (280–360px)
  • Axes: grid rgba(148,163,184,0.08), ticks #94a3b8, legend #cbd5e1
  • Distinct primary accent color from the palette — rotate

================================================================
INTERACTIVITY — VANILLA ONLY (IMPLEMENT ALL)
================================================================

1. Tab switching with fade (opacity transition, 220ms ease-out).
2. Animated counters on KPI cards: count from 0 → final over 1200ms on first scroll into view. Use IntersectionObserver + requestAnimationFrame + easeOutCubic.
3. Reveal-on-scroll: .reveal class toggles opacity 0→1 and translateY(12px→0) when intersecting.
4. Card hover: translateY(-2px) + border color → accent + subtle box-shadow, 200ms.
5. Sortable top-items table: click column header to sort asc/desc; render ▲/▼ indicator.
6. Collapsible sample-content cards: "Ver más" toggles full text (max-height transition).
7. Filter chips on Themes tab: click a category chip to filter the items list in-place (no reload).
8. Smooth-scroll on any internal anchor.
9. Copy-to-clipboard button on the weighting-formula block in Methodology (uses navigator.clipboard; fallback to execCommand).
10. Respect @media (prefers-reduced-motion: reduce) — disable transforms/fades, keep functional.

Keep all animations ≤ 300ms, ease-out. No bouncing, no parallax, no anything tacky.

================================================================
SOURCE-SPECIFIC EMPHASIS (apply based on sourcesList)
================================================================

- Twitter/X / Instagram / TikTok: engagement-weighted sentiment, influencer concentration (top-1% share of engagement), hashtag / mention co-occurrence, virality outliers, like-to-view ratio as "resonance score".
- LinkedIn: seniority distribution, industry × sentiment cross-tab, company concentration, post-type performance.
- Google Maps Reviews / TripAdvisor / Yelp: rating distribution + trajectory over time, review-length vs rating scatter, owner-response rate by rating bucket, aspect-based sentiment (service / precio / limpieza / ubicación / atención), 1-star vs 5-star content contrast.
- Google Maps business listings: geographic clustering (rough lat/lng bucketing), rating × review-count scatter (with quadrant labels: "hidden gems", "tourist traps", "overlooked", "crowd favorites"), category saturation.
- News / blogs: source diversity, publication cadence, author concentration, stance if sentiment available.

================================================================
CONTENT RULES
================================================================

- All user-facing text in ${locale === "es" ? "Spanish (Latin America)" : "English"} — tab labels, titles, captions, tooltips, table headers, EVERYTHING.
- NEVER fabricate numbers. Every number shown must be derivable from the provided DATASET SUMMARY. If a stat can't be computed, omit it.
- If the user's brief requested a field not in the data, flag it in Methodology → Limitations (do NOT silently skip).
- Recommendations: 4–7 items, each PRIORITIZED (P1/P2/P3), SPECIFIC to the user's objective, and CITING an actual number from the dataset. No generic "do more research" filler.
- Executive summary: 4–6 bullets, each leads with a number.
- No lorem ipsum, no TODO, no placeholder text, no console.log left in.

================================================================
OUTPUT FORMAT
================================================================

- Respond with ONLY the raw HTML document.
- Starts with <!DOCTYPE html>, ends with </html>.
- No markdown code fences. No prose before or after. No explanation.

Build the report now.`;”

Ese prompt espera recibir:
- `userContext` → `summary.meta.userBrief`
- `projectTitle` → desde el proyecto
- `locale` → `'es' | 'en'`
- `sourcesList` → `[summary.meta.source]` o array si hay múltiples
- `enrichmentFlags` → `summary.meta.enrichmentsPresent`
- `datasetSummary` → `JSON.stringify(summary, null, 2)` **truncado si excede X tokens** (ver abajo)

## Control de tamaño del prompt

Calculá el tamaño aproximado del `JSON.stringify(summary)`. Si excede ~40k caracteres:
1. Reducí `representativeSample` a la mitad (priorizando mantener al menos 2 items por bucket).
2. Reducí `topItems` de 20 a 10.
3. Truncá `textPatterns.topKeywords` a top 30.
4. Si aún excede, loggeá warning pero procedé.

Nunca pases el dataset crudo. Nunca.

---

# Fase 3 — Validación post-generación (anti-alucinación)

Después de que el LLM devuelva el HTML, antes de guardarlo/mostrarlo:

## Validador 1 — Estructural

```typescript
function validateReportHTML(html: string): ValidationResult {
  const checks = {
    startsWithDoctype: html.trim().startsWith('<!DOCTYPE html>'),
    hasChartJsCDN: html.includes('cdn.jsdelivr.net/npm/chart.js@4'),
    noReact: !/\bReact\b|ReactDOM|from ['"]react['"]/.test(html),
    noMarkdownFences: !html.trim().startsWith('```'),
    hasTabs: /role=['"]tab['"]/.test(html) || /class=['"][^'"]*tab/i.test(html),
    minCharts: (html.match(/new Chart\(/g) ?? []).length >= 5,
    closesHtml: html.trim().endsWith('</html>'),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}
```

Si falla, re-pedí al LLM con el feedback específico (máx 1 reintento).

## Validador 2 — Numérico (crítico anti-alucinación)

Extraé todos los números con ≥3 dígitos del HTML (regex `\b\d{3,}(?:[.,]\d+)?\b` y porcentajes). Para cada uno, verificá que **exista o sea derivable** del `DatasetSummary`:

```typescript
function extractNumbers(html: string): number[] { ... }

function numbersAreGrounded(html: string, summary: DatasetSummary): {
  ok: boolean;
  suspicious: number[];  // números que no matchean nada en el summary
} {
  const allSummaryNumbers = collectAllNumericValues(summary); // recursivo
  const tolerances = [0, 1]; // match exacto o off-by-one por redondeo
  // también aceptar porcentajes derivables: x/total*100
  // ...
}
```

Si hay >3 números "sospechosos", loggeá warning con la lista y marcá el reporte como `qualityFlag: 'needs_review'`. No bloquees la entrega por defecto (podés hacer feature flag), pero dejá trazabilidad.

## Validador 3 — Sandbox de ejecución

Renderizá el HTML en un iframe aislado con `sandbox="allow-scripts"` en un entorno de test (puppeteer/playwright en CI) y verificá:
- No tira errores en consola.
- Al menos 5 `<canvas>` quedan con contenido pintado (width/height > 0).
- Cambiar de pestaña no rompe el layout.

---

# Fase 4 — Integración

1. Actualizá el endpoint/función que orquesta la generación:
```
   raw items → buildDatasetSummary → buildReportPrompt → LLM call → validateReportHTML → (retry si falla) → numbersAreGrounded → guardar
```
1. Añadí logging estructurado en cada paso (N, sampleSize, promptChars, validationResults, qualityFlag).
2. Exponé `qualityFlag` en la respuesta del endpoint para que el frontend pueda mostrar un banner tipo "Este reporte contiene cifras no verificadas" si corresponde.
3. Asegurate de que el componente que renderiza el HTML sigue funcionando sin cambios (el HTML generado debe ser drop-in compatible con el sistema actual — misma CDN, mismo modo de render).

---

# Restricciones duras (NO HACER)

- ❌ No cambies las librerías externas permitidas. Sigue siendo **sólo Chart.js v4 por CDN** en el HTML renderizado.
- ❌ No pases datos crudos al LLM. Sólo el `DatasetSummary`.
- ❌ No hagas que el LLM compute estadísticas. Todo cálculo numérico va en TypeScript.
- ❌ No uses muestra de tamaño fijo; respetá la tabla N-adaptativa.
- ❌ No rompas la interfaz pública de funciones existentes si otros módulos las consumen — agregá parámetros opcionales o nuevas funciones en paralelo.
- ❌ No introduzcas dependencias nuevas sin justificarlo (para stats, implementá percentiles/stddev/gini a mano — son triviales).

---

# Criterios de aceptación

El PR está listo cuando:

1. ✅ `buildDatasetSummary` tiene tests unitarios verdes cubriendo todos los tamaños de N listados.
2. ✅ Un fixture de 50 reviews de Google Maps produce un summary válido, distinto en forma al de 1.000 tweets (segmentación y pesos específicos por fuente).
3. ✅ Un fixture de 50.000 tweets genera un summary que se serializa en < 40k caracteres.
4. ✅ El prompt generado con cualquier fixture hace que el LLM devuelva HTML que pasa los 3 validadores.
5. ✅ Una corrida end-to-end con el brief del ejemplo (Milei, 1.000 tweets) produce un reporte con: ≥5 pestañas, ≥7 charts de ≥4 tipos distintos, ≥8 insights cuantificados, sección de limitaciones que menciona explícitamente los campos que el brief pidió y faltaron.
6. ✅ Un brief sobre reviews de un restaurante produce un reporte estructuralmente diferente (pestañas y métricas adaptadas a hospitality, no a política).
7. ✅ Logs muestran `N, sampleSize, promptChars, validationResults` por cada generación.
8. ✅ Cero `any` nuevos sin comentario justificando por qué.

---

# Orden sugerido de implementación

1. Exploración + resumen del repo.
2. Tipos (`DatasetSummary`, `SampleItem`, `SourceType`).
3. Utilidades estadísticas puras (`percentile`, `stddev`, `gini`, `pearson`) con tests.
4. `buildDatasetSummary` con tests.
5. `buildReportPrompt` (pegar prompt largo).
6. Validadores.
7. Integración en el endpoint.
8. Test end-to-end con fixture real.
9. Limpieza + README corto del módulo.

Empezá por la Fase 0 y mostrame el resumen antes de avanzar.