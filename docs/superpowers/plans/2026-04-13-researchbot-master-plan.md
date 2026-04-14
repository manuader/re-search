# ResearchBot — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ResearchBot end-to-end — a conversational research platform with AI-powered scraping, analysis, and reporting.

**Architecture:** Next.js 15 monolith with Supabase (auth, DB, realtime, storage), Inngest (background jobs), GPT-4o-mini (chatbot), Claude Sonnet 4.6 (reports), Haiku 4.5 Batch (analysis), Apify (scraping), Mercado Pago (payments).

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Vercel AI SDK, Inngest, Apify, next-intl, exceljs

---

## Phase Overview

Each phase produces working, testable software. Phases are sequential — each builds on the previous.

| Phase | Name | What it delivers | Depends on |
|---|---|---|---|
| 1 | Foundation | Project setup, auth, DB, i18n, base layouts | — |
| 2 | Tool Catalog + Chatbot | Static catalog, chat UI, GPT-4o-mini tool calling | Phase 1 |
| 3 | Scraping Engine | Inngest pipeline, Apify integration, realtime progress | Phase 2 |
| 4 | AI Analysis | Haiku 4.5 Batch enrichment, ai_fields on raw_data | Phase 3 |
| 5 | Data View + Export | Data table with filters, Excel/CSV export | Phase 3 |
| 6 | Reports | Sonnet 4.6 HTML report generation, report viewer | Phase 4, 5 |
| 7 | Payments + Credits | Mercado Pago, credit system, billing page | Phase 1 |
| 8 | Health Monitoring | Inngest cron, health checks, degraded/down states | Phase 3 |

**Each phase gets its own detailed plan file.** This master plan provides the overview and Phase 1 in full detail.

---

## Phase 1: Foundation

### File Structure

```
re-search/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   └── inngest/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── ui/          (shadcn components)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   └── inngest/
│   │       └── client.ts
│   ├── i18n/
│   │   ├── request.ts
│   │   └── routing.ts
│   ├── messages/
│   │   ├── en.json
│   │   └── es.json
│   └── middleware.ts
├── supabase/
│   └── migrations/
│       └── 00001_initial_schema.sql
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create Next.js 15 project with TypeScript**

```bash
cd /Users/manuader/Desktop/projects/re-search
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

When prompted about overwriting existing files, accept (only idea.md and PRD.md exist, they won't be overwritten).

- [ ] **Step 2: Verify dev server starts**

```bash
npm run dev
```

Open http://localhost:3000 — should see default Next.js page.
Kill the dev server after verification.

- [ ] **Step 3: Commit**

```bash
git init
git add -A
git commit -m "chore: initialize Next.js 15 project with TypeScript and Tailwind"
```

---

### Task 2: Install Core Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install all Phase 1 dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr next-intl inngest
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D supabase @types/node
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init -d
```

Accept defaults (New York style, Zinc base color, CSS variables).

- [ ] **Step 4: Add initial shadcn components**

```bash
npx shadcn@latest add button card input label separator avatar dropdown-menu sheet tabs
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: install core deps — supabase, next-intl, inngest, shadcn/ui"
```

---

### Task 3: Environment Configuration

**Files:**
- Create: `.env.local.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create env example file**

Create `.env.local.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (chatbot — GPT-4o-mini)
OPENAI_API_KEY=sk-your-openai-key

# Anthropic (reports — Sonnet 4.6, analysis — Haiku 4.5)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Apify
APIFY_API_TOKEN=apify_api_your-token

# Inngest
INNGEST_SIGNING_KEY=signkey-your-key
INNGEST_EVENT_KEY=your-event-key

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=your-mp-access-token
MERCADOPAGO_WEBHOOK_SECRET=your-mp-webhook-secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 2: Ensure .env.local is in .gitignore**

Verify `.gitignore` contains `.env*.local`. Next.js scaffold should have added this already. If not, add it.

- [ ] **Step 3: Create actual .env.local from example**

```bash
cp .env.local.example .env.local
```

Fill in real Supabase credentials (from Supabase dashboard → Settings → API).

- [ ] **Step 4: Commit**

```bash
git add .env.local.example .gitignore
git commit -m "chore: add environment configuration template"
```

---

### Task 4: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware helper**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, supabaseResponse };
}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase client setup — browser, server, middleware"
```

---

### Task 5: Internationalization (next-intl)

**Files:**
- Create: `src/i18n/request.ts`
- Create: `src/i18n/routing.ts`
- Create: `src/messages/en.json`
- Create: `src/messages/es.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Create routing config**

Create `src/i18n/routing.ts`:

```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
});
```

- [ ] **Step 2: Create request config**

Create `src/i18n/request.ts`:

```typescript
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: Create English messages**

