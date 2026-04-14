# Phase 2: Tool Catalog + Chatbot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the static tool catalog (13 scrapers), chatbot with GPT-4o-mini + 6 tools via Vercel AI SDK, and the chat UI with semi-transparent tool indicators.

**Architecture:** Static TypeScript catalog in code + GPT-4o-mini via `@ai-sdk/openai` for conversational tool calling + Vercel AI SDK v5 (`streamText`, `useChat`, `message.parts`) + Supabase for project/message persistence.

**Tech Stack:** ai, @ai-sdk/openai, @ai-sdk/react, zod, Supabase, shadcn/ui, next-intl

---

## File Structure

```
src/
├── types/
│   └── index.ts                        # Shared types (ToolCatalogEntry, Locale, etc.)
├── lib/
│   ├── apify/
│   │   └── catalog.ts                  # Static catalog: 13 tool definitions
│   └── ai/
│       ├── chat-tools.ts               # 6 tool definitions (Zod schemas + execute)
│       └── system-prompt.ts            # System prompt builder per locale
├── app/
│   ├── api/
│   │   ├── chat/route.ts               # POST: streamText + GPT-4o-mini + tools
│   │   └── projects/route.ts           # POST: create new project
│   └── [locale]/(dashboard)/
│       └── projects/[id]/
│           └── page.tsx                # Project chat page
├── components/
│   └── chat/
│       ├── chat-interface.tsx          # Main chat container (useChat hook)
│       ├── message-list.tsx            # Scrollable message list
│       ├── message-bubble.tsx          # Single message (text + tool parts)
│       ├── tool-status.tsx             # Semi-transparent tool indicators
│       ├── cost-card.tsx               # Research summary + cost panel
│       └── chat-input.tsx              # Input bar with send button
└── hooks/
    └── use-credit-balance.ts           # Reactive credit balance hook
```

---

### Task 1: Install AI SDK Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Vercel AI SDK + OpenAI provider**

```bash
cd /Users/manuader/Desktop/projects/re-search
npm install ai @ai-sdk/openai @ai-sdk/react zod
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install Vercel AI SDK, OpenAI provider, and Zod"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create shared types file**

Create `src/types/index.ts`:

```typescript
export type Locale = "en" | "es";

export type ToolCategory =
  | "maps"
  | "social"
  | "search"
  | "ecommerce"
  | "travel"
  | "reviews"
  | "professional";

export type ToolFieldType = "string" | "number" | "boolean" | "string[]";

export interface ToolField {
  key: string;
  type: ToolFieldType;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
  required: boolean;
  default?: string | number | boolean | string[];
  userFacing: boolean;
  min?: number;
  max?: number;
}

export interface ToolPricing {
  model: "per-result" | "per-run" | "per-page";
  costPer1000: { min: number; max: number };
  freeResultsIncluded?: number;
}

export interface ToolHealthCheck {
  input: Record<string, unknown>;
  expectedMinResults: number;
  maxDurationSeconds: number;
}

export interface ToolValidation {
  requiredFields: string[];
  uniqueKey?: string;
}

export interface ToolCatalogEntry {
  id: string;
  actorId: string;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  category: ToolCategory;
  useCases: string[];
  inputSchema: {
    fields: ToolField[];
    defaults: Record<string, unknown>;
  };
  outputFields: string[];
  pricing: ToolPricing;
  healthCheck: ToolHealthCheck;
  validation: ToolValidation;
  pairsWellWith: string[];
  maintainer: string;
}

export interface CostEstimate {
  min: number;
  max: number;
  expected: number;
  breakdown: string;
}

export interface ToolSearchResult {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  healthStatus: string;
  costPer1000: { min: number; max: number };
  pairsWellWith: string[];
}

