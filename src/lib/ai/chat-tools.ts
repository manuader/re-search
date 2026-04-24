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
import { getToolSchema as getToolSchemaFromRegistry } from "@/lib/apify/schemas";
import { getMapper, defaultMapper } from "@/lib/apify/mappers";
import { getChatbotParams, validateConfig } from "@/lib/apify/tool-schema";

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

    getToolSchema: tool({
      description:
        "Get the full configuration schema for a tool, including all parameters grouped by category with importance levels and clarifying questions. Use this to understand what to ask the user about before finalizing config. Falls back to legacy getToolConfig if no schema exists.",
      inputSchema: z.object({
        toolId: z.string(),
      }),
      execute: async ({ toolId }) => {
        const schema = getToolSchemaFromRegistry(toolId);
        if (!schema) {
          // Fall back to legacy catalog config for tools without schemas
          const config = getToolConfigFromCatalog(toolId, locale);
          if (!config) return { error: t.toolNotFound };
          return { legacy: true, ...config };
        }
        const params = getChatbotParams(schema);
        return {
          toolId: schema.toolId,
          params: params.map((p) => ({
            id: p.id,
            kind: p.kind,
            label: p.label[locale] ?? p.label.en,
            description: p.description[locale] ?? p.description.en,
            importance: p.importance,
            required: p.required,
            defaultValue: p.defaultValue,
            options: p.options?.map((o) => ({
              value: o.value,
              label: o.label[locale] ?? o.label.en,
            })),
          })),
          clarifyingQuestions: schema.clarifyingQuestions.map((q) => ({
            id: q.id,
            question: q.question[locale] ?? q.question.en,
            paramIds: q.paramIds,
            triggerWhen: q.triggerWhen,
          })),
        };
      },
    }),

    updateProjectConfig: tool({
      description:
        "Update the configuration for a specific tool. Call this after the user answers configuration questions. Validates the config and returns the updated cost estimate.",
      inputSchema: z.object({
        toolId: z.string(),
        config: z.record(z.string(), z.unknown()),
      }),
      execute: async ({ toolId, config }) => {
        // Validate against schema if available
        const schema = getToolSchemaFromRegistry(toolId);
        if (schema) {
          const errors = validateConfig(schema, config);
          if (errors.length > 0) {
            return { ok: false, errors };
          }
        }

        // Run through mapper to get effective result count
        const catalogEntry = findToolById(toolId);
        const mapper = getMapper(toolId) ?? defaultMapper;
        const result = mapper({
          locale,
          userConfig: config,
          catalogDefaults: catalogEntry?.inputSchema.defaults ?? {},
        });

        const estimate = estimateCostFromCatalog(
          toolId,
          result.effectiveResultCount
        );

        return {
          ok: true,
          toolId,
          effectiveResultCount: result.effectiveResultCount,
          estimate: estimate ?? { min: 0, max: 0, expected: 0, breakdown: "" },
          warnings: result.warnings,
        };
      },
    }),

    addToolToProject: tool({
      description: "Add a new tool to the current research project",
      inputSchema: z.object({
        toolId: z.string(),
        reason: z.string().describe("Brief reason why this tool is relevant"),
      }),
      execute: async ({ toolId }) => {
        const entry = findToolById(toolId);
        if (!entry) return { error: t.toolNotFound };

        const schema = getToolSchemaFromRegistry(toolId);
        return {
          toolId,
          name: entry.name[locale] ?? entry.name.en,
          hasSchema: !!schema,
          healthStatus: "unknown",
          costPer1000: entry.pricing.costPer1000,
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

          // 2. Create scraping jobs (use mapper when available, fallback to spread)
          //    If a tool has dateDistribution, create a parent job + N child jobs.
          interface JobRow {
            project_id: string;
            tool_id: string;
            tool_name: string;
            actor_input: Record<string, unknown>;
            estimated_results: number;
            estimated_cost: number;
            bucket_label?: string;
            parent_job_id?: string;
          }
          const allJobs: JobRow[] = [];

          for (const entry of tools) {
            const catalogEntry = findToolById(entry.toolId);
            const toolName = catalogEntry?.name[locale] ?? entry.toolId;
            const defaults = catalogEntry?.inputSchema.defaults ?? {};
            const mapper = getMapper(entry.toolId) ?? defaultMapper;
            const dist = entry.config.dateDistribution as
              | { buckets: Array<{ label: string; start: string; end: string; percentage: number }> }
              | undefined;

            if (dist && Array.isArray(dist.buckets) && dist.buckets.length > 1) {
              // Date distribution: create parent + children
              const totalResults = entry.estimatedResults;
              const parentJob: JobRow = {
                project_id: projectId,
                tool_id: entry.toolId,
                tool_name: toolName,
                actor_input: {},
                estimated_results: totalResults,
                estimated_cost: estimateCostFromCatalog(entry.toolId, totalResults)?.expected ?? 0,
                bucket_label: "__parent__",
              };
              allJobs.push(parentJob);

              for (const bucket of dist.buckets) {
                const bucketResults = Math.round((totalResults * bucket.percentage) / 100);
                const bucketConfig = { ...entry.config, dateRange: { start: bucket.start, end: bucket.end }, maxItems: bucketResults };
                delete (bucketConfig as Record<string, unknown>).dateDistribution;
                const mapped = mapper({ locale, userConfig: bucketConfig, catalogDefaults: defaults });
                allJobs.push({
                  project_id: projectId,
                  tool_id: entry.toolId,
                  tool_name: toolName,
                  actor_input: mapped.actorInput,
                  estimated_results: bucketResults,
                  estimated_cost: estimateCostFromCatalog(entry.toolId, bucketResults)?.expected ?? 0,
                  bucket_label: bucket.label,
                  // parent_job_id set after parent insert
                });
              }
            } else {
              // Normal single job
              const configWithoutDist = { ...entry.config };
              delete (configWithoutDist as Record<string, unknown>).dateDistribution;
              const mapped = mapper({ locale, userConfig: configWithoutDist, catalogDefaults: defaults });
              allJobs.push({
                project_id: projectId,
                tool_id: entry.toolId,
                tool_name: toolName,
                actor_input: mapped.actorInput,
                estimated_results: entry.estimatedResults,
                estimated_cost: estimateCostFromCatalog(entry.toolId, entry.estimatedResults)?.expected ?? 0,
              });
            }
          }

          // Insert parent jobs first, then children with parent_job_id
          const parentJobs = allJobs.filter((j) => j.bucket_label === "__parent__");
          const childJobs = allJobs.filter((j) => j.bucket_label && j.bucket_label !== "__parent__");
          const normalJobs = allJobs.filter((j) => !j.bucket_label);

          // Insert normal jobs
          if (normalJobs.length > 0) {
            const { error: normErr } = await supabase.from("scraping_jobs").insert(normalJobs);
            if (normErr) {
              console.error("[executeResearch] scraping_jobs insert error:", JSON.stringify(normErr));
              return { error: t.generic };
            }
          }

          // Insert parent + child jobs
          for (const parent of parentJobs) {
            const { data: parentRow, error: parentErr } = await supabase
              .from("scraping_jobs")
              .insert({ ...parent, status: "pending" })
              .select("id")
              .single();

            if (parentErr || !parentRow) {
              console.error("[executeResearch] parent job insert error:", JSON.stringify(parentErr));
              return { error: t.generic };
            }

            const children = childJobs
              .filter((c) => c.tool_id === parent.tool_id)
              .map((c) => ({ ...c, parent_job_id: parentRow.id }));

            if (children.length > 0) {
              const { error: childErr } = await supabase.from("scraping_jobs").insert(children);
              if (childErr) {
                console.error("[executeResearch] child jobs insert error:", JSON.stringify(childErr));
                return { error: t.generic };
              }
            }
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