Create `src/messages/en.json`:

```json
{
  "common": {
    "appName": "ResearchBot",
    "loading": "Loading...",
    "error": "Something went wrong",
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "back": "Back"
  },
  "auth": {
    "login": "Log in",
    "signup": "Sign up",
    "logout": "Log out",
    "email": "Email",
    "password": "Password",
    "continueWithGoogle": "Continue with Google",
    "orContinueWith": "Or continue with",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?"
  },
  "dashboard": {
    "title": "My Research",
    "newResearch": "New Research",
    "recentProjects": "Recent Projects",
    "emptyState": "Start a new research",
    "emptyStateDescription": "Describe what you want to investigate and I'll guide you through the process"
  },
  "project": {
    "chat": "Chat",
    "data": "Data",
    "report": "Report",
    "status": {
      "draft": "Draft",
      "configured": "Configured",
      "running": "Running",
      "completed": "Completed",
      "failed": "Failed"
    }
  },
  "billing": {
    "credits": "Credits",
    "balance": "Available Credits",
    "buyCredits": "Buy Credits",
    "transactionHistory": "Transaction History",
    "estimateNote": "~{count} research projects"
  }
}
```

- [ ] **Step 4: Create Spanish messages**

Create `src/messages/es.json`:

```json
{
  "common": {
    "appName": "ResearchBot",
    "loading": "Cargando...",
    "error": "Algo salio mal",
    "save": "Guardar",
    "cancel": "Cancelar",
    "confirm": "Confirmar",
    "back": "Volver"
  },
  "auth": {
    "login": "Iniciar sesion",
    "signup": "Registrarse",
    "logout": "Cerrar sesion",
    "email": "Email",
    "password": "Contrasena",
    "continueWithGoogle": "Continuar con Google",
    "orContinueWith": "O continuar con",
    "noAccount": "No tenes cuenta?",
    "hasAccount": "Ya tenes cuenta?"
  },
  "dashboard": {
    "title": "Mis Investigaciones",
    "newResearch": "Nueva Investigacion",
    "recentProjects": "Proyectos Recientes",
    "emptyState": "Empeza una nueva investigacion",
    "emptyStateDescription": "Describi que queres investigar y te guio en el proceso"
  },
  "project": {
    "chat": "Chat",
    "data": "Datos",
    "report": "Reporte",
    "status": {
      "draft": "Borrador",
      "configured": "Configurado",
      "running": "Ejecutando",
      "completed": "Completado",
      "failed": "Fallido"
    }
  },
  "billing": {
    "credits": "Creditos",
    "balance": "Creditos Disponibles",
    "buyCredits": "Comprar Creditos",
    "transactionHistory": "Historial de Transacciones",
    "estimateNote": "~{count} investigaciones"
  }
}
```

- [ ] **Step 5: Update next.config.ts**

Replace the contents of `next.config.ts`:

```typescript
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 6: Verify build passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/i18n/ src/messages/ next.config.ts
git commit -m "feat: add i18n setup — next-intl with en/es locales"
```

---

### Task 6: Middleware (Auth + i18n)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create combined middleware**

Create `src/middleware.ts`:

