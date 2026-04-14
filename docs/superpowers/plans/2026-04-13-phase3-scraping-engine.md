# Phase 3: Scraping Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the scraping execution pipeline — Apify API client, Inngest background jobs (execute + poll + download + validate), realtime progress tracking, and cost reconciliation.

**Architecture:** When user confirms research, `executeResearch` tool dispatches an Inngest event. Inngest runs each scraping job sequentially: starts Apify actor → polls status → downloads dataset → validates data → inserts into raw_data → updates progress. Supabase Realtime pushes status changes to the frontend. After all jobs complete, costs are reconciled.

**Tech Stack:** Inngest (background jobs), Apify REST API (scraping), Supabase (DB + Realtime), Next.js API routes

---

## File Structure

```
src/
├── lib/
│   ├── apify/
│   │   ├── catalog.ts              # (exists) static catalog
│   │   ├── client.ts               # NEW: Apify REST API wrapper
│   │   └── validator.ts            # NEW: post-scraping data validation
│   ├── inngest/
│   │   ├── client.ts               # (exists) Inngest client
│   │   └── functions/
│   │       └── execute-research.ts  # NEW: main scraping pipeline
│   └── ai/
│       └── chat-tools.ts           # MODIFY: add Inngest dispatch to executeResearch
├── app/
│   ├── api/
│   │   └── inngest/route.ts        # MODIFY: register execute-research function
│   └── [locale]/(dashboard)/
│       └── projects/[id]/
│           └── page.tsx            # MODIFY: show progress tracker when running
├── components/
│   └── project/
│       └── progress-tracker.tsx    # NEW: realtime scraping progress UI
└── hooks/
    └── use-realtime-progress.ts    # NEW: Supabase Realtime subscription hook
```

---

### Task 1: Apify REST API Client

**Files:**
- Create: `src/lib/apify/client.ts`

A thin wrapper around the Apify REST API. No SDK — just fetch calls.

- [ ] **Step 1: Create Apify client**

Create `src/lib/apify/client.ts` with these functions:

```typescript
const APIFY_BASE_URL = "https://api.apify.com/v2";
const APIFY_TOKEN = process.env.APIFY_API_TOKEN!;

interface ApifyRunResult {
  id: string;
  status: string;
  defaultDatasetId: string;
  stats?: {
    inputBodyLen?: number;
    restartCount?: number;
  };
  usage?: {
    USD?: number;
  };
}

// Start an actor run
export async function startActorRun(
  actorId: string,
  input: Record<string, unknown>
): Promise<ApifyRunResult> {
  const res = await fetch(
    `${APIFY_BASE_URL}/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify start failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.data;
}

// Check run status
export async function getRunStatus(runId: string): Promise<ApifyRunResult> {
  const res = await fetch(
    `${APIFY_BASE_URL}/actor-runs/${runId}?token=${APIFY_TOKEN}`
  );

  if (!res.ok) {
    throw new Error(`Apify status check failed (${res.status})`);
  }

  const data = await res.json();
  return data.data;
}

// Download dataset items
export async function getDatasetItems(
  datasetId: string,
  limit?: number
): Promise<unknown[]> {
  const params = new URLSearchParams({ token: APIFY_TOKEN });
  if (limit) params.set("limit", String(limit));

  const res = await fetch(
    `${APIFY_BASE_URL}/datasets/${datasetId}/items?${params}`
  );

  if (!res.ok) {
    throw new Error(`Apify dataset download failed (${res.status})`);
  }

  return res.json();
}

