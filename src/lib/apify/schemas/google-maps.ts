import type { ToolSchema } from "../tool-schema";

export const googleMapsSchema: ToolSchema = {
  toolId: "google-maps",
  version: 1,

  paramGroups: [
    // ── 1. Search ──────────────────────────────────────────────────────
    {
      id: "search",
      label: { en: "Search", es: "Busqueda", pt: "Pesquisa", fr: "Recherche", de: "Suche" },
      params: [
        {
          id: "searchStringsArray",
          apifyField: "searchStringsArray",
          kind: "keyword_list",
          label: { en: "Search keywords", es: "Palabras clave de busqueda", pt: "Palavras-chave de pesquisa", fr: "Mots-cles de recherche", de: "Suchbegriffe" },
          description: {
            en: "Keywords to search for on Google Maps",
            es: "Palabras clave para buscar en Google Maps",
            pt: "Palavras-chave para pesquisar no Google Maps",
            fr: "Mots-cles a rechercher sur Google Maps",
            de: "Schlusselworter zur Suche auf Google Maps",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
        {
          id: "location",
          apifyField: "location",
          kind: "text",
          label: { en: "Location", es: "Ubicacion", pt: "Localizacao", fr: "Localisation", de: "Standort" },
          description: {
            en: "Geographic area to search in",
            es: "Area geografica donde buscar",
            pt: "Area geografica onde pesquisar",
            fr: "Zone geographique de recherche",
            de: "Geografisches Gebiet fur die Suche",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: undefined,
        },
      ],
    },

    // ── 2. Filters ─────────────────────────────────────────────────────
    {
      id: "filters",
      label: { en: "Filters", es: "Filtros", pt: "Filtros", fr: "Filtres", de: "Filter" },
      params: [
        {
          id: "language",
          apifyField: "language",
          kind: "enum",
          label: { en: "Language", es: "Idioma", pt: "Idioma", fr: "Langue", de: "Sprache" },
          description: {
            en: "Language for search results",
            es: "Idioma de los resultados",
            pt: "Idioma dos resultados",
            fr: "Langue des resultats",
            de: "Sprache der Ergebnisse",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: "en",
          options: [
            { value: "en", label: { en: "English", es: "Ingles", pt: "Ingles", fr: "Anglais", de: "Englisch" } },
            { value: "es", label: { en: "Spanish", es: "Espanol", pt: "Espanhol", fr: "Espagnol", de: "Spanisch" } },
            { value: "pt", label: { en: "Portuguese", es: "Portugues", pt: "Portugues", fr: "Portugais", de: "Portugiesisch" } },
            { value: "fr", label: { en: "French", es: "Frances", pt: "Frances", fr: "Francais", de: "Franzosisch" } },
            { value: "de", label: { en: "German", es: "Aleman", pt: "Alemao", fr: "Allemand", de: "Deutsch" } },
            { value: "it", label: { en: "Italian", es: "Italiano", pt: "Italiano", fr: "Italien", de: "Italienisch" } },
            { value: "ja", label: { en: "Japanese", es: "Japones", pt: "Japones", fr: "Japonais", de: "Japanisch" } },
            { value: "ko", label: { en: "Korean", es: "Coreano", pt: "Coreano", fr: "Coreen", de: "Koreanisch" } },
            { value: "zh", label: { en: "Chinese", es: "Chino", pt: "Chines", fr: "Chinois", de: "Chinesisch" } },
          ],
        },
        {
          id: "categoriesArray",
          apifyField: "categoriesArray",
          kind: "keyword_list",
          label: { en: "Categories", es: "Categorias", pt: "Categorias", fr: "Categories", de: "Kategorien" },
          description: {
            en: "Filter by place categories",
            es: "Filtrar por categorias de lugares",
            pt: "Filtrar por categorias de lugares",
            fr: "Filtrer par categories de lieux",
            de: "Nach Ortskategorien filtern",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: undefined,
        },
        {
          id: "deeperCityScrape",
          apifyField: "deeperCityScrape",
          kind: "boolean",
          label: { en: "Deeper city scrape", es: "Rastreo profundo de ciudad", pt: "Rastreamento profundo de cidade", fr: "Exploration approfondie de la ville", de: "Tiefere Stadtsuche" },
          description: {
            en: "Enable deeper scraping for large cities",
            es: "Habilitar rastreo profundo para ciudades grandes",
            pt: "Habilitar rastreamento profundo para grandes cidades",
            fr: "Activer l'exploration approfondie pour les grandes villes",
            de: "Tiefere Suche fur grosse Stadte aktivieren",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: false,
        },
      ],
    },

    // ── 3. Enrichment ──────────────────────────────────────────────────
    {
      id: "enrichment",
      label: { en: "Enrichment", es: "Enriquecimiento", pt: "Enriquecimento", fr: "Enrichissement", de: "Anreicherung" },
      params: [
        {
          id: "includeReviews",
          apifyField: "includeReviews",
          kind: "boolean",
          label: { en: "Include reviews", es: "Incluir resenas", pt: "Incluir avaliacoes", fr: "Inclure les avis", de: "Bewertungen einschliessen" },
          description: {
            en: "Include place reviews in results",
            es: "Incluir resenas de lugares en los resultados",
            pt: "Incluir avaliacoes de lugares nos resultados",
            fr: "Inclure les avis des lieux dans les resultats",
            de: "Ortsbewertungen in die Ergebnisse einschliessen",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: false,
          volumeMultiplier: 1.5,
        },
        {
          id: "enrichContactDetails",
          apifyField: "enrichContactDetails",
          kind: "boolean",
          label: { en: "Enrich contact details", es: "Enriquecer datos de contacto", pt: "Enriquecer dados de contato", fr: "Enrichir les coordonnees", de: "Kontaktdaten anreichern" },
          description: {
            en: "Extract additional contact information",
            es: "Extraer informacion de contacto adicional",
            pt: "Extrair informacoes de contato adicionais",
            fr: "Extraire des informations de contact supplementaires",
            de: "Zusatzliche Kontaktinformationen extrahieren",
          },
          importance: "low",
          advanced: true,
          required: false,
          defaultValue: false,
        },
      ],
    },

    // ── 4. Volume ──────────────────────────────────────────────────────
    {
      id: "volume",
      label: { en: "Volume", es: "Volumen", pt: "Volume", fr: "Volume", de: "Volumen" },
      params: [
        {
          id: "maxCrawledPlacesPerSearch",
          apifyField: "maxCrawledPlacesPerSearch",
          kind: "number",
          label: { en: "Max places per search", es: "Maximo de lugares por busqueda", pt: "Maximo de lugares por pesquisa", fr: "Lieux maximum par recherche", de: "Max. Orte pro Suche" },
          description: {
            en: "Maximum number of places to return per search",
            es: "Numero maximo de lugares a devolver por busqueda",
            pt: "Numero maximo de lugares a retornar por pesquisa",
            fr: "Nombre maximum de lieux a retourner par recherche",
            de: "Maximale Anzahl von Orten pro Suche",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: 100,
          min: 1,
          max: 500,
        },
      ],
    },
  ],

  // ── Clarifying questions ─────────────────────────────────────────────
  clarifyingQuestions: [
    {
      id: "geographic_scope",
      question: {
        en: "Where should I search for businesses?",
        es: "Donde busco los negocios?",
        pt: "Onde devo pesquisar os negocios?",
        fr: "Ou dois-je rechercher les entreprises ?",
        de: "Wo soll ich nach Unternehmen suchen?",
      },
      paramIds: ["location"],
      triggerWhen: "Research involves geographic or local business research",
    },
  ],
};