```typescript
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

// Routes that don't require authentication
const publicRoutes = ["/login", "/signup"];

function isPublicRoute(pathname: string): boolean {
  // Strip locale prefix to check route
  const pathWithoutLocale = pathname.replace(/^\/(en|es)/, "") || "/";
  return publicRoutes.some((route) => pathWithoutLocale.startsWith(route));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  // Skip auth check for API routes (they handle auth themselves)
  if (isApiRoute(request.pathname)) {
    return NextResponse.next();
  }

  // Refresh Supabase session
  const { user, supabaseResponse } = await updateSession(request);

  // Apply i18n routing
  const intlResponse = intlMiddleware(request);

  // Copy Supabase cookies to intl response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  // Check auth for protected routes
  if (!user && !isPublicRoute(request.nextUrl.pathname)) {
    const locale = request.nextUrl.pathname.split("/")[1] || "en";
    const loginUrl = new URL(`/${locale}/login`, request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);

    // Copy Supabase cookies to redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });

    return redirectResponse;
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Match all pathnames except static files and api
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add middleware — combined auth guard + i18n routing"
```

---

### Task 7: Database Schema Migration

**Files:**
- Create: `supabase/migrations/00001_initial_schema.sql`

- [ ] **Step 1: Initialize Supabase locally (if not done)**

```bash
npx supabase init
```

If already initialized, skip.

- [ ] **Step 2: Create migration file**

Create `supabase/migrations/00001_initial_schema.sql`:

```sql
-- ============================================================
-- ResearchBot Initial Schema
-- ============================================================

-- Profiles (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  locale TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Research projects (1 project = 1 chat = 1 research)
CREATE TABLE research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'configured', 'running', 'completed', 'failed')),
  total_estimated_cost DECIMAL(10,2),
  total_actual_cost DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Chat messages (linked to project)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_invocations JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Scraping jobs (1 per tool used in a project)
CREATE TABLE scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  tool_name TEXT,
  actor_input JSONB NOT NULL,
  search_terms TEXT[],
  estimated_results INT,
  estimated_cost DECIMAL(10,2),
  actual_results INT,
  actual_cost DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  apify_run_id TEXT,
  apify_dataset_id TEXT,
  error_message TEXT,
  quality_score TEXT CHECK (quality_score IN ('high', 'medium', 'low')),
  validation_report JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extracted data
CREATE TABLE raw_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES scraping_jobs(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  content JSONB NOT NULL,
  ai_fields JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI analysis configurations
CREATE TABLE ai_analysis_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL
    CHECK (analysis_type IN ('sentiment', 'classification', 'entities', 'summary', 'spam_detection', 'pain_points', 'custom')),
  config JSONB NOT NULL,
  output_field_name TEXT NOT NULL,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tool health (dynamic data, catalog is in code)
CREATE TABLE actor_health (
  tool_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
  success_rate_7d DECIMAL(5,2),
  success_rate_30d DECIMAL(5,2),
  avg_cost_per_result DECIMAL(10,4),
  last_test_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INT DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Health check log
CREATE TABLE actor_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT NOT NULL,
  test_result TEXT NOT NULL CHECK (test_result IN ('success', 'partial', 'failure')),
  results_count INT,
  cost DECIMAL(10,4),
  duration_seconds INT,
  error_message TEXT,
  tested_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions (source of truth for credits)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES research_projects(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('credit_purchase', 'scraping_reserve', 'scraping_cost', 'ai_cost', 'refund')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Generated reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  title TEXT,
  html_content TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_research_projects_user ON research_projects(user_id);
CREATE INDEX idx_chat_messages_project ON chat_messages(project_id, created_at);
CREATE INDEX idx_scraping_jobs_project ON scraping_jobs(project_id);
CREATE INDEX idx_raw_data_project_job ON raw_data(project_id, job_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_project ON transactions(project_id);
CREATE INDEX idx_actor_health_log_tool ON actor_health_log(tool_id, tested_at);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Research projects: users can CRUD their own projects
CREATE POLICY "Users can view own projects"
  ON research_projects FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create projects"
  ON research_projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects"
  ON research_projects FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own projects"
  ON research_projects FOR DELETE
  USING (user_id = auth.uid());

-- Chat messages: users can access messages of their own projects
CREATE POLICY "Users can view own chat messages"
  ON chat_messages FOR SELECT
  USING (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- Scraping jobs: users can view jobs of their own projects
CREATE POLICY "Users can view own scraping jobs"
  ON scraping_jobs FOR SELECT
  USING (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- Raw data: users can view data of their own projects
CREATE POLICY "Users can view own raw data"
  ON raw_data FOR SELECT
  USING (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- AI analysis configs: users can view configs of their own projects
CREATE POLICY "Users can view own ai configs"
  ON ai_analysis_configs FOR SELECT
  USING (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- Transactions: users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (user_id = auth.uid());

-- Reports: users can view reports of their own projects
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- ============================================================
-- Functions
-- ============================================================

-- Get user credit balance
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM transactions
  WHERE user_id = p_user_id;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1))
  );

  -- Welcome credits ($3)
  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (NEW.id, 3.00, 'credit_purchase', 'Welcome credits');

  RETURN NEW;
END;
$$;

-- Trigger: create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Realtime
-- ============================================================

-- Enable realtime for scraping_jobs (progress tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE scraping_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE research_projects;
```

