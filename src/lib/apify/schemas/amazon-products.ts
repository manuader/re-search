import type { ToolSchema } from "../tool-schema";

export const amazonProductsSchema: ToolSchema = {
  toolId: "amazon-products",
  version: 1,

  paramGroups: [
    // ── 1. Search ──────────────────────────────────────────────────────
    {
      id: "search",
      label: { en: "Search", es: "Busqueda", pt: "Pesquisa", fr: "Recherche", de: "Suche" },
      params: [
        {
          id: "keyword",
          apifyField: "keyword",
          kind: "text",
          label: { en: "Product keyword", es: "Palabra clave de producto", pt: "Palavra-chave do produto", fr: "Mot-cle du produit", de: "Produkt-Suchbegriff" },
          description: {
            en: "Product search keyword",
            es: "Palabra clave de producto",
            pt: "Palavra-chave de pesquisa de produto",
            fr: "Mot-cle de recherche de produit",
            de: "Produkt-Suchbegriff",
          },
          importance: "critical",
          advanced: false,
          required: true,
          defaultValue: "",
        },
      ],
    },

    // ── 2. Locale ──────────────────────────────────────────────────────
    {
      id: "locale",
      label: { en: "Marketplace", es: "Marketplace", pt: "Marketplace", fr: "Marketplace", de: "Marktplatz" },
      params: [
        {
          id: "country",
          apifyField: "country",
          kind: "enum",
          label: { en: "Country", es: "Pais", pt: "Pais", fr: "Pays", de: "Land" },
          description: {
            en: "Amazon marketplace to search",
            es: "Marketplace de Amazon donde buscar",
            pt: "Marketplace da Amazon para pesquisar",
            fr: "Marketplace Amazon a rechercher",
            de: "Amazon-Marktplatz fur die Suche",
          },
          importance: "high",
          advanced: false,
          required: false,
          defaultValue: "US",
          options: [
            { value: "US", label: { en: "United States", es: "Estados Unidos", pt: "Estados Unidos", fr: "Etats-Unis", de: "Vereinigte Staaten" } },
            { value: "ES", label: { en: "Spain", es: "Espana", pt: "Espanha", fr: "Espagne", de: "Spanien" } },
            { value: "UK", label: { en: "United Kingdom", es: "Reino Unido", pt: "Reino Unido", fr: "Royaume-Uni", de: "Vereinigtes Konigreich" } },
            { value: "DE", label: { en: "Germany", es: "Alemania", pt: "Alemanha", fr: "Allemagne", de: "Deutschland" } },
            { value: "FR", label: { en: "France", es: "Francia", pt: "Franca", fr: "France", de: "Frankreich" } },
            { value: "IT", label: { en: "Italy", es: "Italia", pt: "Italia", fr: "Italie", de: "Italien" } },
            { value: "JP", label: { en: "Japan", es: "Japon", pt: "Japao", fr: "Japon", de: "Japan" } },
            { value: "BR", label: { en: "Brazil", es: "Brasil", pt: "Brasil", fr: "Bresil", de: "Brasilien" } },
            { value: "MX", label: { en: "Mexico", es: "Mexico", pt: "Mexico", fr: "Mexique", de: "Mexiko" } },
            { value: "CA", label: { en: "Canada", es: "Canada", pt: "Canada", fr: "Canada", de: "Kanada" } },
            { value: "AU", label: { en: "Australia", es: "Australia", pt: "Australia", fr: "Australie", de: "Australien" } },
            { value: "IN", label: { en: "India", es: "India", pt: "India", fr: "Inde", de: "Indien" } },
          ],
        },
      ],
    },

    // ── 3. Content ─────────────────────────────────────────────────────
    {
      id: "content",
      label: { en: "Content", es: "Contenido", pt: "Conteudo", fr: "Contenu", de: "Inhalt" },
      params: [
        {
          id: "includeDescription",
          apifyField: "includeDescription",
          kind: "boolean",
          label: { en: "Include descriptions", es: "Incluir descripciones", pt: "Incluir descricoes", fr: "Inclure les descriptions", de: "Beschreibungen einschliessen" },
          description: {
            en: "Include full product descriptions",
            es: "Incluir descripciones completas",
            pt: "Incluir descricoes completas dos produtos",
            fr: "Inclure les descriptions completes des produits",
            de: "Vollstandige Produktbeschreibungen einschliessen",
          },
          importance: "medium",
          advanced: false,
          required: false,
          defaultValue: true,
        },
      ],
    },

    // ── 4. Volume ──────────────────────────────────────────────────────
    {
      id: "volume",
      label: { en: "Volume", es: "Volumen", pt: "Volume", fr: "Volume", de: "Volumen" },
      params: [
        {
          id: "maxItems",
          apifyField: "maxItems",
          kind: "number",
          label: { en: "Max products", es: "Maximo de productos", pt: "Maximo de produtos", fr: "Produits maximum", de: "Max. Produkte" },
          description: {
            en: "Maximum number of products to return",
            es: "Numero maximo de productos a devolver",
            pt: "Numero maximo de produtos a retornar",
            fr: "Nombre maximum de produits a retourner",
            de: "Maximale Anzahl zuruckzugebender Produkte",
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

  // ── Clarifying questions ─────────────────────────────────────────────
  clarifyingQuestions: [
    {
      id: "marketplace",
      question: {
        en: "Which Amazon marketplace?",
        es: "Que marketplace de Amazon?",
        pt: "Qual marketplace da Amazon?",
        fr: "Quel marketplace Amazon ?",
        de: "Welcher Amazon-Marktplatz?",
      },
      paramIds: ["country"],
      triggerWhen:
        "Research involves Amazon product data and country is not specified",
    },
  ],
};
