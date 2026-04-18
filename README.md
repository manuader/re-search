# ResearchBot

A conversational research platform where users describe what they want to investigate in natural language, and an AI chatbot guides them to extract data from the internet, analyze it with AI, and generate interactive reports.

**Live:** [re-search-self.vercel.app](https://re-search-self.vercel.app)

## What It Does

1. User describes a research goal (e.g., "I want to analyze public opinion about X")
2. AI chatbot suggests the best scraping tools from a curated catalog of 13 sources
3. User selects tools, configures keywords via interactive checklist, sees real-time cost estimates
4. Platform scrapes data via Apify, validates quality, and stores results
5. AI enriches data with sentiment analysis, classification, entity extraction (7 analysis types)
6. User exports to Excel/CSV or generates an interactive HTML report with charts

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| UI | Tailwind CSS, shadcn/ui |
| Database | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| Chatbot | Vercel AI SDK v6, Claude Haiku 4.5 |
| Reports | Claude Sonnet 4.6 (generates interactive HTML with Recharts) |
| AI Analysis | Claude Haiku 4.5 (Anthropic Batch API) |
| Scraping | Apify (13 curated actors) |
| Background Jobs | Inngest (scraping pipeline, batch analysis, health monitoring) |
| Payments | Mercado Pago (Checkout Pro) |
| i18n | next-intl (English, Spanish) |
| Deploy | Vercel |

## Features

- **Conversational research setup** -- AI chatbot with 6 tool-calling functions guides the entire process
- **13 scraping tools** -- Google Maps, Google Maps Reviews, Twitter/X, Reddit, Google Search, Web Crawler, Instagram, TripAdvisor, Amazon Products, Contact Extractor, LinkedIn Jobs, LinkedIn Profiles, Tweets
- **Interactive keyword checklist** -- Bot suggests keywords, user toggles them on/off, cost updates in real-time
- **Real-time progress tracking** -- Supabase Realtime shows scraping progress per tool with progress bars
- **AI data enrichment** -- Sentiment analysis, classification, entity extraction, summaries, pain points, spam detection, custom prompts (via Anthropic Batch API, 50% cheaper)
- **Interactive HTML reports** -- Single prompt to Claude Sonnet generates a complete dashboard with Recharts charts, rendered in a sandboxed iframe
- **Excel/CSV export** -- Formatted xlsx with autofit columns or CSV, uploaded to Supabase Storage with signed URLs
- **Credit system** -- Pay-per-use with 40% markup, balance derived from transactions (no mutable balance field), $3 welcome credits
- **Mercado Pago integration** -- Checkout Pro with webhook verification (HMAC)
- **Health monitoring** -- Inngest cron every 12h tests all tools, auto-disables after 3 consecutive failures
- **i18n** -- English default, Spanish, prefix-based routing (/en, /es)
- **Auth** -- Google OAuth + email/password via Supabase Auth

## Architecture

```
Vercel (Next.js 15)
  |-- App Router (React Server Components)
  |-- API Routes (/api/chat, /api/projects, /api/export, /api/report, /api/inngest, /api/webhooks)
  |-- Middleware (auth guard + i18n routing)
  |
  |-- Supabase (PostgreSQL + Auth + Realtime + Storage)
  |     |-- 10 tables with RLS
  |     |-- Auto-create profile + welcome credits on signup (trigger)
  |     |-- Realtime subscriptions for scraping progress
  |
  |-- Anthropic API
  |     |-- Haiku 4.5: chatbot (via Vercel AI SDK) + batch analysis
  |     |-- Sonnet 4.6: report generation
  |
  |-- Inngest (background jobs)
  |     |-- execute-research: scrape -> validate -> insert -> reconcile costs
  |     |-- process-batch: poll Batch API -> parse results -> update ai_fields
  |     |-- health-check: cron every 12h, test all 13 tools
  |
  |-- Apify API (13 scraping actors)
  |-- Mercado Pago (Checkout Pro + webhooks)
```

## Project Structure

```
src/
  app/
    [locale]/(auth)/          -- login, signup, OAuth callback
    [locale]/(dashboard)/     -- dashboard, projects, billing
    api/                      -- chat, projects, export, report, inngest, webhooks
  components/
    chat/                     -- chat interface, messages, keyword checklist, cost card
    project/                  -- progress tracker, data table, export button, report viewer
    billing/                  -- credit balance, buy credits, transaction history
    dashboard/                -- sidebar
    ui/                       -- shadcn components
  lib/
    ai/                       -- chat tools, system prompt, enrichment, report generator
    apify/                    -- catalog (13 tools), REST client, validator
    inngest/                  -- client + 3 functions
    supabase/                 -- browser client, server client, admin client, middleware
    payments/                 -- Mercado Pago client, credit helpers
    export/                   -- JSONB flattening, Excel/CSV generation
  hooks/                      -- realtime progress, credit balance
  i18n/                       -- next-intl routing + request config
  messages/                   -- en.json, es.json
  types/                      -- shared TypeScript types
```

## Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local
# Fill in: Supabase, Anthropic, Apify, Inngest, Mercado Pago credentials

# Apply database migrations
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push

# Run locally
npm run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `ANTHROPIC_API_KEY` | Anthropic API key (all LLM usage) |
| `APIFY_API_TOKEN` | Apify API token |
| `INNGEST_SIGNING_KEY` | Inngest signing key |
| `INNGEST_EVENT_KEY` | Inngest event key |
| `MERCADOPAGO_ACCESS_TOKEN` | Mercado Pago access token |
| `MERCADOPAGO_WEBHOOK_SECRET` | Mercado Pago webhook secret |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g., https://re-search-self.vercel.app) |

## Cost Model

- **Chatbot conversation:** ~$0.005-0.02 (Haiku 4.5)
- **Scraping:** ~$1-10 per research (varies by tool and volume)
- **AI analysis:** ~$0.05 per 1000 records (Haiku 4.5 Batch, 50% off)
- **Report generation:** ~$0.03-0.08 (Sonnet 4.6)
- **User pricing:** All API costs x 1.4 markup
- **Invariant:** User always pays >= actual API cost (discounts only reduce margin)

## License

Private.
