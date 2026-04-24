import type { ToolSchema } from "../tool-schema";

export const contactExtractorSchema: ToolSchema = {
  toolId: "contact-extractor",
  version: 1,

  paramGroups: [
    // ── 1. Source ────────────────────────────────────────────────────────
    {
      id: "source",
      label: { en: "Source", es: "Fuente", pt: "Fonte", fr: "Source", de: "Quelle" },
      params: [
        {
          id: "startUrls",
          apifyField: "startUrls",
          kind: "keyword_list",
          label: { en: "Website URLs", es: "URLs de sitios web", pt: "URLs de sites", fr: "URLs de sites web", de: "Website-URLs" },
          description: {
            en: "Website URLs to extract contacts from",
            es: "URLs de sitios web para extraer contactos",
            pt: "URLs de sites para extrair contatos",
            fr: "URLs de sites web pour extraire les contacts",
            de: "Website-URLs zum Extrahieren von Kontakten",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
      ],
    },

    // ── 2. Options ──────────────────────────────────────────────────────
    {
      id: "options",
      label: { en: "Options", es: "Opciones", pt: "Opcoes", fr: "Options", de: "Optionen" },
      params: [
        {
          id: "maxDepth",
          apifyField: "maxDepth",
          kind: "number",
          label: { en: "Max depth", es: "Profundidad maxima", pt: "Profundidade maxima", fr: "Profondeur maximale", de: "Maximale Tiefe" },
          description: {
            en: "Link depth to crawl",
            es: "Profundidad de enlaces",
            pt: "Profundidade de links",
            fr: "Profondeur des liens",
            de: "Link-Tiefe fur das Crawling",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: 2,
          min: 0,
          max: 10,
        },
        {
          id: "maxPagesPerDomain",
          apifyField: "maxPagesPerDomain",
          kind: "number",
          label: { en: "Max pages per domain", es: "Paginas maximas por dominio", pt: "Paginas maximas por dominio", fr: "Pages maximum par domaine", de: "Max. Seiten pro Domain" },
          description: {
            en: "Maximum number of pages to crawl per domain",
            es: "Numero maximo de paginas a rastrear por dominio",
            pt: "Numero maximo de paginas a rastrear por dominio",
            fr: "Nombre maximum de pages a explorer par domaine",
            de: "Maximale Anzahl von Seiten pro Domain",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: 20,
          min: 1,
          max: 100,
        },
        {
          id: "sameDomain",
          apifyField: "sameDomain",
          kind: "boolean",
          label: { en: "Same domain only", es: "Solo mismo dominio", pt: "Apenas mesmo dominio", fr: "Meme domaine uniquement", de: "Nur gleiche Domain" },
          description: {
            en: "Only follow links within same domain",
            es: "Solo seguir enlaces del mismo dominio",
            pt: "Seguir apenas links do mesmo dominio",
            fr: "Suivre uniquement les liens du meme domaine",
            de: "Nur Links innerhalb derselben Domain folgen",
          },
          importance: "low",
          advanced: true,
          required: false,
          defaultValue: true,
        },
      ],
    },
  ],

  clarifyingQuestions: [],
};
