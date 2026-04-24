import type { ToolSchema } from "../tool-schema";

export const googleMapsReviewsSchema: ToolSchema = {
  toolId: "google-maps-reviews",
  version: 1,

  paramGroups: [
    // ── Source ───────────────────────────────────────────────────────────
    {
      id: "source",
      label: { en: "Source", es: "Fuente", pt: "Fonte", fr: "Source", de: "Quelle" },
      params: [
        {
          id: "placeUrls",
          apifyField: "startUrls",
          kind: "keyword_list",
          label: { en: "Google Maps URLs", es: "URLs de Google Maps", pt: "URLs do Google Maps", fr: "URLs Google Maps", de: "Google Maps URLs" },
          description: {
            en: "URLs of Google Maps places to extract reviews from",
            es: "URLs de lugares de Google Maps de los cuales extraer resenas",
            pt: "URLs de lugares do Google Maps para extrair avaliacoes",
            fr: "URLs de lieux Google Maps pour extraire les avis",
            de: "URLs von Google Maps-Orten zum Extrahieren von Bewertungen",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
        {
          id: "placeIds",
          apifyField: "placeIds",
          kind: "keyword_list",
          label: { en: "Place IDs", es: "IDs de lugares", pt: "IDs de lugares", fr: "IDs de lieux", de: "Orts-IDs" },
          description: {
            en: "Google Maps Place IDs as an alternative to URLs",
            es: "IDs de lugares de Google Maps como alternativa a URLs",
            pt: "IDs de lugares do Google Maps como alternativa a URLs",
            fr: "IDs de lieux Google Maps comme alternative aux URLs",
            de: "Google Maps Orts-IDs als Alternative zu URLs",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: [],
        },
      ],
    },

    // ── Filters ──────────────────────────────────────────────────────────
    {
      id: "filters",
      label: { en: "Filters", es: "Filtros", pt: "Filtros", fr: "Filtres", de: "Filter" },
      params: [
        {
          id: "reviewsSort",
          apifyField: "reviewsSort",
          kind: "enum",
          label: { en: "Sort reviews", es: "Ordenar resenas", pt: "Ordenar avaliacoes", fr: "Trier les avis", de: "Bewertungen sortieren" },
          description: {
            en: "Sort reviews",
            es: "Ordenar resenas",
            pt: "Ordenar avaliacoes",
            fr: "Trier les avis",
            de: "Bewertungen sortieren",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: "mostRelevant",
          options: [
            {
              value: "mostRelevant",
              label: { en: "Most relevant", es: "Mas relevantes", pt: "Mais relevantes", fr: "Plus pertinents", de: "Relevanteste" },
            },
            {
              value: "newest",
              label: { en: "Newest", es: "Mas recientes", pt: "Mais recentes", fr: "Plus recents", de: "Neueste" },
            },
            {
              value: "highestRanking",
              label: { en: "Highest rating", es: "Mayor puntuacion", pt: "Maior pontuacao", fr: "Meilleure note", de: "Hochste Bewertung" },
            },
            {
              value: "lowestRanking",
              label: { en: "Lowest rating", es: "Menor puntuacion", pt: "Menor pontuacao", fr: "Plus basse note", de: "Niedrigste Bewertung" },
            },
          ],
        },
        {
          id: "reviewsStartDate",
          apifyField: "reviewsStartDate",
          kind: "text",
          label: { en: "Reviews after", es: "Resenas despues de", pt: "Avaliacoes apos", fr: "Avis apres le", de: "Bewertungen nach" },
          description: {
            en: "Only reviews after this date. Use ISO format (2024-01-15) or relative (3 months)",
            es: "Solo resenas despues de esta fecha. Usa formato ISO (2024-01-15) o relativo (3 months)",
            pt: "Apenas avaliacoes apos esta data. Use formato ISO (2024-01-15) ou relativo (3 months)",
            fr: "Uniquement les avis apres cette date. Format ISO (2024-01-15) ou relatif (3 months)",
            de: "Nur Bewertungen nach diesem Datum. ISO-Format (2024-01-15) oder relativ (3 months)",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: undefined,
        },
        {
          id: "language",
          apifyField: "language",
          kind: "enum",
          label: { en: "Language", es: "Idioma", pt: "Idioma", fr: "Langue", de: "Sprache" },
          description: {
            en: "Language",
            es: "Idioma",
            pt: "Idioma",
            fr: "Langue",
            de: "Sprache",
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
          id: "reviewsOrigin",
          apifyField: "reviewsOrigin",
          kind: "enum",
          label: { en: "Review source", es: "Origen de resenas", pt: "Origem das avaliacoes", fr: "Source des avis", de: "Bewertungsquelle" },
          description: {
            en: "Review source",
            es: "Origen de resenas",
            pt: "Origem das avaliacoes",
            fr: "Source des avis",
            de: "Bewertungsquelle",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: "all",
          options: [
            {
              value: "all",
              label: { en: "All sources", es: "Todas las fuentes", pt: "Todas as fontes", fr: "Toutes les sources", de: "Alle Quellen" },
            },
            {
              value: "google",
              label: { en: "Google only", es: "Solo Google", pt: "Apenas Google", fr: "Google uniquement", de: "Nur Google" },
            },
          ],
        },
      ],
    },

    // ── Volume ────────────────────────────────────────────────────────────
    {
      id: "volume",
      label: { en: "Volume", es: "Volumen", pt: "Volume", fr: "Volume", de: "Volumen" },
      params: [
        {
          id: "maxReviews",
          apifyField: "maxReviews",
          kind: "number",
          label: { en: "Max reviews", es: "Maximo de resenas", pt: "Maximo de avaliacoes", fr: "Avis maximum", de: "Max. Bewertungen" },
          description: {
            en: "Max reviews",
            es: "Maximo de resenas",
            pt: "Maximo de avaliacoes",
            fr: "Avis maximum",
            de: "Max. Bewertungen",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: 100,
          min: 1,
          max: 5000,
        },
      ],
    },

    // ── Privacy ───────────────────────────────────────────────────────────
    {
      id: "privacy",
      label: { en: "Privacy", es: "Privacidad", pt: "Privacidade", fr: "Confidentialite", de: "Datenschutz" },
      params: [
        {
          id: "personalData",
          apifyField: "personalData",
          kind: "boolean",
          label: {
            en: "Include reviewer data",
            es: "Incluir datos del resenador",
            pt: "Incluir dados do avaliador",
            fr: "Inclure les donnees de l'evaluateur",
            de: "Bewerterdaten einschliessen",
          },
          description: {
            en: "Include reviewer name, URL, and photo",
            es: "Incluir nombre, URL y foto del resenador",
            pt: "Incluir nome, URL e foto do avaliador",
            fr: "Inclure le nom, l'URL et la photo de l'evaluateur",
            de: "Name, URL und Foto des Bewerters einschliessen",
          },
          importance: "low",
          advanced: true,
          required: false,
          defaultValue: false,
        },
      ],
    },
  ],

  crossValidate(config) {
    const placeUrls = config.placeUrls as unknown[] | undefined;
    const placeIds = config.placeIds as unknown[] | undefined;

    const hasUrls = Array.isArray(placeUrls) && placeUrls.length > 0;
    const hasIds = Array.isArray(placeIds) && placeIds.length > 0;

    if (!hasUrls && !hasIds) {
      return ["At least one place URL or Place ID is required"];
    }

    return [];
  },

  clarifyingQuestions: [
    {
      id: "review_date_range",
      question: {
        en: "Do you want all reviews, or only recent ones from a specific period?",
        es: "Queres todas las resenas, o solo las recientes de un periodo especifico?",
        pt: "Quer todas as avaliacoes, ou apenas as recentes de um periodo especifico?",
        fr: "Voulez-vous tous les avis, ou uniquement les recents d'une periode specifique ?",
        de: "Mochten Sie alle Bewertungen, oder nur aktuelle aus einem bestimmten Zeitraum?",
      },
      paramIds: ["reviewsStartDate"],
      triggerWhen:
        "Research involves reputation analysis or recent feedback",
    },
    {
      id: "review_sort",
      question: {
        en: "How should I sort the reviews? By relevance, date, or rating?",
        es: "Como ordeno las resenas? Por relevancia, fecha o puntuacion?",
        pt: "Como devo ordenar as avaliacoes? Por relevancia, data ou pontuacao?",
        fr: "Comment dois-je trier les avis ? Par pertinence, date ou note ?",
        de: "Wie soll ich die Bewertungen sortieren? Nach Relevanz, Datum oder Bewertung?",
      },
      paramIds: ["reviewsSort"],
      triggerWhen: "Research cares about review quality or recency",
    },
  ],
};
