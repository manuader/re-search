# Phase 4: AI Analysis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI enrichment pipeline — submit raw_data to Claude Haiku 4.5 Batch API for sentiment analysis, classification, entity extraction, etc., then parse results back into raw_data.ai_fields.

**Architecture:** After scraping completes, the execute-research function dispatches a `research/check-batch` event. A new Inngest function builds prompts for each analysis config, submits them to the Anthropic Batch API, polls for completion, parses results, and updates raw_data.ai_fields. Uses Haiku 4.5 for cost efficiency.

**Tech Stack:** Anthropic Batch API (REST), Inngest (background polling), Supabase (data storage)

---

## File Structure

```
src/
├── lib/
│   ├── ai/
│   │   └── enrichment.ts                # NEW: Batch API client + prompt builder
│   └── inngest/
│       └── functions/
│           ├── execute-research.ts       # MODIFY: dispatch batch analysis after scraping
│           └── process-batch.ts          # NEW: Batch API polling + result parsing
├── app/
│   └── api/
│       └── inngest/route.ts             # MODIFY: register process-batch function
```

---

### Task 1: Anthropic Batch API Client + Prompt Builder

**Files:**
- Create: `src/lib/ai/enrichment.ts`

- [ ] **Step 1: Create enrichment module**

Create `src/lib/ai/enrichment.ts` with:

1. **`buildEnrichmentPrompt(analysisType, config, items)`** — Builds a prompt for batch processing. Takes the analysis type (sentiment, classification, entities, summary, pain_points, spam_detection, custom), the config JSONB, and an array of items. Returns a system prompt + user message for each item.

2. **`submitBatchAnalysis(analysisConfigId, projectId, items, analysisType, config)`** — Builds prompts for all items, submits to Anthropic Batch API (`POST /v1/messages/batches`), returns the batch ID.

3. **`getBatchStatus(batchId)`** — Checks batch status (`GET /v1/messages/batches/{batchId}`).

4. **`getBatchResults(batchId)`** — Downloads batch results when complete.

5. **`parseBatchResults(results, analysisType)`** — Parses Claude's responses into structured ai_fields.

Key details:
- Use `ANTHROPIC_API_KEY` env var
- Model: `claude-haiku-4-5-20251001` (Haiku 4.5)
- Batch API endpoint: `https://api.anthropic.com/v1/messages/batches`
- Each batch request is a JSONL of message requests with `custom_id` set to the raw_data row ID
- Prompt per analysis type:
  - **sentiment**: "Classify the sentiment as positive, neutral, or negative. Also give a score from 1-10. Respond with JSON: {\"sentiment\": \"...\", \"score\": N}"
  - **classification**: "Classify into one of these categories: {categories from config}. Respond with JSON: {\"category\": \"...\"}"
  - **entities**: "Extract named entities (people, places, brands). Respond with JSON: {\"entities\": [...]}"
  - **summary**: "Summarize in 1-2 sentences. Respond with JSON: {\"summary\": \"...\"}"
  - **pain_points**: "Identify problems or complaints mentioned. Respond with JSON: {\"pain_points\": [...]}"
  - **spam_detection**: "Is this genuine content or spam? Respond with JSON: {\"is_genuine\": true/false}"
  - **custom**: Use config.prompt as the instruction
- All prompts end with: "Respond ONLY with valid JSON, no other text."
- Batch items in groups of 10000 (Anthropic batch limit)

```typescript
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    messages: { role: string; content: string }[];
    system?: string;
  };
}

// ... implementations
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/enrichment.ts
git commit -m "feat: add AI enrichment module — Batch API client + prompt builder for 7 analysis types"
```

---

### Task 2: Process Batch Inngest Function

**Files:**
- Create: `src/lib/inngest/functions/process-batch.ts`

- [ ] **Step 1: Fetch latest Inngest docs via context7 MCP**

Look up Inngest step.run, step.sleep patterns.

- [ ] **Step 2: Create process-batch function**

Create `src/lib/inngest/functions/process-batch.ts`.

The function:
1. **Trigger:** `"research/process-batch"` event with `{ projectId: string, analysisConfigId: string, batchId: string }`
2. **Step "poll-batch":** Loop: check `getBatchStatus(batchId)`. If processing, sleep 60s, retry. Max 1440 iterations (24h). If ended, proceed.
3. **Step "download-results":** Call `getBatchResults(batchId)`. Parse the JSONL response.
4. **Step "update-data":** For each result, parse the AI response and update `raw_data.ai_fields` for the matching row (matched by `custom_id` = `raw_data.id`). Use the Supabase admin client.
5. **Step "finalize":** Update `ai_analysis_configs` status to 'completed', set actual_cost. Check if ALL analysis configs for this project are complete. If yes: insert ai_cost transaction, update project status to 'completed'.

Uses `createAdminClient()` from `src/lib/supabase/admin.ts`.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/inngest/functions/process-batch.ts
git commit -m "feat: add process-batch Inngest function — Batch API polling + result parsing"
```

---

### Task 3: Connect Execute Research to Batch Analysis

**Files:**
- Modify: `src/lib/inngest/functions/execute-research.ts`

- [ ] **Step 1: Read current execute-research.ts**

Understand the current "complete" step that sets status to 'completed'.

- [ ] **Step 2: Update the complete step**

After scraping is done and costs are reconciled, check if `ai_analysis_configs` exist for this project:

```typescript
// Step "check-ai-analysis"
const aiConfigs = await step.run("check-ai-analysis", async () => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_analysis_configs")
    .select("id, analysis_type, config, output_field_name")
    .eq("project_id", projectId);
  return data ?? [];
});

if (aiConfigs.length > 0) {
  // Fetch all raw_data for this project
  const rawData = await step.run("fetch-raw-data-for-ai", async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("raw_data")
      .select("id, content")
      .eq("project_id", projectId);
    return data ?? [];
  });

  // Submit batch for each analysis config
  for (const config of aiConfigs) {
    await step.run(`submit-batch-${config.id}`, async () => {
      const batchId = await submitBatchAnalysis(
        config.id,
        projectId,
        rawData.map((r) => ({ id: r.id, content: r.content })),
        config.analysis_type,
        config.config
      );

      const supabase = createAdminClient();
      await supabase
        .from("ai_analysis_configs")
        .update({ status: "processing", batch_id: batchId })
        .eq("id", config.id);

      // Dispatch polling function
      await inngest.send({
        name: "research/process-batch",
        data: { projectId, analysisConfigId: config.id, batchId },
      });
    });
  }
  // DON'T mark project as completed — process-batch will do that
} else {
  // No AI analysis — mark completed
  await step.run("complete", async () => {
    const supabase = createAdminClient();
    await supabase
      .from("research_projects")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", projectId);
  });
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/inngest/functions/execute-research.ts
git commit -m "feat: connect execute-research to batch AI analysis — submits to Batch API when configs exist"
```

---

### Task 4: Register Process Batch in Inngest Route

**Files:**
- Modify: `src/app/api/inngest/route.ts`

- [ ] **Step 1: Import and register**

Add `processBatch` (or whatever the exported function name is) to the functions array in `serve()`.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/inngest/route.ts
git commit -m "feat: register process-batch in Inngest route"
```

---

### Task 5: Final Build Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

- [ ] **Step 2: Verify git log**

```bash
git log --oneline | head -10
```
