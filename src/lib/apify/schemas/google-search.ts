import type { ToolSchema } from "../tool-schema";

export const googleSearchSchema: ToolSchema = {
  toolId: "google-search",
  version: 1,

  paramGroups: [
    // ── Query ──────────────────────────────────────────────────────────
    {
      id: "query",
      label: { en: "Search", es: "Busqueda", pt: "Pesquisa", fr: "Recherche", de: "Suche" },
      params: [
        {
          id: "queries",
          apifyField: "queries",
          kind: "keyword_list",
          label: { en: "Search queries", es: "Consultas de busqueda", pt: "Consultas de pesquisa", fr: "Requetes de recherche", de: "Suchanfragen" },
          description: {
            en: "Google search queries to run",
            es: "Consultas de busqueda de Google a ejecutar",
            pt: "Consultas de pesquisa do Google a executar",
            fr: "Requetes de recherche Google a executer",
            de: "Auszufuhrende Google-Suchanfragen",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
      ],
    },

    // ── Language & Region ──────────────────────────────────────────────
    {
      id: "locale",
      label: { en: "Language & Region", es: "Idioma y region", pt: "Idioma e regiao", fr: "Langue et region", de: "Sprache und Region" },
      params: [
        {
          id: "countryCode",
          apifyField: "countryCode",
          kind: "enum",
          label: { en: "Country", es: "Pais", pt: "Pais", fr: "Pays", de: "Land" },
          description: {
            en: "Country for localized search results",
            es: "Pais para resultados de busqueda localizados",
            pt: "Pais para resultados de pesquisa localizados",
            fr: "Pays pour les resultats de recherche localises",
            de: "Land fur lokalisierte Suchergebnisse",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: "us",
          options: [
            { value: "us", label: { en: "United States", es: "Estados Unidos", pt: "Estados Unidos", fr: "Etats-Unis", de: "Vereinigte Staaten" } },
            { value: "gb", label: { en: "United Kingdom", es: "Reino Unido", pt: "Reino Unido", fr: "Royaume-Uni", de: "Vereinigtes Konigreich" } },
            { value: "es", label: { en: "Spain", es: "Espana", pt: "Espanha", fr: "Espagne", de: "Spanien" } },
            { value: "mx", label: { en: "Mexico", es: "Mexico", pt: "Mexico", fr: "Mexique", de: "Mexiko" } },
            { value: "ar", label: { en: "Argentina", es: "Argentina", pt: "Argentina", fr: "Argentine", de: "Argentinien" } },
            { value: "br", label: { en: "Brazil", es: "Brasil", pt: "Brasil", fr: "Bresil", de: "Brasilien" } },
            { value: "fr", label: { en: "France", es: "Francia", pt: "Franca", fr: "France", de: "Frankreich" } },
            { value: "de", label: { en: "Germany", es: "Alemania", pt: "Alemanha", fr: "Allemagne", de: "Deutschland" } },
            { value: "it", label: { en: "Italy", es: "Italia", pt: "Italia", fr: "Italie", de: "Italien" } },
            { value: "jp", label: { en: "Japan", es: "Japon", pt: "Japao", fr: "Japon", de: "Japan" } },
            { value: "kr", label: { en: "South Korea", es: "Corea del Sur", pt: "Coreia do Sul", fr: "Coree du Sud", de: "Sudkorea" } },
            { value: "in", label: { en: "India", es: "India", pt: "India", fr: "Inde", de: "Indien" } },
            { value: "au", label: { en: "Australia", es: "Australia", pt: "Australia", fr: "Australie", de: "Australien" } },
            { value: "ca", label: { en: "Canada", es: "Canada", pt: "Canada", fr: "Canada", de: "Kanada" } },
          ],
        },
        {
          id: "languageCode",
          apifyField: "languageCode",
          kind: "enum",
          label: { en: "Language", es: "Idioma", pt: "Idioma", fr: "Langue", de: "Sprache" },
          description: {
            en: "Language for search results",
            es: "Idioma para los resultados de busqueda",
            pt: "Idioma para os resultados de pesquisa",
            fr: "Langue pour les resultats de recherche",
            de: "Sprache fur die Suchergebnisse",
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
            { value: "ar", label: { en: "Arabic", es: "Arabe", pt: "Arabe", fr: "Arabe", de: "Arabisch" } },
            { value: "ru", label: { en: "Russian", es: "Ruso", pt: "Russo", fr: "Russe", de: "Russisch" } },
          ],
        },
        {
          id: "locationUule",
          apifyField: "locationUule",
          kind: "text",
          label: { en: "Exact location (UULE)", es: "Ubicacion exacta (UULE)", pt: "Localizacao exata (UULE)", fr: "Localisation exacte (UULE)", de: "Genauer Standort (UULE)" },
          description: {
            en: "Google UULE parameter for precise geolocation",
            es: "Parametro UULE de Google para geolocalizacion precisa",
            pt: "Parametro UULE do Google para geolocalizacao precisa",
            fr: "Parametre UULE de Google pour la geolocalisation precise",
            de: "Google UULE-Parameter fur prazise Geolokalisierung",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: undefined,
        },
      ],
    },

    // ── Volume ─────────────────────────────────────────────────────────
    {
      id: "volume",
      label: { en: "Volume", es: "Volumen", pt: "Volume", fr: "Volume", de: "Volumen" },
      params: [
        {
          id: "maxPagesPerQuery",
          apifyField: "maxPagesPerQuery",
          kind: "number",
          label: { en: "Pages per query", es: "Paginas por consulta", pt: "Paginas por consulta", fr: "Pages par requete", de: "Seiten pro Anfrage" },
          description: {
            en: "Number of Google result pages to scrape per query (10 results per page)",
            es: "Numero de paginas de resultados a extraer por consulta (10 resultados por pagina)",
            pt: "Numero de paginas de resultados a extrair por consulta (10 resultados por pagina)",
            fr: "Nombre de pages de resultats a extraire par requete (10 resultats par page)",
            de: "Anzahl der Google-Ergebnisseiten pro Anfrage (10 Ergebnisse pro Seite)",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: 1,
          min: 1,
          max: 10,
        },
      ],
    },

    // ── Options ────────────────────────────────────────────────────────
    {
      id: "options",
      label: { en: "Options", es: "Opciones", pt: "Opcoes", fr: "Options", de: "Optionen" },
      params: [
        {
          id: "mobileResults",
          apifyField: "mobileResults",
          kind: "boolean",
          label: { en: "Mobile results", es: "Resultados moviles", pt: "Resultados moveis", fr: "Resultats mobiles", de: "Mobile Ergebnisse" },
          description: {
            en: "Fetch mobile version of search results",
            es: "Obtener version movil de los resultados",
            pt: "Obter versao movel dos resultados",
            fr: "Obtenir la version mobile des resultats",
            de: "Mobile Version der Suchergebnisse abrufen",
          },
          importance: "low",
          advanced: true,
          required: false,
          defaultValue: false,
        },
        {
          id: "includeUnfilteredResults",
          apifyField: "includeUnfilteredResults",
          kind: "boolean",
          label: { en: "Include unfiltered", es: "Incluir sin filtrar", pt: "Incluir sem filtro", fr: "Inclure non filtres", de: "Ungefiltert einschliessen" },
          description: {
            en: "Include unfiltered search results",
            es: "Incluir resultados de busqueda sin filtrar",
            pt: "Incluir resultados de pesquisa sem filtro",
            fr: "Inclure les resultats de recherche non filtres",
            de: "Ungefilterte Suchergebnisse einschliessen",
          },
          importance: "low",
          advanced: true,
          required: false,
          defaultValue: false,
        },
      ],
    },
  ],

  clarifyingQuestions: [
    {
      id: "search_country",
      question: {
        en: "Which country's Google should I search from? This affects which results appear.",
        es: "Desde que pais de Google busco? Esto afecta que resultados aparecen.",
        pt: "De qual pais do Google devo pesquisar? Isso afeta quais resultados aparecem.",
        fr: "Depuis quel pays Google dois-je rechercher ? Cela affecte les resultats affiches.",
        de: "Von welchem Land aus soll ich bei Google suchen? Dies beeinflusst die angezeigten Ergebnisse.",
      },
      paramIds: ["countryCode", "languageCode"],
      triggerWhen:
        "Research is geographically focused or needs localized results",
    },
  ],
};
