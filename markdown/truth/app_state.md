# ResearchBot — Application State

> Last updated: 2026-04-23  
> This document is the single source of truth for the current state of the app. The original `PRD.md` and `idea.md` in this repo are outdated and should NOT be trusted for implementation details.

---

## What is ResearchBot?

ResearchBot is a web platform where users describe a research objective in a chat interface, and an AI assistant (Claude Haiku) helps them configure and execute data collection from public internet sources (via Apify scrapers), run AI-powered analysis on the results, and generate comprehensive HTML reports (via Claude Sonnet).

**Business model:** Pay-per-use. Each research execution and each report generation is a separate order with a fixed price calculated before payment. No subscriptions, no credit balance, no welcome credits.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.15 |
| Language | TypeScript (strict mode) | 5.x |
| React | React + React DOM | 19.1.0 |
| Auth & DB | Supabase (Postgres, Auth, RLS, Realtime) | supabase-js 2.103 |
| AI Chat | Vercel AI SDK + @ai-sdk/anthropic | ai 6.0, anthropic 3.0 |
| AI Models | Claude Haiku 4.5 (chat, enrichment), Claude Sonnet 4 (reports) | — |
| Scraping | Apify platform (13 actors) | REST API |
| Payments | Mercado Pago SDK | 2.12.0 |
| Background Jobs | Inngest (durable functions, crons) | 4.2.1 |
| UI Components | shadcn/ui (base-nova style) + @base-ui/react | shadcn 4.2 |
| i18n | next-intl | 4.9.1 |
| Styling | Tailwind CSS v4 | — |
| Icons | lucide-react | 1.8.0 |
| Export | ExcelJS | 4.4.0 |
| Testing | Vitest | 2.1.8 |
| Deployment | Vercel (auto-deploy from main) | — |
| DB Migrations | Supabase CLI (`supabase db push`) | 2.90.0 |

---

## Architecture Overview

```
User → Next.js App (Vercel)
         ├── Chat UI → /api/chat → Claude Haiku (streaming)
         ├── Chat Tools → configure scraping jobs + AI analysis
         ├── Checkout → /api/orders → Mercado Pago preference
         ├── MP Webhook → /api/webhooks/mercadopago → order status update
         │
         ├── Inngest event: research/execute
         │     ├── Start Apify actor runs
         │     ├── Poll until complete
         │     ├── Validate + store raw_data
         │     ├── Submit AI enrichment batch (Haiku)
         │     └── Cost cap check (abort if cost > 85% of price)
         │
         ├── Inngest event: research/process-batch
         │     └── Poll Anthropic Batch API → write ai_fields to raw_data
         │
         ├── Inngest event: report/generate
         │     └── Build summary → Claude Sonnet → validate HTML → save report
         │
         └── Admin Dashboard → /api/admin/* → materialized views
```

---

## Database Schema (8 migrations applied)

### Core Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `profiles` | User accounts (extends auth.users) | id, email, display_name, locale, is_admin, admin_granted_at, created_at |
| `research_projects` | Research projects | id, user_id, title, description, status, current_order_id, total_actual_cost, created_at |
| `chat_messages` | Conversation history | id, project_id, role, content, tool_invocations (JSONB), created_at |
| `scraping_jobs` | Individual scraping tasks | id, project_id, tool_id, tool_name, actor_input, estimated/actual_results, estimated/actual_cost, status, quality_score, validation_report |
| `raw_data` | Scraped data items | id, project_id, job_id, source, content (JSONB), ai_fields (JSONB) |
| `ai_analysis_configs` | AI enrichment configurations | id, project_id, analysis_type, config, estimated/actual_cost, status, batch_id |
| `reports` | Generated HTML reports | id, project_id, title, html_content, file_url, quality_flag |
| `actor_health` | Tool health monitoring | tool_id (PK), status, success_rate_7d/30d, avg_cost_per_result, last_error, consecutive_failures |
| `actor_health_log` | Health check history | id, tool_id, test_result, results_count, cost, duration_seconds |

### Pay-Per-Use Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `research_orders` | Order lifecycle | id, user_id, project_id, kind (research/report), status (9 states), pricing columns (estimated_internal_cost, safety_buffer, markup_multiplier, price_charged_usd), cost_breakdown (JSONB), config_snapshot, report_type, payment fields (provider, preference_id, payment_id, payment_url), execution fields (actual_cost, cap_triggered, timestamps), expires_at |
| `transactions` | Legacy transaction history | id, user_id, project_id, order_id, amount, type, description. Types: credit_purchase, scraping_reserve, scraping_cost, scraping_adjustment, ai_cost, refund, order_payment, order_refund |

### Observability Tables

