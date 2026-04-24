import type { ToolSchema } from "../tool-schema";

export const webCrawlerSchema: ToolSchema = {
  toolId: "web-crawler",
  version: 1,

  paramGroups: [
    // ── 1. Source ──────────────────────────────────────────────────────
    {
      id: "source",
      label: { en: "Source", es: "Fuente", pt: "Fonte", fr: "Source", de: "Quelle" },
      params: [
        {
          id: "startUrls",
          apifyField: "startUrls",
          kind: "keyword_list",
          label: { en: "Start URLs", es: "URLs de inicio", pt: "URLs de inicio", fr: "URLs de depart", de: "Start-URLs" },
          description: {
            en: "URLs to start crawling from",
            es: "URLs desde donde iniciar el rastreo",
            pt: "URLs para iniciar o rastreamento",
            fr: "URLs a partir desquelles commencer l'exploration",
            de: "URLs, von denen aus das Crawling gestartet wird",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
      ],
    },

    // ── 2. Options ─────────────────────────────────────────────────────
    {
      id: "options",
      label: { en: "Options", es: "Opciones", pt: "Opcoes", fr: "Options", de: "Optionen" },
      params: [
        {
          id: "crawlerType",
          apifyField: "crawlerType",
          kind: "enum",
          label: { en: "Crawler type", es: "Tipo de rastreador", pt: "Tipo de rastreador", fr: "Type d'explorateur", de: "Crawler-Typ" },
          description: {
            en: "Engine used for crawling",
            es: "Motor utilizado para el rastreo",
            pt: "Motor utilizado para o rastreamento",
            fr: "Moteur utilise pour l'exploration",
            de: "Fur das Crawling verwendete Engine",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: "playwright",
          options: [
            { value: "playwright", label: { en: "Playwright", es: "Playwright", pt: "Playwright", fr: "Playwright", de: "Playwright" } },
            { value: "cheerio", label: { en: "Cheerio", es: "Cheerio", pt: "Cheerio", fr: "Cheerio", de: "Cheerio" } },
            { value: "jsdom", label: { en: "JSDOM", es: "JSDOM", pt: "JSDOM", fr: "JSDOM", de: "JSDOM" } },
          ],
        },
        {
          id: "maxCrawlDepth",
          apifyField: "maxCrawlDepth",
          kind: "number",
          label: { en: "Max crawl depth", es: "Profundidad maxima", pt: "Profundidade maxima", fr: "Profondeur maximale", de: "Maximale Crawl-Tiefe" },
          description: {
            en: "How deep to follow links",
            es: "Profundidad maxima de enlaces",
            pt: "Profundidade maxima de links",
            fr: "Profondeur maximale des liens",
            de: "Maximale Link-Tiefe",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: 3,
          min: 0,
          max: 20,
        },
      ],
    },

    // ── 3. Volume ──────────────────────────────────────────────────────
    {
      id: "volume",
      label: { en: "Volume", es: "Volumen", pt: "Volume", fr: "Volume", de: "Volumen" },
      params: [
        {
          id: "maxCrawlPages",
          apifyField: "maxCrawlPages",
          kind: "number",
          label: { en: "Max pages", es: "Maximo de paginas", pt: "Maximo de paginas", fr: "Pages maximum", de: "Max. Seiten" },
          description: {
            en: "Maximum number of pages to crawl",
            es: "Numero maximo de paginas a rastrear",
            pt: "Numero maximo de paginas a rastrear",
            fr: "Nombre maximum de pages a explorer",
            de: "Maximale Anzahl zu durchsuchender Seiten",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: 50,
          min: 1,
          max: 10000,
        },
      ],
    },
  ],

  // ── Clarifying questions ─────────────────────────────────────────────
  clarifyingQuestions: [],
};
