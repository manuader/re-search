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

const errorMessages: Record<Locale, Record<string, string>> = {
  en: {
    toolNotFound: "Tool not found in catalog.",
    noToolsProvided: "No tools were provided for execution.",
    projectUpdateFailed: "Failed to update the project. Please try again.",
    generic: "An error occurred. Please try again.",
  },
  es: {
    toolNotFound: "Herramienta no encontrada en el catalogo.",
    noToolsProvided: "No se proporcionaron herramientas para ejecutar.",
    projectUpdateFailed: "Error al actualizar el proyecto. Por favor intenta de nuevo.",
    generic: "Ocurrio un error. Por favor intenta de nuevo.",
  },
  pt: {
    toolNotFound: "Ferramenta nao encontrada no catalogo.",
    noToolsProvided: "Nenhuma ferramenta foi fornecida para execucao.",
    projectUpdateFailed: "Falha ao atualizar o projeto. Tente novamente.",
    generic: "Ocorreu um erro. Tente novamente.",
  },
  fr: {
    toolNotFound: "Outil introuvable dans le catalogue.",
    noToolsProvided: "Aucun outil n'a ete fourni pour l'execution.",
    projectUpdateFailed: "Echec de la mise a jour du projet. Veuillez reessayer.",
    generic: "Une erreur est survenue. Veuillez reessayer.",
  },
  de: {
    toolNotFound: "Werkzeug nicht im Katalog gefunden.",
    noToolsProvided: "Keine Werkzeuge zur Ausfuhrung angegeben.",
    projectUpdateFailed: "Projekt konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
    generic: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
  },
};

const checkoutMessages: Record<Locale, (cost: string) => string> = {
  en: (c) => `Your research is ready! Estimated price: $${c}. Please proceed to checkout to pay and start execution.`,
  es: (c) => `Tu investigacion esta lista! Precio estimado: $${c}. Procede al checkout para pagar e iniciar la ejecucion.`,
  pt: (c) => `Sua pesquisa esta pronta! Preco estimado: $${c}. Prossiga para o checkout para pagar e iniciar a execucao.`,
  fr: (c) => `Votre recherche est prete ! Prix estime : ${c} $. Procedez au paiement pour lancer l'execution.`,
  de: (c) => `Ihre Forschung ist bereit! Geschatzter Preis: ${c} $. Fahren Sie mit der Zahlung fort, um die Ausfuhrung zu starten.`,
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
      description:
        "Generate optimized search keywords. YOU must provide the keywords array yourself based on the user's research objective. Include variations, colloquial terms, hashtags, and common misspellings in the user's language.",
      inputSchema: z.object({
        objective: z.string().describe("The research objective"),
        toolId: z.string().describe("The tool to generate keywords for"),
        keywords: z
          .array(z.string())
          .describe("Array of 5-15 suggested keywords YOU generate"),
      }),
      execute: async ({ toolId, keywords }) => {
        const entry = findToolById(toolId);
        const resultsPerKeyword = 100;
        const totalResults = keywords.length * resultsPerKeyword;
        const estimate = estimateCostFromCatalog(toolId, totalResults);
        return {
          toolId,
          toolName: (entry?.name[locale] ?? entry?.name.en) ?? toolId,
          keywords,
          resultsPerKeyword,
          costPerKeyword: estimate
            ? Math.round((estimate.expected / keywords.length) * 100) / 100
            : 0,
          totalEstimate: estimate?.expected ?? 0,
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
          description: Record<string, string>;
        }[] = [];

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

        if (dt.includes("review") || dt.includes("feedback")) {
          suggestions.push({
            type: "pain_points",
            description: {
              en: "Extract common pain points and complaints from user feedback",
              es: "Extraer puntos de dolor y quejas comunes del feedback de usuarios",
            },
          });
        }

        suggestions.push({
          type: "classification",
          description: {
            en: "Automatically categorize results into meaningful groups",
            es: "Categorizar resultados automaticamente en grupos significativos",
          },
        });

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
            description: s.description[locale] ?? s.description.en,
          })),
        };
      },
    }),

    executeResearch: tool({
      description:
        "Configure the research and redirect user to checkout for payment (only after user confirms)",
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

          // 1. Update project with title and status
          const { error: projectError } = await supabase
            .from("research_projects")
            .update({
              title,
              status: "configured",
            })
            .eq("id", projectId)
            .eq("user_id", userId);

          if (projectError) {
            console.error("[executeResearch] project update error:", JSON.stringify(projectError));
            return { error: t.projectUpdateFailed };
          }

          // 2. Create scraping jobs
          const scrapingJobs = tools.map((entry) => {
            const catalogEntry = findToolById(entry.toolId);
            return {
              project_id: projectId,
              tool_id: entry.toolId,
              tool_name: catalogEntry?.name[locale] ?? entry.toolId,
              actor_input: { ...catalogEntry?.inputSchema.defaults, ...entry.config },
              estimated_results: entry.estimatedResults,
              estimated_cost: estimateCostFromCatalog(entry.toolId, entry.estimatedResults)?.expected ?? 0,
            };
          });

          const { error: jobsError } = await supabase
            .from("scraping_jobs")
            .insert(scrapingJobs);

          if (jobsError) {
            console.error("[executeResearch] scraping_jobs insert error:", JSON.stringify(jobsError));
            return { error: t.generic };
          }

          // 3. Create AI analysis configs if provided
          if (aiAnalysis && aiAnalysis.length > 0) {
            const analysisConfigs = aiAnalysis.map((a) => ({
              project_id: projectId,
              analysis_type: a.type,
              output_field_name: `ai_${a.type}`,
              config: a.config ?? {},
            }));

            const { error: aiError } = await supabase
              .from("ai_analysis_configs")
              .insert(analysisConfigs);

            if (aiError) {
              console.error("[executeResearch] ai_analysis_configs insert error:", JSON.stringify(aiError));
            }
          }

          // 4. Calculate estimated price for display
          let totalEstimatedCost = 0;
          for (const toolDef of tools) {
            const estimate = estimateCostFromCatalog(toolDef.toolId, toolDef.estimatedResults);
            if (estimate) totalEstimatedCost += estimate.expected;
          }

          const costFormatted = totalEstimatedCost.toFixed(2);
          const message = checkoutMessages[locale](costFormatted);

          // 5. Redirect to checkout (no balance check, no credit reservation)
          return {
            success: true,
            action: "redirect_checkout",
            url: `/${locale}/projects/${projectId}/checkout`,
            projectId,
            message,
          };
        } catch {
          return { error: t.generic };
        }
      },
    }),
  };
}