- [ ] **Step 3: Apply migration to remote Supabase**

```bash
npx supabase db push
```

Or if using Supabase dashboard, paste the SQL into the SQL Editor and run it.

- [ ] **Step 4: Generate TypeScript types**

```bash
npx supabase gen types typescript --project-id your-project-id > src/lib/supabase/types.ts
```

Replace `your-project-id` with your actual Supabase project ID.

- [ ] **Step 5: Commit**

```bash
git add supabase/ src/lib/supabase/types.ts
git commit -m "feat: add database schema — all tables, RLS, functions, realtime"
```

---

### Task 8: Auth Pages (Login + Signup)

**Files:**
- Create: `src/app/[locale]/(auth)/login/page.tsx`
- Create: `src/app/[locale]/(auth)/signup/page.tsx`
- Create: `src/app/[locale]/(auth)/auth/callback/route.ts`
- Create: `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Create locale root layout**

Create `src/app/[locale]/layout.tsx`:

```typescript
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 2: Create login page**

Create `src/app/[locale]/(auth)/login/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{t("login")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
          >
            {t("continueWithGoogle")}
          </Button>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {t("orContinueWith")}
            </span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {t("login")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/signup" className="text-primary underline">
              {t("signup")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create signup page**

Create `src/app/[locale]/(auth)/signup/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function SignupPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleGoogleSignup() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{t("signup")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignup}
          >
            {t("continueWithGoogle")}
          </Button>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {t("orContinueWith")}
            </span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleEmailSignup} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {t("signup")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link href="/login" className="text-primary underline">
              {t("login")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create auth callback route**

Create `src/app/[locale]/(auth)/auth/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/en`);
    }
  }

  return NextResponse.redirect(`${origin}/en/login`);
}
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/
git commit -m "feat: add auth pages — login, signup, OAuth callback"
```

---

### Task 9: Dashboard Layout + Home Page

**Files:**
- Create: `src/app/[locale]/(dashboard)/layout.tsx`
- Create: `src/app/[locale]/(dashboard)/page.tsx`
- Create: `src/components/dashboard/sidebar.tsx`

- [ ] **Step 1: Create sidebar component**

Create `src/components/dashboard/sidebar.tsx`:

```typescript
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  creditBalance: number;
}

export function Sidebar({ creditBalance }: SidebarProps) {
  const t = useTranslations();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-muted/30 p-4">
      <div className="mb-6 px-2 text-lg font-bold">
        {t("common.appName")}
      </div>

      <Button asChild className="mb-6">
        <Link href="/projects/new">+ {t("dashboard.newResearch")}</Link>
      </Button>

      <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("dashboard.recentProjects")}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Project list will be populated in Phase 2 */}
      </div>

      <Separator className="my-2" />

      <div className="space-y-1 px-2 text-sm">
        <div className="text-muted-foreground">
          {t("billing.credits")}: ${creditBalance.toFixed(2)}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create dashboard layout**

