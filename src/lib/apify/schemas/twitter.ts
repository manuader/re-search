import type { ToolSchema } from "../tool-schema";

export const twitterSchema: ToolSchema = {
  toolId: "twitter",
  version: 1,

  paramGroups: [
    // ── 1. Search ──────────────────────────────────────────────────────
    {
      id: "search",
      label: { en: "Search", es: "Busqueda", pt: "Pesquisa", fr: "Recherche", de: "Suche" },
      params: [
        {
          id: "searchTerms",
          apifyField: "searchTerms",
          kind: "keyword_list",
          label: { en: "Search terms", es: "Terminos de busqueda", pt: "Termos de pesquisa", fr: "Termes de recherche", de: "Suchbegriffe" },
          description: {
            en: "Keywords or hashtags to search for on Twitter",
            es: "Palabras clave o hashtags a buscar en Twitter",
            pt: "Palavras-chave ou hashtags para pesquisar no Twitter",
            fr: "Mots-cles ou hashtags a rechercher sur Twitter",
            de: "Schlusselworter oder Hashtags zur Suche auf Twitter",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
        {
          id: "author",
          apifyField: "author",
          kind: "text",
          label: { en: "From user", es: "De usuario", pt: "Do usuario", fr: "De l'utilisateur", de: "Von Benutzer" },
          description: {
            en: "Only tweets from this user handle (without @)",
            es: "Solo tweets de este usuario (sin @)",
            pt: "Apenas tweets deste usuario (sem @)",
            fr: "Uniquement les tweets de cet utilisateur (sans @)",
            de: "Nur Tweets von diesem Benutzer (ohne @)",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: undefined,
        },
        {
          id: "mentioning",
          apifyField: "mentioning",
          kind: "text",
          label: { en: "Mentioning user", es: "Mencionando usuario", pt: "Mencionando usuario", fr: "Mentionnant l'utilisateur", de: "Benutzer erwahnend" },
          description: {
            en: "Only tweets mentioning this user",
            es: "Solo tweets que mencionan a este usuario",
            pt: "Apenas tweets que mencionam este usuario",
            fr: "Uniquement les tweets mentionnant cet utilisateur",
            de: "Nur Tweets, die diesen Benutzer erwahnen",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: undefined,
        },
        {
          id: "excludeKeywords",
          apifyField: "excludeKeywords",
          kind: "keyword_list",
          label: { en: "Exclude keywords", es: "Excluir palabras clave", pt: "Excluir palavras-chave", fr: "Exclure des mots-cles", de: "Schlusselworter ausschliessen" },
          description: {
            en: "Keywords to exclude from search results",
            es: "Palabras clave a excluir de los resultados",
            pt: "Palavras-chave a excluir dos resultados",
            fr: "Mots-cles a exclure des resultats",
            de: "Schlusselworter, die aus den Ergebnissen ausgeschlossen werden",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: [],
        },
      ],
    },

    // ── 2. Temporal ────────────────────────────────────────────────────
    {
      id: "temporal",
      label: { en: "Time Period", es: "Periodo temporal", pt: "Periodo temporal", fr: "Periode", de: "Zeitraum" },
      params: [
        {
          id: "dateRange",
          apifyField: "start",
          kind: "date_range",
          label: { en: "Date range", es: "Rango de fechas", pt: "Intervalo de datas", fr: "Plage de dates", de: "Datumsbereich" },
          description: {
            en: "Period to search tweets from",
            es: "Periodo en el que buscar tweets",
            pt: "Periodo para pesquisar tweets",
            fr: "Periode de recherche des tweets",
            de: "Zeitraum fur die Tweet-Suche",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: undefined,
        },
        {
          id: "dateDistribution",
          apifyField: "dateDistribution",
          kind: "date_distribution",
          label: { en: "Temporal distribution", es: "Distribucion temporal", pt: "Distribuicao temporal", fr: "Distribution temporelle", de: "Zeitliche Verteilung" },
          description: {
            en: "Distribute results across time periods for trend analysis",
            es: "Distribuir resultados en periodos de tiempo para analisis de tendencias",
            pt: "Distribuir resultados em periodos de tempo para analise de tendencias",
            fr: "Distribuer les resultats sur des periodes pour l'analyse des tendances",
            de: "Ergebnisse uber Zeitraume verteilen fur Trendanalyse",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: undefined,
        },
      ],
    },

    // ── 3. Filters ─────────────────────────────────────────────────────
    {
      id: "filters",
      label: { en: "Filters", es: "Filtros", pt: "Filtros", fr: "Filtres", de: "Filter" },
      params: [
        {
          id: "tweetLanguage",
          apifyField: "tweetLanguage",
          kind: "enum",
          label: { en: "Language", es: "Idioma", pt: "Idioma", fr: "Langue", de: "Sprache" },
          description: {
            en: "Filter tweets by language",
            es: "Filtrar tweets por idioma",
            pt: "Filtrar tweets por idioma",
            fr: "Filtrer les tweets par langue",
            de: "Tweets nach Sprache filtern",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: undefined,
          options: [
            { value: "any", label: { en: "Any language", es: "Cualquier idioma", pt: "Qualquer idioma", fr: "Toutes les langues", de: "Alle Sprachen" } },
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
        {
          id: "onlyVerifiedUsers",
          apifyField: "onlyVerifiedUsers",
          kind: "boolean",
          label: { en: "Verified users only", es: "Solo usuarios verificados", pt: "Apenas usuarios verificados", fr: "Utilisateurs verifies uniquement", de: "Nur verifizierte Benutzer" },
          description: {
            en: "Only return tweets from verified users",
            es: "Solo devolver tweets de usuarios verificados",
            pt: "Retornar apenas tweets de usuarios verificados",
            fr: "Retourner uniquement les tweets d'utilisateurs verifies",
            de: "Nur Tweets von verifizierten Benutzern zuruckgeben",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: false,
        },
        {
          id: "onlyImage",
          apifyField: "onlyImage",
          kind: "boolean",
          label: { en: "Images only", es: "Solo imagenes", pt: "Apenas imagens", fr: "Images uniquement", de: "Nur Bilder" },
          description: {
            en: "Only return tweets containing images",
            es: "Solo devolver tweets que contengan imagenes",
            pt: "Retornar apenas tweets que contenham imagens",
            fr: "Retourner uniquement les tweets contenant des images",
            de: "Nur Tweets mit Bildern zuruckgeben",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: false,
        },
        {
          id: "onlyVideo",
          apifyField: "onlyVideo",
          kind: "boolean",
          label: { en: "Videos only", es: "Solo videos", pt: "Apenas videos", fr: "Videos uniquement", de: "Nur Videos" },
          description: {
            en: "Only return tweets containing videos",
            es: "Solo devolver tweets que contengan videos",
            pt: "Retornar apenas tweets que contenham videos",
            fr: "Retourner uniquement les tweets contenant des videos",
            de: "Nur Tweets mit Videos zuruckgeben",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: false,
        },
      ],
    },

    // ── 4. Engagement ──────────────────────────────────────────────────
    {
      id: "engagement",
      label: { en: "Engagement", es: "Engagement", pt: "Engajamento", fr: "Engagement", de: "Engagement" },
      params: [
        {
          id: "minimumRetweets",
          apifyField: "minimumRetweets",
          kind: "number",
          label: { en: "Min retweets", es: "Retweets minimos", pt: "Retweets minimos", fr: "Retweets minimum", de: "Min. Retweets" },
          description: {
            en: "Minimum number of retweets",
            es: "Numero minimo de retweets",
            pt: "Numero minimo de retweets",
            fr: "Nombre minimum de retweets",
            de: "Mindestanzahl an Retweets",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: undefined,
          min: 0,
        },
        {
          id: "minimumFavorites",
          apifyField: "minimumFavorites",
          kind: "number",
          label: { en: "Min likes", es: "Likes minimos", pt: "Likes minimos", fr: "Likes minimum", de: "Min. Likes" },
          description: {
            en: "Minimum number of likes",
            es: "Numero minimo de likes",
            pt: "Numero minimo de likes",
            fr: "Nombre minimum de likes",
            de: "Mindestanzahl an Likes",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: undefined,
          min: 0,
        },
        {
          id: "minimumReplies",
          apifyField: "minimumReplies",
          kind: "number",
          label: { en: "Min replies", es: "Respuestas minimas", pt: "Respostas minimas", fr: "Reponses minimum", de: "Min. Antworten" },
          description: {
            en: "Minimum number of replies",
            es: "Numero minimo de respuestas",
            pt: "Numero minimo de respostas",
            fr: "Nombre minimum de reponses",
            de: "Mindestanzahl an Antworten",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: undefined,
          min: 0,
        },
      ],
    },

    // ── 5. Geographic ──────────────────────────────────────────────────
    {
      id: "geographic",
      label: { en: "Location", es: "Ubicacion", pt: "Localizacao", fr: "Localisation", de: "Standort" },
      params: [
        {
          id: "geotaggedNear",
          apifyField: "geotaggedNear",
          kind: "text",
          label: { en: "Near location", es: "Cerca de ubicacion", pt: "Perto de localizacao", fr: "Pres de", de: "In der Nahe von" },
          description: {
            en: "Only tweets geotagged near this location",
            es: "Solo tweets geoetiquetados cerca de esta ubicacion",
            pt: "Apenas tweets geolocalizados perto desta localizacao",
            fr: "Uniquement les tweets geolocalises pres de cet endroit",
            de: "Nur Tweets mit Geotag in der Nahe dieses Standorts",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: undefined,
        },
        {
          id: "withinRadius",
          apifyField: "withinRadius",
          kind: "text",
          label: { en: "Radius", es: "Radio", pt: "Raio", fr: "Rayon", de: "Radius" },
          description: {
            en: "e.g., 15mi or 25km",
            es: "ej. 15mi o 25km",
            pt: "ex. 15mi ou 25km",
            fr: "ex. 15mi ou 25km",
            de: "z.B. 15mi oder 25km",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: undefined,
        },
      ],
    },

    // ── 6. Volume ──────────────────────────────────────────────────────
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

  // ── Cross-validation ─────────────────────────────────────────────────
  crossValidate: (config) => {
    const errors: string[] = [];

    // Warn if geotaggedNear is set but withinRadius is not
    if (config.geotaggedNear && !config.withinRadius) {
      errors.push(
        "geotaggedNear is set but withinRadius is missing — results may be unpredictable"
      );
    }

    // Error if dateRange has start > end
    const dateRange = config.dateRange as
      | { start: string; end: string }
      | undefined;
    if (dateRange?.start && dateRange?.end && dateRange.start > dateRange.end) {
      errors.push("dateRange start must be before end");
    }

    return errors;
  },

  // ── Clarifying questions ─────────────────────────────────────────────
  clarifyingQuestions: [
    {
      id: "temporal_scope",
      question: {
        en: "What time period interests you? Only recent tweets, or do you want to see how opinions evolved over time?",
        es: "Que periodo te interesa? Solo tweets recientes, o queres ver como evolucionaron las opiniones en el tiempo?",
        pt: "Qual periodo te interessa? Apenas tweets recentes, ou quer ver como as opinioes evoluiram ao longo do tempo?",
        fr: "Quelle periode vous interesse ? Uniquement les tweets recents, ou voulez-vous voir comment les opinions ont evolue dans le temps ?",
        de: "Welcher Zeitraum interessiert Sie? Nur aktuelle Tweets, oder mochten Sie sehen, wie sich Meinungen im Laufe der Zeit entwickelt haben?",
      },
      paramIds: ["dateRange"],
      triggerWhen:
        "Research involves trends, evolution, or opinion analysis on social media",
    },
    {
      id: "language_preference",
      question: {
        en: "Should I search for tweets in a specific language, or in all languages?",
        es: "Debo buscar tweets en un idioma especifico, o en todos los idiomas?",
        pt: "Devo pesquisar tweets em um idioma especifico, ou em todos os idiomas?",
        fr: "Dois-je rechercher des tweets dans une langue specifique, ou dans toutes les langues ?",
        de: "Soll ich Tweets in einer bestimmten Sprache suchen, oder in allen Sprachen?",
      },
      paramIds: ["tweetLanguage"],
      triggerWhen:
        "Research topic is tied to a specific country or culture",
    },
    {
      id: "engagement_filter",
      question: {
        en: "Do you want to focus on popular tweets (with many likes/retweets), or include everything?",
        es: "Queres enfocarte en tweets populares (con muchos likes/retweets), o incluir todo?",
        pt: "Quer focar em tweets populares (com muitos likes/retweets), ou incluir tudo?",
        fr: "Voulez-vous vous concentrer sur les tweets populaires (avec beaucoup de likes/retweets), ou tout inclure ?",
        de: "Mochten Sie sich auf beliebte Tweets konzentrieren (mit vielen Likes/Retweets), oder alles einschliessen?",
      },
      paramIds: ["minimumFavorites", "minimumRetweets"],
      triggerWhen:
        "Research is about public opinion or sentiment",
    },
  ],
};
