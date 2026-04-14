# Phase 6: Reports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the report generation system — aggregate raw data into a summary, send a single prompt to Claude Sonnet 4.6, receive a self-contained interactive HTML with Recharts charts, save to DB, and render in a sandboxed iframe.

**Architecture:** API route aggregates project data into a compact JSON summary (~2-4K tokens), sends one prompt to Sonnet 4.6 via Anthropic API, receives complete HTML with Recharts (CDN) + React/ReactDOM (CDN) + inline styles. HTML saved to `reports.html_content`, served via sandboxed iframe.

**Tech Stack:** Anthropic API (Claude Sonnet 4.6), Supabase, Next.js API routes

---

## File Structure

```
src/
├── lib/
│   └── ai/
│       └── report-generator.ts         # NEW: data aggregation + report prompt
├── app/
│   ├── api/
│   │   └── report/route.ts            # NEW: POST — generate report
│   └── [locale]/(dashboard)/
│       └── projects/[id]/
│           └── report/page.tsx         # NEW: report viewer page
├── components/
│   └── project/
│       └── report-viewer.tsx           # NEW: sandboxed iframe renderer
```

---

### Task 1: Report Generator (Data Aggregation + Prompt)

**Files:**
- Create: `src/lib/ai/report-generator.ts`

- [ ] **Step 1: Create report generator module**

Create `src/lib/ai/report-generator.ts` with two exports:

**`aggregateProjectData(projectId, supabase)`** — Queries raw_data and scraping_jobs for the project, computes summary statistics:
- Total results count
- Results per source (tool name)
- Date range (min/max created_at)
- Tools used (names)
- If ai_fields exist: sentiment distribution (count positive/neutral/negative), top categories, top pain points, average scores
- 10 representative sample items (first 5 + last 5)
- Returns a compact JSON object (~2-4K tokens)

**`generateReportPrompt(aggregatedData, projectTitle, locale)`** — Builds the system prompt and user message for Sonnet:

System prompt:
```
You are a data analyst creating interactive HTML reports. Generate a COMPLETE, self-contained HTML document with:
- React 18 via CDN (https://unpkg.com/react@18/umd/react.production.min.js)
- ReactDOM 18 via CDN (https://unpkg.com/react-dom@18/umd/react-dom.production.min.js)  
- Recharts via CDN (https://unpkg.com/recharts@2/umd/Recharts.js)
- ALL styles inline (no external CSS)
- Responsive design
- Professional, clean appearance with a dark theme

The HTML must include:
1. Executive summary (2-3 paragraphs)
2. Key insights (3-5 bullet points)
3. Data visualizations using Recharts (PieChart, BarChart, LineChart as appropriate)
4. Detailed breakdown by source
5. Actionable recommendations (3-5 bullet points)

Respond with ONLY the complete HTML document. No markdown, no explanation.
Language: {locale === "es" ? "Spanish" : "English"}
```

User message: the aggregated data JSON stringified.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/report-generator.ts
git commit -m "feat: add report generator — data aggregation + Sonnet prompt builder"
```

---

### Task 2: Report API Route

**Files:**
- Create: `src/app/api/report/route.ts`

- [ ] **Step 1: Create report route**

POST endpoint that generates a report:

1. Auth check
2. Receive `{ projectId }` 
3. Verify project belongs to user and has data (status completed or has raw_data)
4. Call `aggregateProjectData(projectId, supabase)`
5. Call `generateReportPrompt(data, title, locale)`
6. Send to Anthropic API directly (NOT via Vercel AI SDK — this is a one-shot non-streaming call):
   ```
   POST https://api.anthropic.com/v1/messages
   model: claude-sonnet-4-6-20250514
   max_tokens: 8192
   system: systemPrompt
   messages: [{ role: "user", content: userMessage }]
   ```
7. Extract HTML from response content
8. Save to `reports` table: `{ project_id, title, html_content }`
9. Return `{ reportId, html_content }` (return HTML so client can render immediately)

Use fetch directly to Anthropic API (same pattern as enrichment.ts). Model: `claude-sonnet-4-6-20250514`.

Handle errors: no data, API failure, invalid response.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/report/
git commit -m "feat: add report API route — generates interactive HTML via Sonnet 4.6"
```

---

### Task 3: Report Viewer Component

**Files:**
- Create: `src/components/project/report-viewer.tsx`

- [ ] **Step 1: Create report viewer**

"use client" component that renders the report HTML in a sandboxed iframe.

Props: `htmlContent: string | null`, `loading: boolean`, `onGenerate: () => void`

States:
- No report + not loading: show "Generate Report" button + description
- Loading: show skeleton/spinner with "Generating report..."
- Has report: render in iframe

The iframe uses `srcdoc` and `sandbox="allow-scripts"`:
```html
<iframe
  sandbox="allow-scripts"
  srcdoc={htmlContent}
  className="w-full h-full border-0"
  title="Research Report"
/>
```

`sandbox="allow-scripts"` allows Recharts to run but blocks navigation, forms, parent DOM access.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/project/report-viewer.tsx
git commit -m "feat: add report viewer component — sandboxed iframe renderer"
```

---

### Task 4: Report Page

**Files:**
- Create: `src/app/[locale]/(dashboard)/projects/[id]/report/page.tsx`

- [ ] **Step 1: Create report page**

This page needs to:
1. Server-side: check if a report already exists for this project
2. If exists: pass the html_content to a client component
3. If not: show the "Generate Report" button
4. The client component handles the generate flow (POST /api/report, show loading, render result)

Approach: Server component loads existing report, renders a client wrapper that handles both display and generation.

Create the page + a client wrapper component (can be inline or separate):

```typescript
// Server component
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportPageClient } from "./report-client";

export default async function ReportPage({ params }) {
  // Auth + ownership check
  // Fetch existing report from reports table
  // Render client component with initialReport
}
```

Also create `src/app/[locale]/(dashboard)/projects/[id]/report/report-client.tsx`:
```typescript
"use client";
// Uses ReportViewer component
// Has state for loading/generating
// Calls POST /api/report on generate
// Shows existing report or generate button
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/(dashboard)/projects/[id]/report/"
git commit -m "feat: add report page — viewer with generate button"
```

---

### Task 5: Final Build Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

Verify new routes:
- `/[locale]/projects/[id]/report` — report page
- `/api/report` — report generation endpoint

- [ ] **Step 2: Verify git log**

```bash
git log --oneline | head -10
```
