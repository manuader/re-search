import type { ToolSchema } from "../tool-schema";

export const tripadvisorSchema: ToolSchema = {
  toolId: "tripadvisor",
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
          label: { en: "TripAdvisor URLs", es: "URLs de TripAdvisor", pt: "URLs do TripAdvisor", fr: "URLs TripAdvisor", de: "TripAdvisor-URLs" },
          description: {
            en: "TripAdvisor listing URLs",
            es: "URLs de listados de TripAdvisor",
            pt: "URLs de listagens do TripAdvisor",
            fr: "URLs d'annonces TripAdvisor",
            de: "TripAdvisor-Eintrags-URLs",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: [],
        },
        {
          id: "query",
          apifyField: "query",
          kind: "text",
          label: { en: "Search query", es: "Busqueda", pt: "Pesquisa", fr: "Recherche", de: "Suchanfrage" },
          description: {
            en: "Search for a location or business",
            es: "Buscar ubicacion o negocio",
            pt: "Pesquisar localizacao ou negocio",
            fr: "Rechercher un lieu ou une entreprise",
            de: "Nach Standort oder Unternehmen suchen",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: undefined,
        },
      ],
    },

    // ── 2. Content ─────────────────────────────────────────────────────
    {
      id: "content",
      label: { en: "Content", es: "Contenido", pt: "Conteudo", fr: "Contenu", de: "Inhalt" },
      params: [
        {
          id: "includeAttractions",
          apifyField: "includeAttractions",
          kind: "boolean",
          label: { en: "Include attractions", es: "Incluir atracciones", pt: "Incluir atracoes", fr: "Inclure les attractions", de: "Attraktionen einschliessen" },
          description: {
            en: "Include attractions in results",
            es: "Incluir atracciones en los resultados",
            pt: "Incluir atracoes nos resultados",
            fr: "Inclure les attractions dans les resultats",
            de: "Attraktionen in die Ergebnisse einschliessen",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: true,
        },
        {
          id: "includeRestaurants",
          apifyField: "includeRestaurants",
          kind: "boolean",
          label: { en: "Include restaurants", es: "Incluir restaurantes", pt: "Incluir restaurantes", fr: "Inclure les restaurants", de: "Restaurants einschliessen" },
          description: {
            en: "Include restaurants in results",
            es: "Incluir restaurantes en los resultados",
            pt: "Incluir restaurantes nos resultados",
            fr: "Inclure les restaurants dans les resultats",
            de: "Restaurants in die Ergebnisse einschliessen",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: true,
        },
        {
          id: "includeHotels",
          apifyField: "includeHotels",
          kind: "boolean",
          label: { en: "Include hotels", es: "Incluir hoteles", pt: "Incluir hoteis", fr: "Inclure les hotels", de: "Hotels einschliessen" },
          description: {
            en: "Include hotels in results",
            es: "Incluir hoteles en los resultados",
            pt: "Incluir hoteis nos resultados",
            fr: "Inclure les hotels dans les resultats",
            de: "Hotels in die Ergebnisse einschliessen",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: true,
        },
        {
          id: "includeTags",
          apifyField: "includeTags",
          kind: "boolean",
          label: { en: "Include tags", es: "Incluir etiquetas", pt: "Incluir tags", fr: "Inclure les tags", de: "Tags einschliessen" },
          description: {
            en: "Extract review tags",
            es: "Extraer etiquetas de resenas",
            pt: "Extrair tags de avaliacoes",
            fr: "Extraire les tags des avis",
            de: "Bewertungs-Tags extrahieren",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: true,
        },
      ],
    },

    // ── 3. Locale ──────────────────────────────────────────────────────
    {
      id: "locale",
      label: { en: "Locale", es: "Idioma y moneda", pt: "Idioma e moeda", fr: "Langue et devise", de: "Sprache und Wahrung" },
      params: [
        {
          id: "language",
          apifyField: "language",
          kind: "enum",
          label: { en: "Language", es: "Idioma", pt: "Idioma", fr: "Langue", de: "Sprache" },
          description: {
            en: "Language for results",
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
          id: "currency",
          apifyField: "currency",
          kind: "enum",
          label: { en: "Currency", es: "Moneda", pt: "Moeda", fr: "Devise", de: "Wahrung" },
          description: {
            en: "Currency for prices",
            es: "Moneda para precios",
            pt: "Moeda para precos",
            fr: "Devise pour les prix",
            de: "Wahrung fur Preise",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: "USD",
          options: [
            { value: "USD", label: { en: "US Dollar", es: "Dolar estadounidense", pt: "Dolar americano", fr: "Dollar americain", de: "US-Dollar" } },
            { value: "EUR", label: { en: "Euro", es: "Euro", pt: "Euro", fr: "Euro", de: "Euro" } },
            { value: "GBP", label: { en: "British Pound", es: "Libra esterlina", pt: "Libra esterlina", fr: "Livre sterling", de: "Britisches Pfund" } },
            { value: "ARS", label: { en: "Argentine Peso", es: "Peso argentino", pt: "Peso argentino", fr: "Peso argentin", de: "Argentinischer Peso" } },
            { value: "BRL", label: { en: "Brazilian Real", es: "Real brasileno", pt: "Real brasileiro", fr: "Real bresilien", de: "Brasilianischer Real" } },
            { value: "MXN", label: { en: "Mexican Peso", es: "Peso mexicano", pt: "Peso mexicano", fr: "Peso mexicain", de: "Mexikanischer Peso" } },
            { value: "JPY", label: { en: "Japanese Yen", es: "Yen japones", pt: "Iene japones", fr: "Yen japonais", de: "Japanischer Yen" } },
          ],
        },
      ],
    },

    // ── 4. Dates ───────────────────────────────────────────────────────
    {
      id: "dates",
      label: { en: "Dates", es: "Fechas", pt: "Datas", fr: "Dates", de: "Daten" },
      params: [
        {
          id: "checkInDate",
          apifyField: "checkInDate",
          kind: "text",
          label: { en: "Check-in date", es: "Fecha de check-in", pt: "Data de check-in", fr: "Date d'arrivee", de: "Check-in-Datum" },
          description: {
            en: "Hotel check-in date YYYY-MM-DD",
            es: "Fecha check-in hotel",
            pt: "Data de check-in do hotel AAAA-MM-DD",
            fr: "Date d'arrivee a l'hotel AAAA-MM-JJ",
            de: "Hotel Check-in-Datum JJJJ-MM-TT",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: undefined,
        },
        {
          id: "checkOutDate",
          apifyField: "checkOutDate",
          kind: "text",
          label: { en: "Check-out date", es: "Fecha de check-out", pt: "Data de check-out", fr: "Date de depart", de: "Check-out-Datum" },
          description: {
            en: "Hotel check-out date YYYY-MM-DD",
            es: "Fecha check-out hotel",
            pt: "Data de check-out do hotel AAAA-MM-DD",
            fr: "Date de depart de l'hotel AAAA-MM-JJ",
            de: "Hotel Check-out-Datum JJJJ-MM-TT",
          },
          importance: "medium",
          advanced: true,
          required: false,
          defaultValue: undefined,
        },
      ],
    },

    // ── 5. Volume ──────────────────────────────────────────────────────
    {
      id: "volume",
      label: { en: "Volume", es: "Volumen", pt: "Volume", fr: "Volume", de: "Volumen" },
      params: [
        {
          id: "maxItems",
          apifyField: "maxItems",
          kind: "number",
          label: { en: "Max items", es: "Maximo de resultados", pt: "Maximo de resultados", fr: "Resultats maximum", de: "Max. Ergebnisse" },
          description: {
            en: "Maximum number of items to return",
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
          max: 2000,
        },
      ],
    },
  ],

  // ── Cross-validation ─────────────────────────────────────────────────
  crossValidate: (config) => {
    const errors: string[] = [];

    const checkIn = config.checkInDate as string | undefined;
    const checkOut = config.checkOutDate as string | undefined;

    if (checkIn && checkOut && checkOut < checkIn) {
      errors.push("checkOutDate must be after checkInDate");
    }

    return errors;
  },

  // ── Clarifying questions ─────────────────────────────────────────────
  clarifyingQuestions: [
    {
      id: "language_preference",
      question: {
        en: "What language should the results be in?",
        es: "En que idioma queres los resultados?",
        pt: "Em qual idioma voce quer os resultados?",
        fr: "Dans quelle langue souhaitez-vous les resultats ?",
        de: "In welcher Sprache sollen die Ergebnisse sein?",
      },
      paramIds: ["language"],
      triggerWhen:
        "Research involves TripAdvisor data for a non-English-speaking region",
    },
  ],
};
