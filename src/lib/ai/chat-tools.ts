import { tool } from "ai";
import { z } from "zod";
import type { Locale } from "@/types";
import {
  searchCatalog,
  getToolConfig as getToolConfigFromCatalog,
  estimateCost as estimateCostFromCatalog,
  findToolById,
} from "@/lib/apify/catalog";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

const errorMessages: Record<Locale, Record<string, string>> = {
  en: {
    toolNotFound: "Tool not found in catalog.",
    insufficientCredits:
      "Insufficient credits. Please purchase more credits to continue.",
    noToolsProvided: "No tools were provided for execution.",
    projectUpdateFailed: "Failed to update the project. Please try again.",
    generic: "An error occurred. Please try again.",
  },
  es: {
    toolNotFound: "Herramienta no encontrada en el catálogo.",
    insufficientCredits:
      "Créditos insuficientes. Por favor comprá más créditos para continuar.",
    noToolsProvided: "No se proporcionaron herramientas para ejecutar.",
    projectUpdateFailed:
      "Error al actualizar el proyecto. Por favor intentá de nuevo.",
    generic: "Ocurrió un error. Por favor intentá de nuevo.",
  },
};

export function createChatTools(
  locale: Locale,
  projectId: string,
  userId: string
) {
  const t = errorMessages[locale];

  return {
    searchTools: tool({
      description: "Search the curated tool catalog for relevant scraping tools",
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => {
        const results = searchCatalog(query, locale);

        if (results.length === 0) {
          return { results: [] };
        }

        // Enrich with health status from DB
        const supabase = await createClient();
        const toolIds = results.map((r) => r.id);

        const { data: healthData } = await supabase
          .from("actor_health")
          .select("tool_id, status, last_checked")
          .in("tool_id", toolIds);

        const healthMap = new Map(
          (healthData ?? []).map((h) => [h.tool_id, h.status as string])
        );

        const enrichedResults = results.map((r) => ({
          ...r,
          healthStatus: healthMap.get(r.id) ?? "unknown",
        }));

        return { results: enrichedResults };
      },
    }),

    getToolConfig: tool({
      description: "Get configuration schema for a specific tool",
      inputSchema: z.object({
        toolId: z.string(),
      }),
      execute: async ({ toolId }) => {
        const config = getToolConfigFromCatalog(toolId, locale);
        if (!config) {
          return { error: t.toolNotFound };
        }
        return config;
      },
    }),

    estimateCost: tool({
      description:
        "Calculate estimated cost for a tool with given result count",
      inputSchema: z.object({
        toolId: z.string(),
        resultCount: z.number(),
      }),
      execute: async ({ toolId, resultCount }) => {
        const estimate = estimateCostFromCatalog(toolId, resultCount);
        if (!estimate) {
          return { error: t.toolNotFound };
        }
        return estimate;
      },
    }),

    suggestKeywords: tool({
      description: "Generate optimized search keywords for a tool",
      inputSchema: z.object({
        objective: z.string(),
        toolId: z.string(),
      }),
      execute: async ({ objective, toolId }) => {
        const entry = findToolById(toolId);
        return {
          objective,
          toolName: entry?.name[locale] ?? toolId,
          hint: "Generate keyword suggestions in your response based on the objective and tool.",
        };
      },
    }),

    suggestAIAnalysis: tool({
      description:
        "Suggest AI analysis templates (sentiment, classification, etc.)",
      inputSchema: z.object({
        objective: z.string(),
        dataType: z.string(),
      }),
      execute: async ({ objective, dataType }) => {
        const dt = dataType.toLowerCase();
        const suggestions: {
          type: string;
          description: Record<Locale, string>;
        }[] = [];

        // Sentiment analysis for reviews and social posts
        if (
          dt.includes("review") ||
          dt.includes("post") ||
          dt.includes("comment")
        ) {
          suggestions.push({
            type: "sentiment",
            description: {
              en: "Analyze sentiment (positive, negative, neutral) across all results",
              es: "Analizar sentimiento (positivo, negativo, neutral) en todos los resultados",
            },
          });
        }

        // Pain points for reviews
        if (dt.includes("review") || dt.includes("feedback")) {
          suggestions.push({
            type: "pain_points",
            description: {
              en: "Extract common pain points and complaints from user feedback",
              es: "Extraer puntos de dolor y quejas comunes del feedback de usuarios",
            },
          });
        }

        // Classification for all data types
        suggestions.push({
          type: "classification",
          description: {
            en: "Automatically categorize results into meaningful groups",
            es: "Categorizar resultados automáticamente en grupos significativos",
          },
        });

        // Summary for all data types
        suggestions.push({
          type: "summary",
          description: {
            en: "Generate a comprehensive summary of all collected data",
            es: "Generar un resumen completo de todos los datos recopilados",
          },
        });

        return {
          objective,
          dataType,
          suggestions: suggestions.map((s) => ({
            type: s.type,
            description: s.description[locale],
          })),
        };
      },
    }),

    executeResearch: tool({
      description:
        "Execute the configured research (only after user confirms)",
      inputSchema: z.object({
        title: z.string(),
        tools: z.array(
          z.object({
            toolId: z.string(),
            config: z.record(z.string(), z.unknown()),
            estimatedResults: z.number(),
          })
        ),
        aiAnalysis: z
          .array(
            z.object({
              type: z.string(),
              config: z.record(z.string(), z.unknown()).optional(),
            })
          )
          .optional(),
      }),
      execute: async ({ title, tools, aiAnalysis }) => {
        try {
          if (tools.length === 0) {
            return { error: t.noToolsProvided };
          }

          const supabase = await createClient();

          // 1. Check credit balance
          const { data: balanceData, error: balanceError } = await supabase.rpc(
            "get_credit_balance",
            { p_user_id: userId }
          );

          if (balanceError) {
            return { error: t.generic };
          }

          // Calculate total cost
          let totalCost = 0;
          for (const toolDef of tools) {
            const estimate = estimateCostFromCatalog(
              toolDef.toolId,
              toolDef.estimatedResults
            );
            if (estimate) {
              totalCost += estimate.expected;
            }
          }

          const balance = (balanceData as number) ?? 0;
          if (balance < totalCost) {
            return {
              error: t.insufficientCredits,
              required: totalCost,
              available: balance,
            };
          }

          // 2. Update project with title and status
          const { error: projectError } = await supabase
            .from("research_projects")
            .update({
              title,
              status: "running",
            })
            .eq("id", projectId)
            .eq("user_id", userId);

          if (projectError) {
            return { error: errorMessages[locale].projectUpdateFailed };
          }

          // 3. Create scraping jobs
          const scrapingJobs = tools.map((entry) => {
            const catalogEntry = findToolById(entry.toolId);
            return {
              project_id: projectId,
              tool_id: entry.toolId,
              actor_id: catalogEntry?.actorId ?? entry.toolId,
              config: entry.config,
              estimated_results: entry.estimatedResults,
              status: "pending",
            };
          });

          const { error: jobsError } = await supabase
            .from("scraping_jobs")
            .insert(scrapingJobs);

          if (jobsError) {
            return { error: errorMessages[locale].generic };
          }

          // 4. Create AI analysis configs if provided
          if (aiAnalysis && aiAnalysis.length > 0) {
            const analysisConfigs = aiAnalysis.map((a) => ({
              project_id: projectId,
              type: a.type,
              config: a.config ?? {},
              status: "pending",
            }));

            await supabase
              .from("ai_analysis_configs")
              .insert(analysisConfigs);
          }

          // 5. Reserve credits via negative transaction
          const { error: txError } = await supabase
            .from("transactions")
            .insert({
              user_id: userId,
              amount: -totalCost,
              type: "scraping_reserve",
              project_id: projectId,
              description: `Credit reserve for project: ${title}`,
            });

          if (txError) {
            return { error: errorMessages[locale].generic };
          }

          // Dispatch Inngest event to start scraping pipeline
          await inngest.send({
            name: "research/execute",
            data: { projectId },
          });

          // Update project status to 'running'
          await supabase
            .from("research_projects")
            .update({ status: "running" })
            .eq("id", projectId);

          const costFormatted = totalCost.toFixed(2);
          const successMessage =
            locale === "es"
              ? `Investigacion iniciada! Costo estimado: $${costFormatted}. Podes seguir el progreso en tiempo real.`
              : `Research started! Estimated cost: $${costFormatted}. You can track progress in real time.`;

          return {
            success: true,
            projectId,
            status: "running",
            jobsCreated: tools.length,
            totalEstimatedCost: totalCost,
            creditBalance: balance - totalCost,
            message: successMessage,
          };
        } catch {
          return { error: errorMessages[locale].generic };
        }
      },
    }),
  };
}
