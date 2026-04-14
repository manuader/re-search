# Phase 8: Health Monitoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build automated health monitoring for the tool catalog — Inngest cron job runs mini-tests every 12 hours, updates health status, and surfaces degraded/down states in the chatbot's tool suggestions.

**Architecture:** Inngest cron function iterates through the static catalog, runs a mini Apify test per tool, records results in `actor_health_log`, updates `actor_health` with status rules (3 failures → down, <80% → degraded, >90% → healthy). The `searchTools` chat tool already reads from `actor_health` — no chat changes needed.

**Tech Stack:** Inngest (cron), Apify REST API, Supabase

---

## File Structure

```
src/
├── lib/
│   └── inngest/
│       └── functions/
│           └── health-check.ts         # NEW: cron health check function
├── app/
│   └── api/
│       └── inngest/route.ts            # MODIFY: register health-check function
```

---

### Task 1: Health Check Inngest Function

**Files:**
- Create: `src/lib/inngest/functions/health-check.ts`

- [ ] **Step 1: Fetch latest Inngest docs via context7 MCP**

Look up:
- How to create a cron-triggered Inngest function
- The cron trigger syntax

Also read:
- `src/lib/inngest/functions/execute-research.ts` to match the createFunction pattern
- `src/lib/apify/client.ts` to see available functions
- `src/lib/apify/catalog.ts` to see the toolCatalog export and healthCheck config

- [ ] **Step 2: Create health-check function**

Create `src/lib/inngest/functions/health-check.ts`.

The function:

1. **Trigger:** Inngest cron `"0 */12 * * *"` (every 12 hours)
2. **For each tool in `toolCatalog`** (sequential to control Apify costs):

   **Step "test-{tool.id}":**
   - Start an Apify actor run with `tool.healthCheck.input`
   - Poll until done (max `tool.healthCheck.maxDurationSeconds` / 30 = max polls)
   - Record result:
     - If succeeded and results >= `tool.healthCheck.expectedMinResults`: test_result = 'success'
     - If succeeded but results < expected: test_result = 'partial'
     - If failed/timed-out: test_result = 'failure'
   - Get actual cost from run.usage?.USD
   - Insert into `actor_health_log`: tool_id, test_result, results_count, cost, duration_seconds
   - Update `actor_health`:
     - On success: `consecutive_failures = 0`, update `last_success_at`
     - On failure: increment `consecutive_failures`
     - If `consecutive_failures >= 3`: `status = 'down'`, `is_available = false`
     - Recalculate `success_rate_7d` from recent logs
     - If `success_rate_7d < 80`: `status = 'degraded'`
     - If `success_rate_7d >= 90`: `status = 'healthy'`
     - Update `last_test_at`, `updated_at`

   Use `createAdminClient()` for all DB operations.

   Wrap each tool test in a try/catch — if one tool's test fails, continue with the next.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/inngest/functions/health-check.ts
git commit -m "feat: add health-check Inngest cron — runs every 12h, tests all catalog tools"
```

---

### Task 2: Register Health Check in Inngest Route

**Files:**
- Modify: `src/app/api/inngest/route.ts`

- [ ] **Step 1: Read current route, import and register health check function**

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/inngest/route.ts
git commit -m "feat: register health-check cron in Inngest route"
```

---

### Task 3: Seed Initial Health Records

**Files:**
- Create: `supabase/migrations/00002_seed_actor_health.sql`

The `actor_health` table needs initial rows for each tool so the chatbot has data to read. Without these, `searchTools` would get empty results from the health join.

- [ ] **Step 1: Create seed migration**

Create `supabase/migrations/00002_seed_actor_health.sql`:

```sql
-- Seed actor_health with initial 'unknown' status for all catalog tools
INSERT INTO actor_health (tool_id, status, is_available, consecutive_failures, updated_at)
VALUES
  ('google-maps', 'unknown', true, 0, now()),
  ('google-maps-reviews', 'unknown', true, 0, now()),
  ('twitter', 'unknown', true, 0, now()),
  ('reddit', 'unknown', true, 0, now()),
  ('google-search', 'unknown', true, 0, now()),
  ('web-crawler', 'unknown', true, 0, now()),
  ('instagram', 'unknown', true, 0, now()),
  ('tripadvisor', 'unknown', true, 0, now()),
  ('amazon-products', 'unknown', true, 0, now()),
  ('contact-extractor', 'unknown', true, 0, now()),
  ('linkedin-jobs', 'unknown', true, 0, now()),
  ('linkedin-profiles', 'unknown', true, 0, now()),
  ('tweets', 'unknown', true, 0, now())
ON CONFLICT (tool_id) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add seed migration for actor_health initial records"
```

---

### Task 4: Final Build Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

- [ ] **Step 2: Verify complete git log**

```bash
git log --oneline
```

- [ ] **Step 3: Count total files**

```bash
find src -type f -name "*.ts" -o -name "*.tsx" -o -name "*.json" | wc -l
```