export interface ToolConfigResult {
  toolId: string;
  toolName: string;
  fields: {
    key: string;
    label: string;
    description: string;
    type: ToolFieldType;
    required: boolean;
    default?: string | number | boolean | string[];
    min?: number;
    max?: number;
  }[];
  defaults: Record<string, unknown>;
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/types/
git commit -m "feat: add shared types — ToolCatalogEntry, CostEstimate, etc."
```

---

### Task 3: Static Tool Catalog (13 tools)

**Files:**
- Create: `src/lib/apify/catalog.ts`

This is the heart of the system. Each of the 13 tools needs complete metadata: name (en/es), description, use cases, input schema fields, pricing, health check input, validation rules.

- [ ] **Step 1: Create catalog file with all 13 tools**

Create `src/lib/apify/catalog.ts`. The file exports `toolCatalog: ToolCatalogEntry[]` with all 13 entries. Each entry must have:
- Localized names and descriptions (en + es)
- useCases array with natural language descriptions for fuzzy matching
- inputSchema with all configurable fields (mark userFacing: true for fields the bot should ask about, false for technical fields like proxy config)
- pricing with cost-per-1000 ranges
- healthCheck with a minimal test input
- validation with required output fields and dedup key

The 13 tools are:

1. **google-maps** (compass/crawler-google-places) — maps
2. **google-maps-reviews** (compass/google-maps-reviews) — maps
3. **twitter** (apidojo/tweet-scraper) — social
4. **reddit** (trudax/reddit-scraper) — social
5. **google-search** (apify/google-search-scraper) — search
6. **web-crawler** (apify/website-content-crawler) — search
7. **instagram** (apify/instagram-scraper) — social
8. **tripadvisor** (maxcopell/tripadvisor) — travel
9. **amazon-products** (junglee/amazon-crawler) — ecommerce
10. **contact-extractor** (vdrmota/contact-info-scraper) — maps
11. **linkedin-jobs** (bebity/linkedin-jobs-scraper) — professional
12. **linkedin-profiles** (dev_fusion/Linkedin-Profile-Scraper) — professional
13. **tweets** (apidojo/tweet-scraper) — social

Also export helper functions:

```typescript
import type { ToolCatalogEntry, Locale, ToolSearchResult, ToolConfigResult, CostEstimate } from "@/types";

export const toolCatalog: ToolCatalogEntry[] = [
  // ... 13 entries
];

export function findToolById(id: string): ToolCatalogEntry | undefined {
  return toolCatalog.find((t) => t.id === id);
}

export function searchCatalog(query: string, locale: Locale): ToolSearchResult[] {
  const q = query.toLowerCase();
  return toolCatalog
    .filter((t) =>
      t.name[locale].toLowerCase().includes(q) ||
      t.description[locale].toLowerCase().includes(q) ||
      t.useCases.some((uc) => uc.toLowerCase().includes(q)) ||
      t.category.includes(q)
    )
    .map((t) => ({
      id: t.id,
      name: t.name[locale],
      description: t.description[locale],
      category: t.category,
      healthStatus: "unknown",
      costPer1000: t.pricing.costPer1000,
      pairsWellWith: t.pairsWellWith,
    }));
}

export function getToolConfig(toolId: string, locale: Locale): ToolConfigResult | null {
  const tool = findToolById(toolId);
  if (!tool) return null;

  return {
    toolId: tool.id,
    toolName: tool.name[locale],
    fields: tool.inputSchema.fields
      .filter((f) => f.userFacing)
      .map((f) => ({
        key: f.key,
        label: f.label[locale],
        description: f.description[locale],
        type: f.type,
        required: f.required,
        default: f.default,
        min: f.min,
        max: f.max,
      })),
    defaults: tool.inputSchema.defaults,
  };
}

export function estimateCost(toolId: string, resultCount: number): CostEstimate | null {
  const tool = findToolById(toolId);
  if (!tool) return null;

  const { min, max } = tool.pricing.costPer1000;
  const factor = resultCount / 1000;
  const markup = 1.4;

  return {
    min: Math.round(min * factor * markup * 100) / 100,
    max: Math.round(max * factor * markup * 100) / 100,
    expected: Math.round(((min + max) / 2) * factor * markup * 100) / 100,
    breakdown: `${resultCount} results × $${min}-${max}/1000 × 1.4 markup`,
  };
}
```

The subagent implementing this task MUST define all 13 tools with complete, realistic metadata. Each tool needs:
- At minimum 3 useCases strings for searchCatalog matching
- At minimum 2 userFacing input fields (e.g., search query and max results)
- Realistic pricing ranges based on the PRD
- A health check input that would return a small number of results

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/apify/
git commit -m "feat: add static tool catalog — 13 tools with full metadata"
```

---

### Task 4: System Prompt Builder

**Files:**
- Create: `src/lib/ai/system-prompt.ts`

- [ ] **Step 1: Create system prompt builder**

Create `src/lib/ai/system-prompt.ts`:

```typescript
import type { Locale } from "@/types";
import { toolCatalog } from "@/lib/apify/catalog";

const prompts: Record<Locale, string> = {
  en: `You are the ResearchBot assistant, a platform for researching public data on the internet.

Your job:
1. Understand what the user wants to research
2. Suggest the best tools from your catalog using the searchTools function
3. Configure parameters conversationally using getToolConfig
4. Show estimated costs transparently using estimateCost
5. Suggest AI analyses that add value using suggestAIAnalysis
6. When the user confirms, execute with executeResearch

Rules:
- Never mention "Apify", "Actor", or technical scraping terms
- Call tools by their public name (e.g., "Business Finder", not "compass/crawler-google-places")
- Always show the estimated cost before executing
- If a tool has status "degraded", warn the user about potential issues
- If a tool is "down", suggest alternatives from the catalog
- For technical fields (proxy, headers, cookies), configure silently with defaults
- Suggest keywords in the user's language including colloquial variations and common misspellings
- Maximum 1-2 questions per message to avoid overwhelming the user
- When suggesting tools, briefly explain what each one does and why it fits
- After the user selects tools and configures them, show a clear cost summary before asking for confirmation

Available tool categories: ${[...new Set(toolCatalog.map((t) => t.category))].join(", ")}
Total tools in catalog: ${toolCatalog.length}`,

  es: `Sos el asistente de ResearchBot, una plataforma para investigar datos publicos en internet.

Tu trabajo:
1. Entender que quiere investigar el usuario
2. Sugerir las mejores herramientas del catalogo usando la funcion searchTools
3. Configurar parametros de forma conversacional usando getToolConfig
4. Mostrar costos estimados de forma transparente usando estimateCost
5. Sugerir analisis IA que agreguen valor usando suggestAIAnalysis
6. Cuando el usuario confirme, ejecutar con executeResearch

Reglas:
- Nunca mencionar "Apify", "Actor", ni terminos tecnicos de scraping
- Llamar a las herramientas por su nombre publico (ej: "Buscador de Negocios")
- Siempre mostrar el costo estimado antes de ejecutar
- Si una herramienta tiene estado "degraded", avisar al usuario
- Si una herramienta esta "down", sugerir alternativas del catalogo
- Para campos tecnicos (proxy, headers, cookies), configurar silenciosamente con defaults
- Sugerir keywords en el idioma del usuario incluyendo variaciones coloquiales y errores comunes
- Maximo 1-2 preguntas por mensaje para no abrumar
- Al sugerir herramientas, explicar brevemente que hace cada una y por que sirve
- Despues de elegir herramientas y configurarlas, mostrar resumen de costos antes de confirmar

Categorias de herramientas disponibles: ${[...new Set(toolCatalog.map((t) => t.category))].join(", ")}
Total de herramientas en el catalogo: ${toolCatalog.length}`,
};

export function buildSystemPrompt(locale: Locale): string {
  return prompts[locale];
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/
git commit -m "feat: add system prompt builder — per-locale chatbot instructions"
```

---

### Task 5: Chat Tools (6 Zod-validated tools)

**Files:**
- Create: `src/lib/ai/chat-tools.ts`

These are the 6 tools that GPT-4o-mini can call during a conversation. They use the Vercel AI SDK v5 `tool()` helper with `inputSchema` (Zod schemas).

- [ ] **Step 1: Create chat tools**

Create `src/lib/ai/chat-tools.ts`:

```typescript
import { tool } from "ai";
import { z } from "zod";
import type { Locale } from "@/types";
import { searchCatalog, getToolConfig, estimateCost, findToolById } from "@/lib/apify/catalog";
import { createClient } from "@/lib/supabase/server";

export function createChatTools(locale: Locale, projectId: string, userId: string) {
  return {
    searchTools: tool({
      description:
        "Search the curated tool catalog to find relevant scraping tools for the user's research need. Call this when the user describes what they want to investigate.",
      inputSchema: z.object({
        query: z.string().describe("Natural language description of what the user wants to research"),
      }),
      execute: async ({ query }) => {
        const results = searchCatalog(query, locale);

        // Enrich with health status from DB
        const supabase = await createClient();
        const { data: healthData } = await supabase
          .from("actor_health")
          .select("tool_id, status, is_available")
          .in("tool_id", results.map((r) => r.id));

        const healthMap = new Map(
          (healthData ?? []).map((h) => [h.tool_id, h])
        );

        return results.map((r) => ({
          ...r,
          healthStatus: healthMap.get(r.id)?.status ?? "unknown",
          isAvailable: healthMap.get(r.id)?.is_available ?? true,
        }));
      },
    }),

    getToolConfig: tool({
      description:
        "Get the configuration schema for a specific tool. Returns the fields the user needs to fill in. Call this after the user selects a tool.",
      inputSchema: z.object({
        toolId: z.string().describe("The tool ID from the catalog (e.g., 'google-maps')"),
      }),
      execute: async ({ toolId }) => {
        return getToolConfig(toolId, locale);
      },
    }),

    estimateCost: tool({
      description:
        "Calculate the estimated cost for using a tool with a given number of results. Always call this before showing costs to the user.",
      inputSchema: z.object({
        toolId: z.string().describe("The tool ID"),
        resultCount: z.number().describe("Expected number of results"),
      }),
      execute: async ({ toolId, resultCount }) => {
        return estimateCost(toolId, resultCount);
      },
    }),

    suggestKeywords: tool({
      description:
        "Generate optimized search keywords for a tool based on the research objective. Includes semantic variations, slang, hashtags, and common misspellings in the user's language.",
      inputSchema: z.object({
        objective: z.string().describe("What the user wants to research"),
        toolId: z.string().describe("The tool to generate keywords for"),
      }),
      execute: async ({ objective, toolId }) => {
        const t = findToolById(toolId);
        return {
          toolId,
          toolName: t?.name[locale] ?? toolId,
          note: "Keywords will be generated by the assistant based on the objective and tool context. The assistant should suggest relevant keywords including colloquial variations.",
          objective,
        };
      },
    }),

    suggestAIAnalysis: tool({
      description:
        "Suggest AI analysis templates based on the research objective and data type. Suggests sentiment analysis, classification, entity extraction, etc.",
      inputSchema: z.object({
        objective: z.string().describe("The research objective"),
        dataType: z
          .string()
          .describe("Type of data being collected (e.g., 'reviews', 'social posts', 'business listings')"),
      }),
      execute: async ({ objective, dataType }) => {
        const suggestions = [];

        if (["reviews", "social posts", "comments", "tweets"].some((t) => dataType.toLowerCase().includes(t))) {
          suggestions.push({
            type: "sentiment",
            name: locale === "es" ? "Analisis de Sentimiento" : "Sentiment Analysis",
            description: locale === "es"
              ? "Clasifica cada registro como positivo, neutro o negativo"
              : "Classifies each record as positive, neutral, or negative",
            outputField: "ai_sentiment",
            estimatedCostPer1000: 0.05,
          });
          suggestions.push({
            type: "pain_points",
            name: locale === "es" ? "Deteccion de Problemas" : "Pain Point Detection",
            description: locale === "es"
              ? "Identifica problemas y quejas mencionados"
              : "Identifies problems and complaints mentioned",
            outputField: "ai_pain_points",
            estimatedCostPer1000: 0.05,
          });
        }

        suggestions.push({
          type: "classification",
          name: locale === "es" ? "Clasificacion por Categorias" : "Category Classification",
          description: locale === "es"
            ? "Clasifica registros en categorias definidas por vos"
            : "Classifies records into categories you define",
          outputField: "ai_category",
          estimatedCostPer1000: 0.05,
        });

        suggestions.push({
          type: "summary",
          name: locale === "es" ? "Resumen" : "Summary",
          description: locale === "es"
            ? "Genera un resumen de 1-2 oraciones por registro"
            : "Generates a 1-2 sentence summary per record",
          outputField: "ai_summary",
          estimatedCostPer1000: 0.05,
        });

        return { suggestions, objective, dataType };
      },
    }),

    executeResearch: tool({
      description:
        "Execute the configured research. Call this ONLY after the user has explicitly confirmed they want to proceed and you have shown them the total estimated cost.",
      inputSchema: z.object({
        title: z.string().describe("Research project title"),
        tools: z.array(
          z.object({
            toolId: z.string(),
            config: z.record(z.unknown()),
            estimatedResults: z.number(),
            estimatedCost: z.number(),
            searchTerms: z.array(z.string()),
          })
        ),
        aiAnalysis: z
          .array(
            z.object({
              type: z.string(),
              outputField: z.string(),
              config: z.record(z.unknown()).optional(),
            })
          )
          .optional(),
      }),
      execute: async ({ title, tools, aiAnalysis }) => {
        const supabase = await createClient();

        // Calculate total estimated cost
        const totalEstimated = tools.reduce((sum, t) => sum + t.estimatedCost, 0);
        const aiCost = (aiAnalysis?.length ?? 0) * 0.05;
        const grandTotal = totalEstimated + aiCost;

        // Check credit balance
        const { data: balance } = await supabase.rpc("get_credit_balance", {
          p_user_id: userId,
        });

        if ((balance ?? 0) < grandTotal) {
          return {
            success: false,
            error: locale === "es"
              ? `Creditos insuficientes. Necesitas $${grandTotal.toFixed(2)} pero tenes $${(balance ?? 0).toFixed(2)}. Compra creditos en la seccion de facturacion.`
              : `Insufficient credits. You need $${grandTotal.toFixed(2)} but have $${(balance ?? 0).toFixed(2)}. Buy credits in the billing section.`,
          };
        }

        // Update project
        await supabase
          .from("research_projects")
          .update({
            title,
            status: "configured",
            total_estimated_cost: grandTotal,
          })
          .eq("id", projectId);

        // Create scraping jobs
        for (const t of tools) {
          const catalogEntry = findToolById(t.toolId);
          await supabase.from("scraping_jobs").insert({
            project_id: projectId,
            tool_id: t.toolId,
            tool_name: catalogEntry?.name[locale] ?? t.toolId,
            actor_input: { ...catalogEntry?.inputSchema.defaults, ...t.config },
            search_terms: t.searchTerms,
            estimated_results: t.estimatedResults,
            estimated_cost: t.estimatedCost,
          });
        }

        // Create AI analysis configs
        if (aiAnalysis) {
          for (const a of aiAnalysis) {
            await supabase.from("ai_analysis_configs").insert({
              project_id: projectId,
              analysis_type: a.type,
              config: a.config ?? {},
              output_field_name: a.outputField,
              estimated_cost: 0.05,
            });
          }
        }

        // Reserve credits
        await supabase.from("transactions").insert({
          user_id: userId,
          project_id: projectId,
          amount: -grandTotal,
          type: "scraping_reserve",
          description: `Reserve for: ${title}`,
        });

        // NOTE: Inngest event dispatch will be added in Phase 3
        // For now, just mark as configured

        return {
          success: true,
          projectId,
          message: locale === "es"
            ? `Investigacion configurada. Costo estimado: $${grandTotal.toFixed(2)}. La ejecucion se habilitara en la siguiente fase.`
            : `Research configured. Estimated cost: $${grandTotal.toFixed(2)}. Execution will be enabled in the next phase.`,
          totalEstimatedCost: grandTotal,
        };
      },
    }),
  };
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/chat-tools.ts
git commit -m "feat: add 6 chat tools — searchTools, getToolConfig, estimateCost, suggestKeywords, suggestAIAnalysis, executeResearch"
```

---

### Task 6: Chat API Route

**Files:**
- Create: `src/app/api/chat/route.ts`

Uses Vercel AI SDK v5 with GPT-4o-mini and the 6 tools.

- [ ] **Step 1: Create chat API route**

Create `src/app/api/chat/route.ts`:

```typescript
import { streamText, isStepCount, convertToModelMessages, UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createChatTools } from "@/lib/ai/chat-tools";
import type { Locale } from "@/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, projectId, locale = "en" }: {
    messages: UIMessage[];
    projectId: string;
    locale?: Locale;
  } = await req.json();

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify project belongs to user
  const { data: project } = await supabase
    .from("research_projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (!project || project.user_id !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  const tools = createChatTools(locale as Locale, projectId, user.id);

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: buildSystemPrompt(locale as Locale),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(5),
  });

  return result.toUIMessageStreamResponse();
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/
git commit -m "feat: add chat API route — GPT-4o-mini streaming with 6 tools"
```

---

### Task 7: Create Project API Route

**Files:**
- Create: `src/app/api/projects/route.ts`

- [ ] **Step 1: Create projects API route**

Create `src/app/api/projects/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = body.title || "New Research";

  const { data: project, error } = await supabase
    .from("research_projects")
    .insert({
      user_id: user.id,
      title,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: project.id });
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/
git commit -m "feat: add create project API route"
```

---

### Task 8: Chat UI Components

**Files:**
- Create: `src/components/chat/chat-input.tsx`
- Create: `src/components/chat/message-bubble.tsx`
- Create: `src/components/chat/tool-status.tsx`
- Create: `src/components/chat/message-list.tsx`
- Create: `src/components/chat/cost-card.tsx`
- Create: `src/components/chat/chat-interface.tsx`

All components use "use client" and shadcn/ui. The chat interface uses the `useChat` hook from `@ai-sdk/react` with `DefaultChatTransport`.

Key patterns for Vercel AI SDK v5:
- `useChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) })`
- `sendMessage({ text: input })` instead of `handleSubmit`
- `status` ('ready' | 'streaming' | 'submitted') instead of `isLoading`
- `message.parts` array with `part.type === 'text'` or `part.type === 'tool-{toolName}'`
- Tool parts have states: `'input-streaming'`, `'input-available'`, `'output-available'`, `'output-error'`

The subagent implementing this MUST:
1. Use the Vercel AI SDK v5 `message.parts` API (NOT the deprecated `toolInvocations`)
2. Use `DefaultChatTransport` from 'ai' package
3. Use `sendMessage({ text })` pattern with manual useState for input
4. Render tool status indicators based on part state (streaming = loading, available = checkmark)
5. Pass `projectId` and `locale` as body params to the chat API via transport configuration
6. Fetch latest Vercel AI SDK docs via context7 MCP before implementing

The `chat-interface.tsx` component should:
- Accept `projectId` and `locale` as props
- Use `useChat` with custom transport that sends projectId and locale
- Render `message-list` + `chat-input`
- Show `cost-card` in a side panel (or below on mobile)

The `tool-status.tsx` component renders semi-transparent indicators:
- During tool execution: "🔍 Searching tools..." / "⚙️ Loading configuration..." / "💰 Calculating costs..."
- After completion: "✓ Searched tools catalog" (compact, muted)

The `cost-card.tsx` tracks selected tools and their estimated costs from tool results.

The `message-bubble.tsx` renders a single message with its text parts and tool parts.

- [ ] **Step 1: Create all 6 chat components**

The subagent creates all 6 files listed above.

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/
git commit -m "feat: add chat UI components — interface, messages, tool status, cost card"
```

---

### Task 9: Project Chat Page

**Files:**
- Create: `src/app/[locale]/(dashboard)/projects/[id]/page.tsx`

Server component that loads the project and renders the chat interface.

- [ ] **Step 1: Create project chat page**

Create `src/app/[locale]/(dashboard)/projects/[id]/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { ChatInterface } from "@/components/chat/chat-interface";
import type { Locale } from "@/types";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: project } = await supabase
    .from("research_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project || project.user_id !== user.id) {
    redirect(`/${locale}`);
  }

  // Load existing messages
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="flex h-full">
      <ChatInterface
        projectId={id}
        locale={locale as Locale}
        initialMessages={messages ?? []}
        projectStatus={project.status}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/(dashboard)/projects/"
