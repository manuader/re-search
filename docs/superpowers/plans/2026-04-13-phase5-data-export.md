# Phase 5: Data View + Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data table view with dynamic columns, filters, search, pagination, and Excel/CSV export via exceljs + Supabase Storage.

**Architecture:** Data page fetches raw_data for a project, flattens JSONB content + ai_fields into table columns. Export API route generates xlsx/csv server-side, uploads to Supabase Storage, returns signed URL.

**Tech Stack:** exceljs, Supabase Storage, shadcn/ui data table, Next.js API routes

---

## File Structure

```
src/
├── lib/
│   └── export/
│       ├── flatten.ts              # NEW: JSONB flattening logic
│       └── excel.ts                # NEW: Excel/CSV generation
├── app/
│   ├── api/
│   │   └── export/route.ts        # NEW: POST — generate + upload + return signed URL
│   └── [locale]/(dashboard)/
│       └── projects/[id]/
│           └── data/page.tsx       # NEW: data table page
├── components/
│   └── project/
│       ├── data-table.tsx          # NEW: dynamic columns table with filters
│       └── export-button.tsx       # NEW: export trigger button
```

---

### Task 1: Install exceljs

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install exceljs
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install exceljs for Excel export"
```

---

### Task 2: JSONB Flattening Utility

**Files:**
- Create: `src/lib/export/flatten.ts`

Takes raw_data rows (with content JSONB + ai_fields JSONB) and produces flat column arrays.

- [ ] **Step 1: Create flatten utility**

Create `src/lib/export/flatten.ts`:

```typescript
interface RawDataRow {
  id: string;
  source: string;
  content: Record<string, unknown>;
  ai_fields: Record<string, unknown> | null;
  created_at: string;
}

interface FlattenedResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export function flattenRawData(data: RawDataRow[]): FlattenedResult {
  if (data.length === 0) return { columns: [], rows: [] };

  // Collect all unique keys from content and ai_fields
  const contentKeys = new Set<string>();
  const aiKeys = new Set<string>();

  for (const row of data) {
    if (row.content && typeof row.content === "object") {
      Object.keys(row.content).forEach((k) => contentKeys.add(k));
    }
    if (row.ai_fields && typeof row.ai_fields === "object") {
      Object.keys(row.ai_fields).forEach((k) => aiKeys.add(k));
    }
  }

  // Build column order: source, content fields, ai_ prefixed fields
  const columns = [
    "source",
    ...Array.from(contentKeys).sort(),
    ...Array.from(aiKeys).sort().map((k) => k.startsWith("ai_") ? k : `ai_${k}`),
  ];

  // Flatten each row
  const rows = data.map((row) => {
    const flat: Record<string, unknown> = { source: row.source };

    // Content fields
    for (const key of contentKeys) {
      const val = row.content?.[key];
      flat[key] = typeof val === "object" && val !== null ? JSON.stringify(val) : val;
    }

    // AI fields with ai_ prefix
    for (const key of aiKeys) {
      const colName = key.startsWith("ai_") ? key : `ai_${key}`;
      const val = row.ai_fields?.[key];
      flat[colName] = typeof val === "object" && val !== null ? JSON.stringify(val) : val;
    }

    return flat;
  });