| Table | Purpose |
|---|---|
| `analytics_events` | Funnel tracking (13 event types from project_created to execution_completed). RLS: service-role only. |
| `admin_audit_log` | Admin action audit trail. RLS: service-role only. |
| `admin_alerts` | Auto-detected operational alerts with level/code/resolution tracking. |

### Materialized Views (11 total)

**Funnel views (4):** `v_funnel_30d`, `v_abandonment_by_price`, `v_report_type_distribution`, `v_time_to_pay`

**Admin views (7):** `v_admin_daily_costs`, `v_admin_apify_cost_by_tool`, `v_admin_claude_cost`, `v_admin_user_spending`, `v_admin_stuck_orders`, `v_admin_margin_anomalies`, `v_admin_cap_trigger_rate`

All views have unique indexes for `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Refreshed every 15 min via Inngest cron.

### Key RLS Policies

- All user tables: `user_id = auth.uid()` for SELECT/INSERT
- `profiles` UPDATE: allows modifying own row BUT prevents changing `is_admin`, `admin_granted_at`, `admin_granted_by` (anti-self-elevation)
- `admin_audit_log`, `admin_alerts`, `analytics_events`: no client policies (service-role only)
- `actor_health`: public read (`USING (true)`)

### SQL Functions

- `get_credit_balance(p_user_id)` — legacy, returns SUM of transactions. Deprecated in code.
- `handle_new_user()` — trigger on auth.users INSERT, creates profile. No longer grants welcome credits.
- `is_admin(user_id)` — SECURITY DEFINER, returns boolean.
- `refresh_materialized_view(view_name)` — SECURITY DEFINER, allowlisted view names, executes `REFRESH CONCURRENTLY`.

---

## Pricing Engine

Located in `src/lib/pricing/`. Pure, deterministic, no side effects.

### Formula

```
internal_cost = scraping_cost (costPer1000.max × volume)
              + ai_analysis_cost (tokens × Haiku Batch rates)
              + report_cost (tokens × Sonnet rates, by level)
              + chatbot_cost ($0.05 flat fee, Strategy B)

safety_buffer = max($0.50, internal_cost × 0.15)

price_charged = ceil_to_cent((internal_cost + safety_buffer) × markup_multiplier)
```

### Markup Tiers

| Internal Cost | Markup |
|---|---|
| < $2 | 1.60x |
| $2–$6 | 1.50x |
| $6–$15 | 1.40x |
| > $15 | 1.35x |

### Invariants (enforced in `quotePricing`)

1. `price_charged >= internal_cost × 1.15` — always
2. `price_charged >= $1.50` — minimum floor
3. Rounding always UP to nearest cent

### Report Types and Costs

| Type | Input Tokens | Output Tokens | Model |
|---|---|---|---|
| none | 0 | 0 | — |
| executive | 6,000 | 2,000 | Sonnet |
| professional | 10,000 | 4,000 | Sonnet |
| technical | 15,000 | 8,000 | Sonnet |

### Cost Cap at Runtime

During Inngest execution, after each scraping job completes:
```
if actual_cost_accumulated >= price_charged × 0.85 → abort gracefully
```
Delivers partial results, marks order as `completed_partial`, logs `cap_triggered=true`.

---

## Order Lifecycle

### States and Transitions

```
pending_payment → paid → executing → completed
                                   → completed_partial (cap triggered)
                                   → failed → refund_pending → refunded
                → expired (30 min timeout or manual cancel)
