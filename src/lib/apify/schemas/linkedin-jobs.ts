import type { ToolSchema } from "../tool-schema";

export const linkedinJobsSchema: ToolSchema = {
  toolId: "linkedin-jobs",
  version: 1,

  paramGroups: [
    // ── 1. Search ───────────────────────────────────────────────────────
    {
      id: "search",
      label: { en: "Search", es: "Busqueda", pt: "Pesquisa", fr: "Recherche", de: "Suche" },
      params: [
        {
          id: "searchUrl",
          apifyField: "searchUrl",
          kind: "text",
          label: { en: "Search URL or keywords", es: "URL de busqueda o palabras clave", pt: "URL de pesquisa ou palavras-chave", fr: "URL de recherche ou mots-cles", de: "Such-URL oder Schlusselworter" },
          description: {
            en: "LinkedIn Jobs search URL or keywords",
            es: "URL de busqueda o palabras clave",
            pt: "URL de pesquisa ou palavras-chave do LinkedIn Jobs",
            fr: "URL de recherche ou mots-cles LinkedIn Jobs",
            de: "LinkedIn Jobs Such-URL oder Schlusselworter",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: "",
        },
        {
          id: "location",
          apifyField: "location",
          kind: "text",
          label: { en: "Location", es: "Ubicacion", pt: "Localizacao", fr: "Localisation", de: "Standort" },
          description: {
            en: "Job location filter",
            es: "Filtro de ubicacion",
            pt: "Filtro de localizacao",
            fr: "Filtre de localisation",
            de: "Standortfilter",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: undefined,
        },
      ],
    },

    // ── 2. Options ──────────────────────────────────────────────────────
    {
      id: "options",
      label: { en: "Options", es: "Opciones", pt: "Opcoes", fr: "Options", de: "Optionen" },
      params: [
        {
          id: "scrapeCompany",
          apifyField: "scrapeCompany",
          kind: "boolean",
          label: { en: "Scrape company details", es: "Extraer datos de la empresa", pt: "Extrair dados da empresa", fr: "Extraire les details de l'entreprise", de: "Unternehmensdaten extrahieren" },
          description: {
            en: "Also scrape company details",
            es: "Tambien extraer datos de la empresa",
            pt: "Tambem extrair dados da empresa",
            fr: "Extraire egalement les details de l'entreprise",
            de: "Auch Unternehmensdaten extrahieren",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: false,
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
          label: { en: "Max jobs", es: "Maximo de empleos", pt: "Maximo de vagas", fr: "Emplois maximum", de: "Max. Stellenangebote" },
          description: {
            en: "Maximum number of jobs to return",
            es: "Numero maximo de empleos a devolver",
            pt: "Numero maximo de vagas a retornar",
            fr: "Nombre maximum d'emplois a retourner",
            de: "Maximale Anzahl zuruckzugebender Stellenangebote",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: 50,
          min: 1,
          max: 1000,
        },
      ],
    },
  ],

  clarifyingQuestions: [
    {
      id: "location_preference",
      question: {
        en: "What location are you looking for jobs in?",
        es: "En que ubicacion buscas empleos?",
        pt: "Em qual localizacao voce procura vagas?",
        fr: "Dans quelle localisation recherchez-vous des emplois ?",
        de: "An welchem Standort suchen Sie nach Stellenangeboten?",
      },
      paramIds: ["location"],
      triggerWhen:
        "User has not specified a location for the job search",
    },
  ],
};
