import type { ToolSchema } from "../tool-schema";

export const tweetsSchema: ToolSchema = {
  toolId: "tweets",
  version: 1,

  paramGroups: [
    // ── 1. Source ────────────────────────────────────────────────────────
    {
      id: "source",
      label: { en: "Source", es: "Fuente", pt: "Fonte", fr: "Source", de: "Quelle" },
      params: [
        {
          id: "handles",
          apifyField: "handles",
          kind: "keyword_list",
          label: { en: "Handles or URLs", es: "Cuentas o URLs", pt: "Contas ou URLs", fr: "Comptes ou URLs", de: "Konten oder URLs" },
          description: {
            en: "Twitter handles (without @) or tweet URLs",
            es: "Cuentas de Twitter (sin @) o URLs de tweets",
            pt: "Contas do Twitter (sem @) ou URLs de tweets",
            fr: "Comptes Twitter (sans @) ou URLs de tweets",
            de: "Twitter-Konten (ohne @) oder Tweet-URLs",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
      ],
    },

    // ── 2. Filters ──────────────────────────────────────────────────────
    {
      id: "filters",
      label: { en: "Filters", es: "Filtros", pt: "Filtros", fr: "Filtres", de: "Filter" },
      params: [
        {
          id: "includeReplies",
          apifyField: "includeReplies",
          kind: "boolean",
          label: { en: "Include replies", es: "Incluir respuestas", pt: "Incluir respostas", fr: "Inclure les reponses", de: "Antworten einschliessen" },
          description: {
            en: "Include reply tweets in the results",
            es: "Incluir respuestas en los resultados",
            pt: "Incluir respostas nos resultados",
            fr: "Inclure les reponses dans les resultats",
            de: "Antwort-Tweets in die Ergebnisse einschliessen",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: false,
          volumeMultiplier: 1.4,
        },
        {
          id: "sort",
          apifyField: "sort",
          kind: "enum",
          label: { en: "Sort order", es: "Orden", pt: "Ordenacao", fr: "Ordre de tri", de: "Sortierung" },
          description: {
            en: "Sort tweets by recency or popularity",
            es: "Ordenar tweets por recientes o populares",
            pt: "Ordenar tweets por recentes ou populares",
            fr: "Trier les tweets par date ou popularite",
            de: "Tweets nach Aktualitat oder Beliebtheit sortieren",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: "Latest",
          options: [
            { value: "Latest", label: { en: "Latest", es: "Mas recientes", pt: "Mais recentes", fr: "Plus recents", de: "Neueste" } },
            { value: "Top", label: { en: "Top", es: "Principales", pt: "Principais", fr: "Meilleurs", de: "Beliebteste" } },
          ],
        },
      ],
    },

    // ── 3. Volume ───────────────────────────────────────────────────────
    {
      id: "volume",
      label: { en: "Volume", es: "Volumen", pt: "Volume", fr: "Volume", de: "Volumen" },
      params: [
        {
          id: "maxItems",
          apifyField: "maxItems",
          kind: "number",
          label: { en: "Max tweets", es: "Maximo de tweets", pt: "Maximo de tweets", fr: "Tweets maximum", de: "Max. Tweets" },
          description: {
            en: "Maximum number of tweets to return",
            es: "Numero maximo de tweets a devolver",
            pt: "Numero maximo de tweets a retornar",
            fr: "Nombre maximum de tweets a retourner",
            de: "Maximale Anzahl zuruckzugebender Tweets",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: 100,
          min: 1,
          max: 10000,
        },
      ],
    },
  ],

  clarifyingQuestions: [],
};