```

### Two Order Kinds

- `research` — full pipeline: scraping + AI enrichment + optional report. One per project lifetime.
- `report` — report generation only on existing data. Multiple per project.

### Payment Flow

1. Chat tool `executeResearch` saves scraping_jobs + ai_analysis_configs, redirects to `/checkout`
2. Checkout page calls `POST /api/pricing` for server-side quote, displays breakdown
3. User clicks "Pay" → `POST /api/orders` creates order + Mercado Pago preference → redirects to MP checkout
4. MP processes payment → webhook `POST /api/webhooks/mercadopago`
5. Webhook verifies HMAC, fetches `GET /v1/payments/{id}`, transitions `pending_payment → paid`
6. Webhook dispatches Inngest `research/execute` event with `orderId`
7. Inngest function validates order is `paid`, transitions to `executing`, runs pipeline

### Webhook Idempotency

- Optimistic lock: `WHERE status = 'pending_payment'` on UPDATE
- If order already `paid` or beyond → return 200, no action
- MP payment_id stored with unique partial index

### Refund Policy

| Situation | Action |
|---|---|
| Not paid in 30 min | `expired`, no MP action |
| Paid, fails before Apify | 100% refund via MP API |
| Paid, fails after partial work | Partial refund: `price - actual_cost × 1.35` |
| Cap triggered | No refund (partial value delivered) |

---

## Scraping Pipeline (13 tools)

Tools are defined in `src/lib/apify/catalog.ts` with full schemas:

`google-maps`, `google-maps-reviews`, `twitter`, `reddit`, `google-search`, `web-crawler`, `instagram`, `tripadvisor`, `amazon-products`, `contact-extractor`, `linkedin-jobs`, `linkedin-profiles`, `tweets`

Each tool has:
- Apify actor ID, multilingual name/description
- Input schema with user-facing and internal fields
- Pricing model (per-result or per-page) with min/max costs
- Health check configuration
- Validation rules (required fields, unique key)

### Execution Flow (Inngest `execute-research`)

1. Load + validate order (must be `paid`)
2. Transition `paid → executing`
3. For each scraping job:
   - Start Apify actor run
   - Poll every 30s (max 60 iterations = 30 min)
   - Download dataset, validate, batch-insert into `raw_data`
   - Accumulate actual cost, check against cap
4. If AI analysis configured:
   - Submit batch to Anthropic Batch API (Haiku)
   - Dispatch `research/process-batch` event per config
5. Mark order `completed` with actual_cost_usd

### AI Enrichment

Analysis types: `sentiment`, `classification`, `pain_points`, `summary`

Runs via Anthropic Batch API (`claude-haiku-4-5-20251001`). Results are written back to `raw_data.ai_fields` JSONB column.

---

## Report Generation

Three quality levels: **Executive**, **Professional**, **Technical** (defined as `ReportLevel` type).

- Executive: C-suite focused, 3-4 tabs, ≤5 charts, plain language
- Professional: Analyst focused, 5-8 tabs, ≥7 charts, recommendations
- Technical: Data scientist focused, 7-9 tabs, ≥10 charts, full statistics

Generated by Claude Sonnet 4 (`claude-sonnet-4-20250514`) via direct Anthropic REST API call (not AI SDK). Output is self-contained HTML with inline CSS and JavaScript charts. Validated for structural integrity and numerical grounding before saving.

Pipeline: fetch project data → sample if too large → build dataset summary with statistics → construct locale-aware prompt → call Sonnet → validate HTML → save to `reports` table.

---

## Admin Dashboard

Protected by 4 layers of defense:
1. **Middleware**: checks `is_admin` on every request to `/api/admin/*` and `/{locale}/admin/*`
2. **API handler**: `assertAdmin()` re-verifies in each route handler
3. **Supabase RLS**: self-elevation prevention on `profiles` UPDATE
4. **Audit log**: sensitive actions (user/order detail, exports) logged to `admin_audit_log`

Non-admins see **404** (not 403) to hide route existence. Rate limited to 60 req/min per admin.

### Pages (9)

| Page | Content |
|---|---|
| Overview | 6 KPI cards (revenue, cost, margin, orders, users, pending) + stuck orders alert |
| Costs | 3 tabs: daily revenue/cost, Apify cost by tool, Claude cost by model |
| Users | Paginated table with search, click → user detail with KPIs + orders |
| Orders | Paginated table with status filters, click → full order detail with breakdown |
| Health | Actor health grid, margin anomalies, stuck orders, cap trigger rate |
| Funnel | CSS bar chart visualization, time-to-pay, abandonment by price, report type distribution |
| Alerts | Active/resolved alerts with acknowledge button |
| Audit | Paginated admin audit log |
| Export | CSV download for orders and users |

### Automated Alerts (Inngest cron every 5 min)

| Code | Level | Condition |
|---|---|---|
| `margin_anomaly` | critical | Order where actual_cost > price_charged |
| `cap_trigger_spike` | warning | Cap trigger rate > 5% with ≥20 orders/day |
| `actor_down` | warning | Any tool with `status = 'down'` |
| `stuck_orders` | warning | ≥3 orders stuck > 60 min |
| `refund_pending_backlog` | warning | ≥5 refund_pending orders > 2 hours |

Auto-resolved when conditions clear.

---

## Internationalization

5 locales: **en**, **es**, **pt**, **fr**, **de**

8 i18n namespaces: `common`, `auth`, `dashboard`, `project`, `chat`, `billing`, `checkout`, `admin`

All UI strings go through `useTranslations()` (client) or `getTranslations()` (server). Currency formatting via `Intl.NumberFormat`, date formatting via `Intl.DateTimeFormat`. The chatbot system prompt is locale-aware.

---

## Analytics

13 funnel events tracked server-side and client-side:

`project_created` → `chat_first_message` → `tools_suggested` → `config_completed` → `checkout_viewed` → `report_type_changed` → `checkout_abandoned` → `payment_started` → `payment_completed` → `payment_failed` → `payment_expired` → `execution_completed` → `report_regenerated`

Client events sent via `POST /api/analytics` (rate limited 60/min/session). Server events inserted directly via `trackEvent()` with service-role client. Analytics never throws — fire-and-forget with try/catch.

A/B testing infrastructure ready (`getExperimentVariant()` deterministic hash) but no active experiments.

---

## Background Jobs (8 Inngest functions)

| Function | Trigger | Purpose |
|---|---|---|
| `execute-research` | `research/execute` event | Full scraping pipeline with cost cap |
| `process-batch` | `research/process-batch` event | Polls Anthropic Batch API for AI enrichment |
| `generate-report` | `report/generate` event | Builds and saves HTML report via Sonnet |
| `refund-order` | `order/refund` event | Calls MP refund API with retry (max 5) |
| `health-check` | every 12h | Tests all 13 scraping tools |
| `expire-orders` | every 5 min | Marks expired `pending_payment` orders |
| `refresh-admin-views` | every 15 min | Refreshes all 11 materialized views |
| `detect-admin-alerts` | every 5 min | Checks 5 alert conditions, inserts/resolves |

---

## Environment Variables (8)

| Variable | Public? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role (bypasses RLS) |
| `APIFY_API_TOKEN` | No | Apify platform access |
| `ANTHROPIC_API_KEY` | No | Claude API access |
| `MERCADOPAGO_ACCESS_TOKEN` | No | MP payment processing |
| `MERCADOPAGO_WEBHOOK_SECRET` | No | HMAC verification for MP webhooks |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL for MP redirect URLs |

---

## Tests (99 passing)

| Suite | Tests | Coverage |
|---|---|---|
| Pricing (`quotePricing`) | 16 | All markup tiers, minimum price, rounding, 200-input fuzz, 4 spec examples |
| State machine | 22 | All valid/invalid transitions, error messages |
| Report stats | 33 | mean, median, percentile, edge cases |
| Report sampling | 12 | Sample size determination, stratified sampling |
| Report summary | 16 | Dataset summary building, field detection |

No E2E, integration, or component tests yet.

---

## File Structure Summary

```
src/
  app/
    [locale]/
      (auth)/          — login, signup pages
      (dashboard)/     — user-facing pages (billing, checkout, projects)
      (admin)/admin/   — admin dashboard (separate route group, own layout)
    api/
      admin/           — 15 admin API routes (GET only + 1 POST for alert acknowledge)
      chat/            — AI chat streaming
      orders/          — order CRUD
      pricing/         — price quote
      report/          — report generation trigger + status polling
      webhooks/        — MP payment webhook
      inngest/         — Inngest serve endpoint
      analytics/       — client event tracking
      export/          — project data export
      payments/        — legacy credit purchase preference
      projects/        — project CRUD
  components/
    admin/             — admin-specific (sidebar, kpi-card, status-badge)
    billing/           — billing client (order history)
    chat/              — chat interface, input, messages, tools, keywords, costs
    dashboard/         — user sidebar
    project/           — data table, export, progress tracker, report viewer
    ui/                — 15 shadcn primitives
  hooks/               — useRealtimeProgress
  lib/
    admin/             — guard, audit, types, response helpers
    ai/                — chat tools, enrichment, system prompt
    analytics/         — event tracking, experiments
    apify/             — catalog (13 tools), client, validator
    export/            — excel generation, data flattening
    inngest/           — client + 8 functions
    orders/            — state machine
    payments/          — credits (deprecated), mercadopago SDK
    pricing/           — constants, quote, types
    reports/           — summary builder, prompt, sampling, stats, validators
    supabase/          — client, server, admin, middleware
  messages/            — en.json, es.json, pt.json, fr.json, de.json
  types/               — shared type definitions
  i18n/                — routing config, request config
  middleware.ts        — auth guards, admin guards, rate limiting, i18n

supabase/
  migrations/          — 8 SQL migration files
  config.toml          — local dev config

__tests__/
  lib/
    pricing/           — quotePricing tests
    orders/            — state machine tests
    reports/           — stats, sampling, summary tests
```

---

## Known Limitations / Technical Debt

1. **No generated Supabase types** — all queries are untyped (no `supabase gen types` output). Queries use raw `SupabaseClient` without generics.
2. **No E2E or integration tests** — only unit tests exist. No Playwright, no API route tests.
3. **Legacy credit system remnants** — `transactions` table still exists with old types. `credits.ts` is deprecated but not deleted (returns 0 with console warning). `/api/payments/create-preference` still exists.
4. **`LEVEL_LABELS` in report-client.tsx** — unused constant (left over from pre-i18n refactor).
5. **No email notifications** — no transactional emails for payment confirmation, research completion, or refunds.
6. **MP currency** — orders use `currency_id: "USD"` but MP accounts in Argentina may convert to ARS automatically.
7. **No rate limiting on user-facing API routes** — only admin routes and analytics have rate limiting.
8. **Admin dashboard has no charts** — all visualization is tables only (CSS bars in funnel page). Recharts was considered but deferred.
