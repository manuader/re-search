import type { ToolSchema } from "../tool-schema";

export const instagramSchema: ToolSchema = {
  toolId: "instagram",
  version: 1,

  paramGroups: [
    // ── 1. Source ──────────────────────────────────────────────────────
    {
      id: "source",
      label: { en: "Source", es: "Fuente", pt: "Fonte", fr: "Source", de: "Quelle" },
      params: [
        {
          id: "directUrls",
          apifyField: "directUrls",
          kind: "keyword_list",
          label: { en: "Instagram URLs", es: "URLs de Instagram", pt: "URLs do Instagram", fr: "URLs Instagram", de: "Instagram-URLs" },
          description: {
            en: "Instagram profile URLs or hashtag pages",
            es: "URLs de perfiles o paginas de hashtags",
            pt: "URLs de perfis ou paginas de hashtags",
            fr: "URLs de profils ou pages de hashtags",
            de: "Instagram-Profil-URLs oder Hashtag-Seiten",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
        {
          id: "search",
          apifyField: "search",
          kind: "text",
          label: { en: "Search query", es: "Busqueda", pt: "Pesquisa", fr: "Recherche", de: "Suchanfrage" },
          description: {
            en: "Search query for profiles, hashtags, or places",
            es: "Busqueda de perfiles, hashtags o lugares",
            pt: "Pesquisa de perfis, hashtags ou lugares",
            fr: "Recherche de profils, hashtags ou lieux",
            de: "Suche nach Profilen, Hashtags oder Orten",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: undefined,
        },
        {
          id: "searchType",
          apifyField: "searchType",
          kind: "enum",
          label: { en: "Search type", es: "Tipo de busqueda", pt: "Tipo de pesquisa", fr: "Type de recherche", de: "Suchtyp" },
          description: {
            en: "Type of search to perform",
            es: "Tipo de busqueda a realizar",
            pt: "Tipo de pesquisa a realizar",
            fr: "Type de recherche a effectuer",
            de: "Art der durchzufuhrenden Suche",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: undefined,
          options: [
            { value: "user", label: { en: "User", es: "Usuario", pt: "Usuario", fr: "Utilisateur", de: "Benutzer" } },
            { value: "hashtag", label: { en: "Hashtag", es: "Hashtag", pt: "Hashtag", fr: "Hashtag", de: "Hashtag" } },
            { value: "place", label: { en: "Place", es: "Lugar", pt: "Lugar", fr: "Lieu", de: "Ort" } },
          ],
        },
      ],
    },

    // ── 2. Content ─────────────────────────────────────────────────────
    {
      id: "content",
      label: { en: "Content", es: "Contenido", pt: "Conteudo", fr: "Contenu", de: "Inhalt" },
      params: [
        {
          id: "resultsType",
          apifyField: "resultsType",
          kind: "enum",
          label: { en: "Results type", es: "Tipo de resultados", pt: "Tipo de resultados", fr: "Type de resultats", de: "Ergebnistyp" },
          description: {
            en: "Type of data to return",
            es: "Tipo de datos a devolver",
            pt: "Tipo de dados a retornar",
            fr: "Type de donnees a retourner",
            de: "Art der zuruckzugebenden Daten",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: "posts",
          options: [
            { value: "posts", label: { en: "Posts", es: "Publicaciones", pt: "Publicacoes", fr: "Publications", de: "Beitrage" } },
            { value: "metadata", label: { en: "Metadata", es: "Metadatos", pt: "Metadados", fr: "Metadonnees", de: "Metadaten" } },
          ],
        },
        {
          id: "addParentData",
          apifyField: "addParentData",
          kind: "boolean",
          label: { en: "Add parent data", es: "Agregar datos del perfil", pt: "Adicionar dados do perfil", fr: "Ajouter les donnees du profil", de: "Profildaten hinzufugen" },
          description: {
            en: "Include parent profile data with each post",
            es: "Incluir datos del perfil con cada publicacion",
            pt: "Incluir dados do perfil com cada publicacao",
            fr: "Inclure les donnees du profil avec chaque publication",
            de: "Profildaten mit jedem Beitrag einschliessen",
          },
          importance: "low",
          advanced: true,
          required: false,
          defaultValue: false,
        },
      ],
    },

    // ── 3. Volume ──────────────────────────────────────────────────────
    {
      id: "volume",
      label: { en: "Volume", es: "Volumen", pt: "Volume", fr: "Volume", de: "Volumen" },
      params: [
        {
          id: "resultsLimit",
          apifyField: "resultsLimit",
          kind: "number",
          label: { en: "Max results", es: "Maximo de resultados", pt: "Maximo de resultados", fr: "Resultats maximum", de: "Max. Ergebnisse" },
          description: {
            en: "Maximum number of results to return",
            es: "Numero maximo de resultados a devolver",
            pt: "Numero maximo de resultados a retornar",
            fr: "Nombre maximum de resultats a retourner",
            de: "Maximale Anzahl zuruckzugebender Ergebnisse",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: 50,
          min: 1,
          max: 5000,
        },
        {
          id: "searchLimit",
          apifyField: "searchLimit",
          kind: "number",
          label: { en: "Search limit", es: "Limite de busqueda", pt: "Limite de pesquisa", fr: "Limite de recherche", de: "Suchlimit" },
          description: {
            en: "Max search results before scraping",
            es: "Maximo de resultados de busqueda",
            pt: "Maximo de resultados de pesquisa",
            fr: "Maximum de resultats de recherche",
            de: "Maximale Suchergebnisse vor dem Scraping",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: 10,
          min: 1,
          max: 100,
        },
      ],
    },
  ],

  // ── Cross-validation ─────────────────────────────────────────────────
  crossValidate: (config) => {
    const errors: string[] = [];

    const directUrls = config.directUrls as string[] | undefined;
    const search = config.search as string | undefined;

    if (
      (!directUrls || directUrls.length === 0) &&
      (!search || search.trim() === "")
    ) {
      errors.push("Either URLs or a search query is required");
    }

    return errors;
  },

  // ── Clarifying questions ─────────────────────────────────────────────
  clarifyingQuestions: [
    {
      id: "source_type",
      question: {
        en: "Do you want to scrape specific profiles/hashtags, or search for content?",
        es: "Queres scrapear perfiles/hashtags especificos, o buscar contenido?",
        pt: "Quer extrair perfis/hashtags especificos, ou pesquisar conteudo?",
        fr: "Voulez-vous extraire des profils/hashtags specifiques, ou rechercher du contenu ?",
        de: "Mochten Sie bestimmte Profile/Hashtags scrapen, oder nach Inhalten suchen?",
      },
      paramIds: ["directUrls", "search"],
      triggerWhen:
        "Research involves Instagram data and the user hasn't specified a source",
    },
  ],
};
