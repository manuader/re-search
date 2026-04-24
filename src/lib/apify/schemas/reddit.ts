import type { ToolSchema } from "../tool-schema";

export const redditSchema: ToolSchema = {
  toolId: "reddit",
  version: 1,

  paramGroups: [
    // ── Search ─────────────────────────────────────────────────────────
    {
      id: "search",
      label: { en: "Search", es: "Busqueda", pt: "Pesquisa", fr: "Recherche", de: "Suche" },
      params: [
        {
          id: "searches",
          apifyField: "searches",
          kind: "keyword_list",
          label: { en: "Search terms", es: "Terminos de busqueda", pt: "Termos de pesquisa", fr: "Termes de recherche", de: "Suchbegriffe" },
          description: {
            en: "Keywords to search for on Reddit",
            es: "Palabras clave a buscar en Reddit",
            pt: "Palavras-chave para pesquisar no Reddit",
            fr: "Mots-cles a rechercher sur Reddit",
            de: "Schlusselworter zur Suche auf Reddit",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
        {
          id: "searchCommunityName",
          apifyField: "searchCommunityName",
          kind: "text",
          label: { en: "Subreddit", es: "Subreddit", pt: "Subreddit", fr: "Subreddit", de: "Subreddit" },
          description: {
            en: "Limit search to a specific subreddit (e.g., 'technology')",
            es: "Limitar busqueda a un subreddit especifico (ej. 'technology')",
            pt: "Limitar pesquisa a um subreddit especifico (ex. 'technology')",
            fr: "Limiter la recherche a un subreddit specifique (ex. 'technology')",
            de: "Suche auf ein bestimmtes Subreddit beschranken (z.B. 'technology')",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: undefined,
        },
      ],
    },

    // ── Content Type ───────────────────────────────────────────────────
    {
      id: "content",
      label: { en: "Content Type", es: "Tipo de contenido", pt: "Tipo de conteudo", fr: "Type de contenu", de: "Inhaltstyp" },
      params: [
        {
          id: "searchPosts",
          apifyField: "searchPosts",
          kind: "boolean",
          label: { en: "Include posts", es: "Incluir publicaciones", pt: "Incluir publicacoes", fr: "Inclure les publications", de: "Beitrage einschliessen" },
          description: {
            en: "Include posts in search results",
            es: "Incluir publicaciones en los resultados",
            pt: "Incluir publicacoes nos resultados",
            fr: "Inclure les publications dans les resultats",
            de: "Beitrage in den Ergebnissen einschliessen",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: true,
        },
        {
          id: "searchComments",
          apifyField: "searchComments",
          kind: "boolean",
          label: { en: "Include comments", es: "Incluir comentarios", pt: "Incluir comentarios", fr: "Inclure les commentaires", de: "Kommentare einschliessen" },
          description: {
            en: "Include comments in search results",
            es: "Incluir comentarios en los resultados",
            pt: "Incluir comentarios nos resultados",
            fr: "Inclure les commentaires dans les resultats",
            de: "Kommentare in den Ergebnissen einschliessen",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: false,
        },
      ],
    },

    // ── Time Period ────────────────────────────────────────────────────
    {
      id: "temporal",
      label: { en: "Time Period", es: "Periodo temporal", pt: "Periodo temporal", fr: "Periode", de: "Zeitraum" },
      params: [
        {
          id: "sort",
          apifyField: "sort",
          kind: "enum",
          label: { en: "Sort by", es: "Ordenar por", pt: "Ordenar por", fr: "Trier par", de: "Sortieren nach" },
          description: {
            en: "How to sort search results",
            es: "Como ordenar los resultados de busqueda",
            pt: "Como ordenar os resultados de pesquisa",
            fr: "Comment trier les resultats de recherche",
            de: "Wie die Suchergebnisse sortiert werden",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: "hot",
          options: [
            { value: "hot", label: { en: "Hot", es: "Populares", pt: "Populares", fr: "Populaires", de: "Beliebt" } },
            { value: "new", label: { en: "New", es: "Nuevos", pt: "Novos", fr: "Nouveaux", de: "Neu" } },
            { value: "top", label: { en: "Top", es: "Mejores", pt: "Melhores", fr: "Meilleurs", de: "Beste" } },
            { value: "rising", label: { en: "Rising", es: "En ascenso", pt: "Em ascensao", fr: "En hausse", de: "Aufsteigend" } },
          ],
        },
        {
          id: "time",
          apifyField: "time",
          kind: "enum",
          label: { en: "Time filter", es: "Filtro temporal", pt: "Filtro temporal", fr: "Filtre temporel", de: "Zeitfilter" },
          description: {
            en: "Time period for top posts (only when sorting by Top)",
            es: "Periodo de tiempo para mejores posts (solo al ordenar por Mejores)",
            pt: "Periodo de tempo para melhores posts (apenas ao ordenar por Melhores)",
            fr: "Periode pour les meilleurs posts (uniquement lors du tri par Meilleurs)",
            de: "Zeitraum fur beste Beitrage (nur bei Sortierung nach Beste)",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: undefined,
          options: [
            { value: "hour", label: { en: "Past hour", es: "Ultima hora", pt: "Ultima hora", fr: "Derniere heure", de: "Letzte Stunde" } },
            { value: "day", label: { en: "Past 24 hours", es: "Ultimas 24 horas", pt: "Ultimas 24 horas", fr: "Dernieres 24 heures", de: "Letzte 24 Stunden" } },
            { value: "week", label: { en: "Past week", es: "Ultima semana", pt: "Ultima semana", fr: "Derniere semaine", de: "Letzte Woche" } },
            { value: "month", label: { en: "Past month", es: "Ultimo mes", pt: "Ultimo mes", fr: "Dernier mois", de: "Letzter Monat" } },
            { value: "year", label: { en: "Past year", es: "Ultimo ano", pt: "Ultimo ano", fr: "Derniere annee", de: "Letztes Jahr" } },
            { value: "all", label: { en: "All time", es: "Todo el tiempo", pt: "Todo o tempo", fr: "Depuis toujours", de: "Gesamter Zeitraum" } },
          ],
          dependsOn: { paramId: "sort", values: ["top"] },
        },
        {
          id: "postDateLimit",
          apifyField: "postDateLimit",
          kind: "text",
          label: { en: "Posts after", es: "Posts despues de", pt: "Posts apos", fr: "Posts apres le", de: "Posts nach" },
          description: {
            en: "Only posts after this date (ISO format)",
            es: "Solo posts despues de esta fecha (formato ISO)",
            pt: "Apenas posts apos esta data (formato ISO)",
            fr: "Uniquement les posts apres cette date (format ISO)",
            de: "Nur Beitrage nach diesem Datum (ISO-Format)",
          },
          importance: "high",
          advanced: false,
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
          id: "maxItems",
          apifyField: "maxItems",
          kind: "number",
          label: { en: "Max posts", es: "Maximo de publicaciones", pt: "Maximo de publicacoes", fr: "Publications maximum", de: "Max. Beitrage" },
          description: {
            en: "Maximum number of posts to return",
            es: "Numero maximo de publicaciones a devolver",
            pt: "Numero maximo de publicacoes a retornar",
            fr: "Nombre maximum de publications a retourner",
            de: "Maximale Anzahl zuruckzugebender Beitrage",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: 100,
          min: 1,
          max: 5000,
        },
        {
          id: "maxComments",
          apifyField: "maxComments",
          kind: "number",
          label: { en: "Comments per post", es: "Comentarios por publicacion", pt: "Comentarios por publicacao", fr: "Commentaires par publication", de: "Kommentare pro Beitrag" },
          description: {
            en: "Maximum comments to collect per post",
            es: "Maximo de comentarios a recopilar por publicacion",
            pt: "Maximo de comentarios a coletar por publicacao",
            fr: "Maximum de commentaires a collecter par publication",
            de: "Maximale Kommentare pro Beitrag",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: 10,
          min: 0,
          max: 500,
        },
      ],
    },

    // ── Advanced ───────────────────────────────────────────────────────
    {
      id: "advanced",
      label: { en: "Advanced", es: "Avanzado", pt: "Avancado", fr: "Avance", de: "Erweitert" },
      params: [
        {
          id: "includeNSFW",
          apifyField: "includeNSFW",
          kind: "boolean",
          label: { en: "Include NSFW", es: "Incluir NSFW", pt: "Incluir NSFW", fr: "Inclure NSFW", de: "NSFW einschliessen" },
          description: {
            en: "Include not-safe-for-work content",
            es: "Incluir contenido no apto para el trabajo",
            pt: "Incluir conteudo inapropriado para o trabalho",
            fr: "Inclure le contenu inapproprie",
            de: "Nicht jugendfreie Inhalte einschliessen",
          },
          importance: "low",
          advanced: true,
          required: false,
          defaultValue: false,
        },
        {
          id: "skipComments",
          apifyField: "skipComments",
          kind: "boolean",
          label: { en: "Skip comments", es: "Omitir comentarios", pt: "Pular comentarios", fr: "Ignorer les commentaires", de: "Kommentare uberspringen" },
          description: {
            en: "Don't extract comments (faster)",
            es: "No extraer comentarios (mas rapido)",
            pt: "Nao extrair comentarios (mais rapido)",
            fr: "Ne pas extraire les commentaires (plus rapide)",
            de: "Kommentare nicht extrahieren (schneller)",
          },
          importance: "low",
          advanced: true,
          required: false,
          defaultValue: false,
        },
      ],
    },
  ],

  crossValidate: (config: Record<string, unknown>): string[] => {
    const warnings: string[] = [];

    if (config.skipComments === true && config.searchComments === true) {
      warnings.push(
        "skipComments is enabled but searchComments is also enabled — comments will be skipped"
      );
    }

    if (config.time !== undefined && config.sort !== "top") {
      warnings.push("Time filter only works when sorting by 'Top'");
    }

    return warnings;
  },

  clarifyingQuestions: [
    {
      id: "subreddit_scope",
      question: {
        en: "Should I search across all of Reddit, or focus on a specific subreddit?",
        es: "Busco en todo Reddit, o me enfoco en un subreddit especifico?",
        pt: "Devo pesquisar em todo o Reddit, ou focar em um subreddit especifico?",
        fr: "Dois-je rechercher dans tout Reddit, ou me concentrer sur un subreddit specifique ?",
        de: "Soll ich in ganz Reddit suchen, oder mich auf ein bestimmtes Subreddit konzentrieren?",
      },
      paramIds: ["searchCommunityName"],
      triggerWhen:
        "Research could benefit from community-specific context",
    },
    {
      id: "reddit_time_period",
      question: {
        en: "What time period should I cover? Recent posts, or a broader range?",
        es: "Que periodo de tiempo cubro? Posts recientes, o un rango mas amplio?",
        pt: "Qual periodo de tempo devo cobrir? Posts recentes, ou um intervalo mais amplo?",
        fr: "Quelle periode dois-je couvrir ? Posts recents, ou une plage plus large ?",
        de: "Welchen Zeitraum soll ich abdecken? Aktuelle Beitrage, oder einen breiteren Bereich?",
      },
      paramIds: ["postDateLimit", "sort", "time"],
      triggerWhen:
        "Research involves trends or historical analysis",
    },
  ],
};