// Check if a run is finished
export function isRunFinished(status: string): boolean {
  return ["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(status);
}

// Check if a run succeeded
export function isRunSucceeded(status: string): boolean {
  return status === "SUCCEEDED";
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/apify/client.ts
git commit -m "feat: add Apify REST API client — start runs, poll status, download datasets"
```

---

### Task 2: Post-Scraping Validator

**Files:**
- Create: `src/lib/apify/validator.ts`

Validates scraped data quality: deduplication, required field checks, quality scoring.

- [ ] **Step 1: Create validator**

Create `src/lib/apify/validator.ts`:

```typescript
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/apify/validator.ts
git commit -m "feat: add post-scraping validator — dedup, required fields, quality scoring"
```

---

### Task 3: Inngest Execute Research Function

**Files:**
- Create: `src/lib/inngest/functions/execute-research.ts`

This is the main pipeline. It's triggered by an Inngest event and runs each scraping job sequentially.

- [ ] **Step 1: Fetch latest Inngest docs via context7 MCP**

Look up:
- Inngest function definition pattern for v3+
- `inngest.createFunction()` API
- `step.run()`, `step.sleep()` patterns
- How to use steps for retriable operations
- Event schema definition

- [ ] **Step 2: Create the execute-research function**

Create `src/lib/inngest/functions/execute-research.ts`.

The function must:

1. **Trigger:** `"research/execute"` event with `{ projectId: string }`
2. **Step: update-status** — Set `research_projects.status = 'running'`
3. **For each scraping_job** (fetched from DB):
   a. **Step: start-{jobId}** — Call `startActorRun()`, save `apify_run_id` and `apify_dataset_id`, set `scraping_jobs.status = 'running'`
   b. **Step: poll-{jobId}** — Loop: sleep 30s, check `getRunStatus()`. Max 60 iterations (30 min). Update `scraping_jobs` progress on each poll. Break when finished.
   c. **Step: download-{jobId}** — If run succeeded: `getDatasetItems()`. If failed: set job status to 'failed', continue to next job.
   d. **Step: validate-{jobId}** — Run `validateScrapedData()`, get quality score.
   e. **Step: insert-{jobId}** — Batch insert validated items into `raw_data` (chunks of 100). Update `scraping_jobs` with actual_results, actual_cost, quality_score, status='completed'.
4. **Step: reconcile-costs** — Calculate total actual cost across all completed jobs. Apply markup (1.4x). Calculate difference from reserved amount. Insert adjustment transaction. INVARIANT: user always pays >= actual API cost.
5. **Step: check-ai-analysis** — Check if `ai_analysis_configs` exist for this project. If yes, this is where Phase 4 will dispatch the batch analysis event. For now, just mark project as 'completed'.
6. **Step: complete** — Set `research_projects.status = 'completed'`, set `total_actual_cost`.

Use Supabase server client (service role) for DB operations since this runs in a background job, not in a user request context. Create the client using `createClient` from `@supabase/supabase-js` directly with the service role key.

Error handling:
- If a job fails, continue with the next job
- If all jobs fail, still reconcile costs (charge for what was consumed)
- Each step is independently retriable by Inngest

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/inngest/functions/
git commit -m "feat: add execute-research Inngest function — full scraping pipeline"
```

---

### Task 4: Register Inngest Function + Supabase Admin Client

**Files:**
- Create: `src/lib/supabase/admin.ts` (service role client for background jobs)
- Modify: `src/app/api/inngest/route.ts` (register the function)

- [ ] **Step 1: Create admin Supabase client**

Create `src/lib/supabase/admin.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

This client bypasses RLS — used only in Inngest background jobs.

- [ ] **Step 2: Update Inngest route to register the function**

Read and modify `src/app/api/inngest/route.ts` to import and register `executeResearchFunction` in the `functions` array.

- [ ] **Step 3: Update execute-research.ts to use admin client**

If the execute-research function was using the server client (which needs cookies), update it to use `createAdminClient()` instead.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/admin.ts src/app/api/inngest/route.ts src/lib/inngest/functions/
git commit -m "feat: register execute-research in Inngest route + add admin Supabase client"
```

---

### Task 5: Connect executeResearch Tool to Inngest

**Files:**
- Modify: `src/lib/ai/chat-tools.ts`

Update the `executeResearch` tool to dispatch an Inngest event after creating jobs and reserving credits.

- [ ] **Step 1: Read current chat-tools.ts**

Read the file to understand the current executeResearch implementation.

- [ ] **Step 2: Add Inngest dispatch**

After the credit reservation, add:

```typescript
import { inngest } from "@/lib/inngest/client";

// ... inside executeResearch execute function, after credit reservation:

// Dispatch Inngest event to start scraping
await inngest.send({
  name: "research/execute",
  data: { projectId },
});

// Update project status to 'running'
await supabase
  .from("research_projects")
  .update({ status: "running" })
  .eq("id", projectId);
```

Update the return message to indicate execution has started (not just "configured").

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/chat-tools.ts
git commit -m "feat: connect executeResearch tool to Inngest — dispatches scraping pipeline"
```

---

### Task 6: Realtime Progress Hook

**Files:**
- Create: `src/hooks/use-realtime-progress.ts`

Subscribes to Supabase Realtime changes on `scraping_jobs` and `research_projects` for a specific project.

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-realtime-progress.ts`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ScrapingJobProgress {
  id: string;
  tool_id: string;
  tool_name: string;
  status: string;
  estimated_results: number | null;
  actual_results: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  quality_score: string | null;
  error_message: string | null;
}

interface ProjectProgress {
  status: string;
  total_actual_cost: number | null;
}

export function useRealtimeProgress(projectId: string) {
  const [jobs, setJobs] = useState<ScrapingJobProgress[]>([]);
  const [projectStatus, setProjectStatus] = useState<string>("draft");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch
    async function fetchInitial() {
      const { data: jobsData } = await supabase
        .from("scraping_jobs")
        .select(
          "id, tool_id, tool_name, status, estimated_results, actual_results, estimated_cost, actual_cost, quality_score, error_message"
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      const { data: projectData } = await supabase
        .from("research_projects")
        .select("status, total_actual_cost")
        .eq("id", projectId)
        .single();

      if (jobsData) setJobs(jobsData);
      if (projectData) setProjectStatus(projectData.status);
      setLoading(false);
    }

    fetchInitial();

    // Subscribe to scraping_jobs changes
    const jobsChannel = supabase
      .channel(`jobs-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "scraping_jobs",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const updated = payload.new as ScrapingJobProgress;
          setJobs((prev) =>
            prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j))
          );
        }
      )
      .subscribe();

    // Subscribe to project status changes
    const projectChannel = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "research_projects",
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const updated = payload.new as ProjectProgress;
          setProjectStatus(updated.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(projectChannel);
    };
  }, [projectId]);

  return { jobs, projectStatus, loading };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-realtime-progress.ts
git commit -m "feat: add useRealtimeProgress hook — Supabase Realtime for scraping jobs"
```

---

### Task 7: Progress Tracker Component

**Files:**
- Create: `src/components/project/progress-tracker.tsx`

UI component that shows scraping progress for each job with progress bars and status indicators.

- [ ] **Step 1: Create progress tracker**

Create `src/components/project/progress-tracker.tsx`:

A "use client" component that:
- Takes `projectId` as prop
- Uses `useRealtimeProgress(projectId)` hook
- Renders a card per scraping job showing:
  - Tool name
  - Status (pending/running/completed/failed) with colored left border
  - Progress bar (actual_results / estimated_results)
  - Cost (estimated while running, actual when done)
  - Error message if failed
  - Quality score badge when completed
- Shows overall project status at the top
- Shows "Estimated time remaining" based on running jobs
- Uses shadcn Card, Badge, Separator, Skeleton for loading state

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/project/
git commit -m "feat: add progress tracker component — realtime scraping progress UI"
```

---

### Task 8: Update Project Page for Running State

**Files:**
- Modify: `src/app/[locale]/(dashboard)/projects/[id]/page.tsx`

Update the project page to show the progress tracker when the project status is 'running' or 'completed'.

- [ ] **Step 1: Read current page**

Read the existing project page to understand the current implementation.

- [ ] **Step 2: Update page**

The page should:
- When status is 'draft' or 'configured': show ChatInterface (existing behavior)
- When status is 'running': show ProgressTracker + ChatInterface (chat still visible but input disabled)
- When status is 'completed' or 'failed': show ProgressTracker with final results

Import and conditionally render `ProgressTracker` based on `project.status`.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/(dashboard)/projects/"
git commit -m "feat: update project page — show progress tracker for running/completed states"
```

---

### Task 9: Final Build Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

Verify all routes compile without errors.

- [ ] **Step 2: Verify git log**

```bash
git log --oneline | head -20
```