git commit -m "feat: add project chat page — loads project and renders chat interface"
```

---

### Task 10: Update Sidebar with Project List + New Research Button

**Files:**
- Modify: `src/components/dashboard/sidebar.tsx`
- Modify: `src/app/[locale]/(dashboard)/layout.tsx`

Update the sidebar to show actual projects from the database and make the "New Research" button create a project and navigate to its chat page.

- [ ] **Step 1: Update sidebar to accept and display projects**

The sidebar needs:
- Accept a `projects` prop with id, title, status, created_at
- Render each project as a clickable link to `/projects/{id}`
- Show status indicator (emoji) for each project
- Make "New Research" button call POST /api/projects then navigate to the new project

The dashboard layout needs:
- Fetch the user's projects from DB
- Pass them to the sidebar

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/ "src/app/[locale]/(dashboard)/layout.tsx"
git commit -m "feat: update sidebar — real project list + create new research flow"
```

---

### Task 11: Add shadcn Components (if needed)

**Files:**
- Modify: `package.json` (if new shadcn components needed)

Check if the chat UI needs additional shadcn components not yet installed. The current set includes: button, card, input, label, separator, avatar, dropdown-menu, sheet, tabs.

Likely additions: `scroll-area` (for chat message scroll), `badge` (for tool status), `skeleton` (for loading states).

- [ ] **Step 1: Install any missing shadcn components**

```bash
npx shadcn@latest add scroll-area badge skeleton tooltip
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: add additional shadcn components — scroll-area, badge, skeleton, tooltip"
```

---

### Task 12: Credit Balance Hook

**Files:**
- Create: `src/hooks/use-credit-balance.ts`

A client-side hook that fetches and reactively updates the user's credit balance.

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-credit-balance.ts`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCreditBalance() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchBalance() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.rpc("get_credit_balance", {
        p_user_id: user.id,
      });
      setBalance(data ?? 0);
      setLoading(false);
    }

    fetchBalance();
  }, []);

  return { balance, loading };
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/
git commit -m "feat: add useCreditBalance hook"
```

---

### Task 13: Final Build Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

Verify all routes compile:
- `/api/chat` (POST)
- `/api/projects` (POST)
- `/api/inngest`
- `/[locale]/login`
- `/[locale]/signup`
- `/[locale]` (dashboard)
- `/[locale]/projects/[id]` (chat)

- [ ] **Step 2: Verify git status is clean**

```bash
git status
git log --oneline | head -15
```