  return { columns, rows };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/export/
git commit -m "feat: add JSONB flattening utility for data export"
```

---

### Task 3: Excel/CSV Generation

**Files:**
- Create: `src/lib/export/excel.ts`

Uses exceljs to generate formatted xlsx and plain CSV.

- [ ] **Step 1: Create excel module**

Create `src/lib/export/excel.ts`:

The module exports two functions:

**`generateExcel(columns, rows, title)`** — Returns a Buffer of an xlsx file:
- Uses exceljs `Workbook` + `Worksheet`
- Headers: bold, Arial 10
- Auto-fit column widths based on content (max 50 chars)
- Freeze first row (headers)
- Returns `workbook.xlsx.writeBuffer()`

**`generateCsv(columns, rows)`** — Returns a string of CSV:
- Headers as first row
- Values escaped/quoted properly
- Handles commas and newlines in values

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/export/excel.ts
git commit -m "feat: add Excel/CSV generation — exceljs with formatted headers"
```

---

### Task 4: Export API Route

**Files:**
- Create: `src/app/api/export/route.ts`

POST endpoint that generates export file and uploads to Supabase Storage.

- [ ] **Step 1: Create export route**

Create `src/app/api/export/route.ts`:

The route:
1. Auth check (get user from Supabase)
2. Receive `{ projectId, format: "xlsx" | "csv" }`
3. Verify project belongs to user
4. Query all `raw_data` for the project (with content + ai_fields)
5. Flatten using `flattenRawData()`
6. Generate file using `generateExcel()` or `generateCsv()`
7. Upload to Supabase Storage bucket "exports" (path: `{userId}/{projectId}/export.{format}`)
8. Create signed URL (expires 24h = 86400 seconds)
9. Return `{ url: signedUrl, filename: "research-export.xlsx" }`

Handle errors: insufficient data, storage errors.

Note: The "exports" storage bucket must exist in Supabase. The route should create it if it doesn't exist (or document that it needs manual creation).

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/export/
git commit -m "feat: add export API route — generates Excel/CSV, uploads to Supabase Storage"
```

---

### Task 5: Data Table Component

**Files:**
- Create: `src/components/project/data-table.tsx`

A dynamic data table that adapts columns to the data shape.

- [ ] **Step 1: Create data table component**

Create `src/components/project/data-table.tsx` — "use client" component:

Props: `data: { columns: string[], rows: Record<string, unknown>[] }`, `loading: boolean`

Features:
- Dynamic columns from the flattened data
- Search/filter input (filters all columns)
- Source filter dropdown (filter by tool name)
- Sentiment filter dropdown (if ai_sentiment column exists)
- Sort by clicking column headers (asc/desc toggle)
- Pagination (20 rows per page)
- Responsive: horizontal scroll on mobile
- Uses Tailwind for styling, shadcn components where appropriate (Input, Badge)
- AI columns highlighted with a subtle different background or badge
- "No data" empty state

Keep it focused — no virtual scrolling or complex state management for MVP.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/project/data-table.tsx
git commit -m "feat: add data table component — dynamic columns, filters, sort, pagination"
```

---

### Task 6: Export Button Component

**Files:**
- Create: `src/components/project/export-button.tsx`

- [ ] **Step 1: Create export button**

Create `src/components/project/export-button.tsx` — "use client" component:

Props: `projectId: string`

Features:
- Dropdown with "Export Excel" and "Export CSV" options
- On click: POST to `/api/export` with projectId and format
- Loading state while generating
- On success: opens the signed URL in new tab (triggers download)
- On error: shows error toast/message
- Uses shadcn Button + DropdownMenu

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/project/export-button.tsx
git commit -m "feat: add export button component — Excel/CSV download trigger"
```

---

### Task 7: Data Page

**Files:**
- Create: `src/app/[locale]/(dashboard)/projects/[id]/data/page.tsx`

Server component that loads project data and renders the data table + export button.

- [ ] **Step 1: Create data page**

Create the page:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { flattenRawData } from "@/lib/export/flatten";
import { DataTable } from "@/components/project/data-table";
import { ExportButton } from "@/components/project/export-button";
import type { Locale } from "@/types";

export default async function DataPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const supabase = await createClient();

  // Auth + ownership check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: project } = await supabase
    .from("research_projects")
    .select("id, user_id, title, status")
    .eq("id", id)
    .single();

  if (!project || project.user_id !== user.id) redirect(`/${locale}`);

  // Fetch raw data
  const { data: rawData } = await supabase
    .from("raw_data")
    .select("id, source, content, ai_fields, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const flattened = flattenRawData(rawData ?? []);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{project.title} — Data</h1>
        <ExportButton projectId={id} />
      </div>
      <div className="flex-1">
        <DataTable data={flattened} loading={false} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/(dashboard)/projects/[id]/data/"
git commit -m "feat: add data page — table view with export"
```

---

### Task 8: Add Navigation Tabs to Project Page

**Files:**
- Modify: `src/app/[locale]/(dashboard)/projects/[id]/page.tsx` or create a shared layout

Add tab navigation (Chat | Data | Report) to the project pages so users can switch between views.

- [ ] **Step 1: Create a project layout or update existing pages**

The simplest approach: create `src/app/[locale]/(dashboard)/projects/[id]/layout.tsx` that renders tabs at the top:
- Chat tab → `/projects/[id]`
- Data tab → `/projects/[id]/data`
- Report tab → `/projects/[id]/report` (placeholder for Phase 6)

Uses shadcn `Tabs` component with `next/link` for navigation. Highlights current tab based on pathname.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/(dashboard)/projects/[id]/"
git commit -m "feat: add project layout with tab navigation — Chat, Data, Report"
```

---

### Task 9: Final Build Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

Verify new routes:
- `/[locale]/projects/[id]/data` — data table page
- `/api/export` — export endpoint

- [ ] **Step 2: Verify git log**

```bash
git log --oneline | head -15
```