Create `src/app/[locale]/(dashboard)/layout.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get credit balance
  let creditBalance = 0;
  if (user) {
    const { data } = await supabase.rpc("get_credit_balance", {
      p_user_id: user.id,
    });
    creditBalance = data ?? 0;
  }

  return (
    <div className="flex h-screen">
      <Sidebar creditBalance={creditBalance} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create dashboard home page**

Create `src/app/[locale]/(dashboard)/page.tsx`:

```typescript
import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-5xl">🔬</div>
        <h2 className="mb-2 text-xl font-medium">{t("emptyState")}</h2>
        <p className="text-muted-foreground">{t("emptyStateDescription")}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/ src/components/dashboard/
git commit -m "feat: add dashboard layout with sidebar and empty state home page"
```

---

### Task 10: Inngest Client Setup

**Files:**
- Create: `src/lib/inngest/client.ts`
- Create: `src/app/api/inngest/route.ts`

- [ ] **Step 1: Create Inngest client**

Create `src/lib/inngest/client.ts`:

```typescript
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "researchbot",
});
```

- [ ] **Step 2: Create Inngest API route**

Create `src/app/api/inngest/route.ts`:

```typescript
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";

// Functions will be added in Phase 3
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
});
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/inngest/ src/app/api/inngest/
git commit -m "feat: add Inngest client and API route skeleton"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Full build check**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Start dev server and verify**

```bash
npm run dev
```

Verify:
- http://localhost:3000 → redirects to /en (or /en/login if not authenticated)
- /en/login → shows login page with Google button and email form
- /en/signup → shows signup page
- i18n works: /es/login shows Spanish text

- [ ] **Step 3: Final commit (if any unstaged changes)**

```bash
git status
```

If clean, Phase 1 is complete.

---

## Phases 2-8: Overview

These phases will get their own detailed plan files when Phase 1 is complete.

### Phase 2: Tool Catalog + Chatbot
- Static catalog definition in `lib/apify/catalog.ts` (13 tools)
- Chat API route with Vercel AI SDK + GPT-4o-mini
- 6 tool definitions with Zod schemas
- Chat UI (message bubbles, tool status indicators, cost card)
- Create project flow (new project → chat page)

### Phase 3: Scraping Engine
- Apify API client wrapper
- Inngest function: `research/execute` (actor run + polling + download + validate)
- Post-scraping validation (dedup, required fields, integrity)
- Realtime progress tracking (Supabase Realtime + `use-realtime-progress` hook)
- Progress tracker UI component

### Phase 4: AI Analysis
- Anthropic Batch API integration
- Inngest function: `research/check-batch` (polling + result parsing)
- Enrichment prompt builder per analysis type
- AI analysis config UI in chat flow

### Phase 5: Data View + Export
- Data table component with dynamic columns, filters, search, pagination
- JSONB flattening logic (content + ai_fields → flat columns)
- Excel export via exceljs (formatted, autofit)
- CSV export
- Upload to Supabase Storage + signed URL generation

### Phase 6: Reports
- Data aggregation logic (summary JSON builder)
- Report prompt builder (locale-aware)
- API route: single prompt to Sonnet 4.6 → HTML
- Report viewer (sandboxed iframe)
- Recharts CDN integration in generated HTML

### Phase 7: Payments + Credits
- Mercado Pago SDK integration (Checkout Pro)
- Webhook handler with HMAC verification
- Credit balance component (reactive)
- Buy credits flow
- Transaction history UI
- Reserve/reconcile logic in execute pipeline

### Phase 8: Health Monitoring
- Inngest cron function: `cron/health-check`
- Mini-test execution per tool
- Health status update rules (3 failures → down, etc.)
- Health badge display in chat tool suggestions
