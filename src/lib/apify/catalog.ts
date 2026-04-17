import type {
  ToolCatalogEntry,
  Locale,
  ToolSearchResult,
  ToolConfigResult,
  CostEstimate,
} from "@/types";

export const toolCatalog: ToolCatalogEntry[] = [
  // ─── 1. Google Maps ───────────────────────────────────────────────────
  {
    id: "google-maps",
    actorId: "compass/crawler-google-places",
    name: {
      en: "Google Maps Places",
      es: "Lugares de Google Maps",
    },
    description: {
      en: "Search and extract business listings from Google Maps including name, address, phone, website, ratings, and opening hours.",
      es: "Busca y extrae listados de negocios de Google Maps incluyendo nombre, dirección, teléfono, sitio web, calificaciones y horarios.",
    },
    category: "maps",
    useCases: [
      "find restaurants near a location",
      "extract business listings for a city",
      "get phone numbers and addresses of local businesses",
      "research competitors in a geographic area",
      "build a directory of shops or services",
    ],
    inputSchema: {
      fields: [
        {
          key: "searchStringsArray",
          type: "string[]",
          label: {
            en: "Search queries",
            es: "Consultas de búsqueda",
          },
          description: {
            en: "List of search terms (e.g., 'restaurants in Madrid')",
            es: "Lista de términos de búsqueda (ej. 'restaurantes en Madrid')",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxCrawledPlacesPerSearch",
          type: "number",
          label: {
            en: "Max results per search",
            es: "Máximo de resultados por búsqueda",
          },
          description: {
            en: "Maximum number of places to return per search query",
            es: "Número máximo de lugares a devolver por consulta",
          },
          required: false,
          default: 100,
          userFacing: true,
          min: 1,
          max: 500,
        },
        {
          key: "language",
          type: "string",
          label: { en: "Language", es: "Idioma" },
          description: {
            en: "Language code for results (e.g., 'en', 'es')",
            es: "Código de idioma para resultados (ej. 'en', 'es')",
          },
          required: false,
          default: "en",
          userFacing: false,
        },
        {
          key: "deeperCityScrape",
          type: "boolean",
          label: { en: "Deep city scrape", es: "Raspado profundo de ciudad" },
          description: {
            en: "Enable deeper scraping to find more places in dense areas",
            es: "Habilitar raspado profundo para encontrar más lugares en áreas densas",
          },
          required: false,
          default: false,
          userFacing: false,
        },
      ],
      defaults: {
        searchStringsArray: [],
        maxCrawledPlacesPerSearch: 100,
        language: "en",
        deeperCityScrape: false,
      },
    },
    outputFields: [
      "title",
      "address",
      "phone",
      "website",
      "totalScore",
      "reviewsCount",
      "categoryName",
      "openingHours",
      "placeId",
      "url",
      "location",
    ],
    pricing: {
      model: "per-result",
      costPer1000: { min: 2.5, max: 5.0 },
    },
    healthCheck: {
      input: {
        searchStringsArray: ["coffee shop in New York"],
        maxCrawledPlacesPerSearch: 3,
      },
      expectedMinResults: 2,
      maxDurationSeconds: 120,
    },
    validation: {
      requiredFields: ["searchStringsArray"],
      uniqueKey: "placeId",
    },
    pairsWellWith: ["google-maps-reviews", "contact-extractor"],
    maintainer: "compass",
  },

  // ─── 2. Google Maps Reviews ───────────────────────────────────────────
  {
    id: "google-maps-reviews",
    actorId: "compass/google-maps-reviews",
    name: {
      en: "Google Maps Reviews",
      es: "Reseñas de Google Maps",
    },
    description: {
      en: "Extract customer reviews and ratings from Google Maps business listings with review text, author, date, and star rating.",
      es: "Extrae reseñas y calificaciones de clientes de listados de negocios en Google Maps con texto, autor, fecha y puntuación.",
    },
    category: "maps",
    useCases: [
      "analyze customer sentiment for a business",
      "collect reviews for competitor analysis",
      "monitor reputation of a restaurant or hotel",
      "extract star ratings and review text from Google Maps",
    ],
    inputSchema: {
      fields: [
        {
          key: "placeUrls",
          type: "string[]",
          label: {
            en: "Google Maps place URLs",
            es: "URLs de lugares en Google Maps",
          },
          description: {
            en: "URLs of Google Maps places to extract reviews from",
            es: "URLs de lugares de Google Maps de los cuales extraer reseñas",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxReviews",
          type: "number",
          label: { en: "Max reviews", es: "Máximo de reseñas" },
          description: {
            en: "Maximum number of reviews to extract per place",
            es: "Número máximo de reseñas a extraer por lugar",
          },
          required: false,
          default: 100,
          userFacing: true,
          min: 1,
          max: 5000,
        },
        {
          key: "language",
          type: "string",
          label: { en: "Language", es: "Idioma" },
          description: {
            en: "Filter reviews by language code",
            es: "Filtrar reseñas por código de idioma",
          },
          required: false,
          default: "en",
          userFacing: false,
        },
        {
          key: "sort",
          type: "string",
          label: { en: "Sort order", es: "Orden" },
          description: {
            en: "Sort reviews by: newest, mostRelevant, highestRating, lowestRating",
            es: "Ordenar reseñas por: más recientes, más relevantes, mayor puntuación, menor puntuación",
          },
          required: false,
          default: "mostRelevant",
          userFacing: false,
        },
      ],
      defaults: {
        placeUrls: [],
        maxReviews: 100,
        language: "en",
        sort: "mostRelevant",
      },
    },
    outputFields: [
      "reviewText",
      "stars",
      "publishedAtDate",
      "authorName",
      "reviewUrl",
      "reviewId",
      "responseFromOwner",
    ],
    pricing: {
      model: "per-result",
      costPer1000: { min: 1.5, max: 3.5 },
    },
    healthCheck: {
      input: {
        placeUrls: [
          "https://www.google.com/maps/place/Statue+of+Liberty/@40.6892494,-74.0445004",
        ],
        maxReviews: 3,
      },
      expectedMinResults: 2,
      maxDurationSeconds: 90,
    },
    validation: {
      requiredFields: ["placeUrls"],
      uniqueKey: "reviewId",
    },
    pairsWellWith: ["google-maps"],
    maintainer: "compass",
  },

  // ─── 3. Twitter / X Search ────────────────────────────────────────────
  {
    id: "twitter",
    actorId: "apidojo/tweet-scraper",
    name: {
      en: "Twitter / X Search",
      es: "Búsqueda en Twitter / X",
    },
    description: {
      en: "Search Twitter/X for tweets matching keywords, hashtags, or from specific users. Returns tweet text, metrics, and author info.",
      es: "Busca en Twitter/X tweets que coincidan con palabras clave, hashtags o de usuarios específicos. Devuelve texto, métricas e info del autor.",
    },
    category: "social",
    useCases: [
      "monitor brand mentions on Twitter",
      "track hashtag trends and conversations",
      "find tweets about a specific topic or event",
      "gather public opinion on a product launch",
    ],
    inputSchema: {
      fields: [
        {
          key: "searchTerms",
          type: "string[]",
          label: { en: "Search terms", es: "Términos de búsqueda" },
          description: {
            en: "Keywords or hashtags to search for on Twitter",
            es: "Palabras clave o hashtags a buscar en Twitter",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxItems",
          type: "number",
          label: { en: "Max tweets", es: "Máximo de tweets" },
          description: {
            en: "Maximum number of tweets to return",
            es: "Número máximo de tweets a devolver",
          },
          required: false,
          default: 100,
          userFacing: true,
          min: 1,
          max: 10000,
        },
        {
          key: "sort",
          type: "string",
          label: { en: "Sort order", es: "Orden" },
          description: {
            en: "Sort by: Latest or Top",
            es: "Ordenar por: Más recientes o Principales",
          },
          required: false,
          default: "Latest",
          userFacing: false,
        },
        {
          key: "onlyVerifiedUsers",
          type: "boolean",
          label: {
            en: "Verified users only",
            es: "Solo usuarios verificados",
          },
          description: {
            en: "Only return tweets from verified users",
            es: "Solo devolver tweets de usuarios verificados",
          },
          required: false,
          default: false,
          userFacing: false,
        },
      ],
      defaults: {
        searchTerms: [],
        maxItems: 100,
        sort: "Latest",
        onlyVerifiedUsers: false,
      },
    },
    outputFields: [
      "text",
      "retweetCount",
      "likeCount",
      "replyCount",
      "authorName",
      "authorUsername",
      "createdAt",
      "tweetId",
      "url",
    ],
    pricing: {
      model: "per-result",
      costPer1000: { min: 1.0, max: 3.0 },
    },
    healthCheck: {
      input: { searchTerms: ["test"], maxItems: 3 },
      expectedMinResults: 2,
      maxDurationSeconds: 60,
    },
    validation: {
      requiredFields: ["searchTerms"],
      uniqueKey: "tweetId",
    },
    pairsWellWith: ["reddit", "google-search"],
    maintainer: "apidojo",
  },

  // ─── 4. Reddit ────────────────────────────────────────────────────────
  {
    id: "reddit",
    actorId: "trudax/reddit-scraper",
    name: {
      en: "Reddit Scraper",
      es: "Extractor de Reddit",
    },
    description: {
      en: "Scrape Reddit posts and comments from subreddits or search results. Returns post titles, content, scores, and comment threads.",
      es: "Extrae publicaciones y comentarios de Reddit desde subreddits o resultados de búsqueda. Devuelve títulos, contenido, puntuaciones e hilos.",
    },
    category: "social",
    useCases: [
      "research public opinions on a subreddit",
      "find discussions about a product or brand",
      "extract community feedback and sentiment",
      "monitor trending topics on Reddit",
    ],
    inputSchema: {
      fields: [
        {
          key: "searches",
          type: "string[]",
          label: { en: "Search terms or subreddit URLs", es: "Términos de búsqueda o URLs de subreddits" },
          description: {
            en: "Search queries or subreddit URLs to scrape",
            es: "Consultas de búsqueda o URLs de subreddits a extraer",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxItems",
          type: "number",
          label: { en: "Max posts", es: "Máximo de publicaciones" },
          description: {
            en: "Maximum number of posts to return",
            es: "Número máximo de publicaciones a devolver",
          },
          required: false,
          default: 100,
          userFacing: true,
          min: 1,
          max: 5000,
        },
        {
          key: "maxComments",
          type: "number",
          label: { en: "Max comments per post", es: "Máximo de comentarios por publicación" },
          description: {
            en: "Maximum comments to collect per post",
            es: "Máximo de comentarios a recopilar por publicación",
          },
          required: false,
          default: 10,
          userFacing: false,
          min: 0,
          max: 500,
        },
        {
          key: "sort",
          type: "string",
          label: { en: "Sort order", es: "Orden" },
          description: {
            en: "Sort by: hot, new, top, rising",
            es: "Ordenar por: populares, nuevos, mejores, en ascenso",
          },
          required: false,
          default: "hot",
          userFacing: false,
        },
      ],
      defaults: {
        searches: [],
        maxItems: 100,
        maxComments: 10,
        sort: "hot",
      },
    },
    outputFields: [
      "title",
      "body",
      "score",
      "numComments",
      "subreddit",
      "author",
      "createdAt",
      "url",
      "postId",
      "comments",
    ],
    pricing: {
      model: "per-result",
      costPer1000: { min: 1.0, max: 2.5 },
    },
    healthCheck: {
      input: { searches: ["technology"], maxItems: 3 },
      expectedMinResults: 2,
      maxDurationSeconds: 60,
    },
    validation: {
      requiredFields: ["searches"],
      uniqueKey: "postId",
    },
    pairsWellWith: ["twitter", "google-search"],
    maintainer: "trudax",
  },

  // ─── 5. Google Search ─────────────────────────────────────────────────
  {
    id: "google-search",
    actorId: "apify/google-search-scraper",
    name: {
      en: "Google Search",
      es: "Búsqueda en Google",
    },
    description: {
      en: "Scrape Google search results for any query. Returns organic results with titles, URLs, snippets, and rich data like featured snippets.",
      es: "Extrae resultados de búsqueda de Google para cualquier consulta. Devuelve resultados orgánicos con títulos, URLs, fragmentos y datos enriquecidos.",
    },
    category: "search",
    useCases: [
      "find top search results for a keyword",
      "research SEO rankings for a domain",
      "gather URLs and snippets from Google",
      "extract featured snippets and knowledge panels",
      "monitor search visibility for a brand",
    ],
    inputSchema: {
      fields: [
        {
          key: "queries",
          type: "string[]",
          label: { en: "Search queries", es: "Consultas de búsqueda" },
          description: {
            en: "Google search queries to run",
            es: "Consultas de búsqueda de Google a ejecutar",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxPagesPerQuery",
          type: "number",
          label: { en: "Pages per query", es: "Páginas por consulta" },
          description: {
            en: "Number of Google result pages to scrape per query",
            es: "Número de páginas de resultados de Google a extraer por consulta",
          },
          required: false,
          default: 1,
          userFacing: true,
          min: 1,
          max: 10,
        },
        {
          key: "countryCode",
          type: "string",
          label: { en: "Country code", es: "Código de país" },
          description: {
            en: "Country code for localized results (e.g., 'us', 'es')",
            es: "Código de país para resultados localizados (ej. 'us', 'es')",
          },
          required: false,
          default: "us",
          userFacing: false,
        },
        {
          key: "languageCode",
          type: "string",
          label: { en: "Language code", es: "Código de idioma" },
          description: {
            en: "Language code for results (e.g., 'en', 'es')",
            es: "Código de idioma para resultados (ej. 'en', 'es')",
          },
          required: false,
          default: "en",
          userFacing: false,
        },
      ],
      defaults: {
        queries: [],
        maxPagesPerQuery: 1,
        countryCode: "us",
        languageCode: "en",
      },
    },
    outputFields: [
      "title",
      "url",
      "description",
      "position",
      "displayedUrl",
      "featuredSnippet",
    ],
    pricing: {
      model: "per-page",
      costPer1000: { min: 3.0, max: 6.0 },
    },
    healthCheck: {
      input: { queries: ["test"], maxPagesPerQuery: 1 },
      expectedMinResults: 5,
      maxDurationSeconds: 60,
    },
    validation: {
      requiredFields: ["queries"],
      uniqueKey: "url",
    },
    pairsWellWith: ["web-crawler", "contact-extractor"],
    maintainer: "apify",
  },

  // ─── 6. Web Crawler ───────────────────────────────────────────────────
  {
    id: "web-crawler",
    actorId: "apify/website-content-crawler",
    name: {
      en: "Website Content Crawler",
      es: "Rastreador de Contenido Web",
    },
    description: {
      en: "Crawl websites and extract their content as clean text or markdown. Follows links within a domain to collect multiple pages.",
      es: "Rastrea sitios web y extrae su contenido como texto limpio o markdown. Sigue enlaces dentro de un dominio para recopilar múltiples páginas.",
    },
    category: "search",
    useCases: [
      "extract content from a website or blog",
      "crawl all pages of a company website",
      "scrape product documentation or knowledge bases",
      "collect text content for analysis or indexing",
    ],
    inputSchema: {
      fields: [
        {
          key: "startUrls",
          type: "string[]",
          label: { en: "Start URLs", es: "URLs de inicio" },
          description: {
            en: "URLs to start crawling from",
            es: "URLs desde las cuales comenzar el rastreo",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxCrawlPages",
          type: "number",
          label: { en: "Max pages to crawl", es: "Máximo de páginas a rastrear" },
          description: {
            en: "Maximum number of pages to crawl",
            es: "Número máximo de páginas a rastrear",
          },
          required: false,
          default: 50,
          userFacing: true,
          min: 1,
          max: 10000,
        },
        {
          key: "crawlerType",
          type: "string",
          label: { en: "Crawler type", es: "Tipo de rastreador" },
          description: {
            en: "Crawler engine: playwright, cheerio, or jsdom",
            es: "Motor de rastreo: playwright, cheerio o jsdom",
          },
          required: false,
          default: "playwright",
          userFacing: false,
        },
        {
          key: "maxCrawlDepth",
          type: "number",
          label: { en: "Max crawl depth", es: "Profundidad máxima de rastreo" },
          description: {
            en: "Maximum link depth to follow from start URLs",
            es: "Profundidad máxima de enlaces a seguir desde las URLs de inicio",
          },
          required: false,
          default: 3,
          userFacing: false,
          min: 0,
          max: 20,
        },
      ],
      defaults: {
        startUrls: [],
        maxCrawlPages: 50,
        crawlerType: "playwright",
        maxCrawlDepth: 3,
      },
    },
    outputFields: [
      "url",
      "title",
      "text",
      "markdown",
      "screenshotUrl",
      "loadedAt",
    ],
    pricing: {
      model: "per-page",
      costPer1000: { min: 2.0, max: 5.0 },
    },
    healthCheck: {
      input: {
        startUrls: [{ url: "https://example.com" }],
        maxCrawlPages: 3,
      },
      expectedMinResults: 1,
      maxDurationSeconds: 120,
    },
    validation: {
      requiredFields: ["startUrls"],
      uniqueKey: "url",
    },
    pairsWellWith: ["google-search", "contact-extractor"],
    maintainer: "apify",
  },

  // ─── 7. Instagram ─────────────────────────────────────────────────────
  {
    id: "instagram",
    actorId: "apify/instagram-scraper",
    name: {
      en: "Instagram Scraper",
      es: "Extractor de Instagram",
    },
    description: {
      en: "Scrape Instagram profiles, posts, hashtags, and reels. Returns post content, engagement metrics, and profile information.",
      es: "Extrae perfiles, publicaciones, hashtags y reels de Instagram. Devuelve contenido, métricas de interacción e información de perfil.",
    },
    category: "social",
    useCases: [
      "analyze Instagram influencer engagement",
      "track hashtag performance on Instagram",
      "collect posts from a competitor Instagram account",
      "gather Instagram profile statistics",
    ],
    inputSchema: {
      fields: [
        {
          key: "directUrls",
          type: "string[]",
          label: { en: "Instagram URLs or usernames", es: "URLs o nombres de usuario de Instagram" },
          description: {
            en: "Instagram profile URLs, hashtag pages, or usernames to scrape",
            es: "URLs de perfiles de Instagram, páginas de hashtags o nombres de usuario a extraer",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "resultsLimit",
          type: "number",
          label: { en: "Max results", es: "Máximo de resultados" },
          description: {
            en: "Maximum number of posts to return",
            es: "Número máximo de publicaciones a devolver",
          },
          required: false,
          default: 50,
          userFacing: true,
          min: 1,
          max: 5000,
        },
        {
          key: "resultsType",
          type: "string",
          label: { en: "Results type", es: "Tipo de resultados" },
          description: {
            en: "Type of content: posts, stories, or comments",
            es: "Tipo de contenido: publicaciones, historias o comentarios",
          },
          required: false,
          default: "posts",
          userFacing: false,
        },
        {
          key: "addParentData",
          type: "boolean",
          label: { en: "Include profile data", es: "Incluir datos de perfil" },
          description: {
            en: "Include parent profile data with each post",
            es: "Incluir datos del perfil padre con cada publicación",
          },
          required: false,
          default: false,
          userFacing: false,
        },
      ],
      defaults: {
        directUrls: [],
        resultsLimit: 50,
        resultsType: "posts",
        addParentData: false,
      },
    },
    outputFields: [
      "caption",
      "likesCount",
      "commentsCount",
      "timestamp",
      "shortCode",
      "url",
      "imageUrl",
      "ownerUsername",
      "type",
    ],
    pricing: {
      model: "per-result",
      costPer1000: { min: 2.0, max: 5.0 },
    },
    healthCheck: {
      input: {
        directUrls: ["https://www.instagram.com/instagram/"],
        resultsLimit: 3,
      },
      expectedMinResults: 2,
      maxDurationSeconds: 90,
    },
    validation: {
      requiredFields: ["directUrls"],
      uniqueKey: "shortCode",
    },
    pairsWellWith: ["twitter", "google-search"],
    maintainer: "apify",
  },

  // ─── 8. TripAdvisor ───────────────────────────────────────────────────
  {
    id: "tripadvisor",
    actorId: "maxcopell/tripadvisor",
    name: {
      en: "TripAdvisor Scraper",
      es: "Extractor de TripAdvisor",
    },
    description: {
      en: "Extract hotel, restaurant, and attraction listings from TripAdvisor with reviews, ratings, prices, and location details.",
      es: "Extrae listados de hoteles, restaurantes y atracciones de TripAdvisor con reseñas, calificaciones, precios y detalles de ubicación.",
    },
    category: "travel",
    useCases: [
      "research hotels and restaurants in a destination",
      "collect TripAdvisor reviews for sentiment analysis",
      "compare ratings and prices of travel accommodations",
      "build a travel guide with top-rated attractions",
    ],
    inputSchema: {
      fields: [
        {
          key: "startUrls",
          type: "string[]",
          label: { en: "TripAdvisor URLs or search terms", es: "URLs de TripAdvisor o términos de búsqueda" },
          description: {
            en: "TripAdvisor listing URLs or search terms",
            es: "URLs de listados de TripAdvisor o términos de búsqueda",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxItems",
          type: "number",
          label: { en: "Max results", es: "Máximo de resultados" },
          description: {
            en: "Maximum number of listings to return",
            es: "Número máximo de listados a devolver",
          },
          required: false,
          default: 50,
          userFacing: true,
          min: 1,
          max: 2000,
        },
        {
          key: "includeReviews",
          type: "boolean",
          label: { en: "Include reviews", es: "Incluir reseñas" },
          description: {
            en: "Whether to also scrape reviews for each listing",
            es: "Si se deben extraer también las reseñas de cada listado",
          },
          required: false,
          default: true,
          userFacing: false,
        },
        {
          key: "maxReviews",
          type: "number",
          label: { en: "Max reviews per listing", es: "Máximo de reseñas por listado" },
          description: {
            en: "Maximum reviews to scrape per listing",
            es: "Máximo de reseñas a extraer por listado",
          },
          required: false,
          default: 20,
          userFacing: false,
          min: 0,
          max: 500,
        },
      ],
      defaults: {
        startUrls: [],
        maxItems: 50,
        includeReviews: true,
        maxReviews: 20,
      },
    },
    outputFields: [
      "name",
      "rating",
      "reviewsCount",
      "price",
      "address",
      "category",
      "url",
      "reviews",
      "rankingPosition",
    ],
    pricing: {
      model: "per-result",
      costPer1000: { min: 3.0, max: 7.0 },
    },
    healthCheck: {
      input: {
        startUrls: [
          "https://www.tripadvisor.com/Attraction_Review-g60763-d103887-Reviews-Central_Park-New_York_City_New_York.html",
        ],
        maxItems: 3,
      },
      expectedMinResults: 1,
      maxDurationSeconds: 120,
    },
    validation: {
      requiredFields: ["startUrls"],
      uniqueKey: "url",
    },
    pairsWellWith: ["google-maps", "google-maps-reviews"],
    maintainer: "maxcopell",
  },

  // ─── 9. Amazon Products ───────────────────────────────────────────────
  {
    id: "amazon-products",
    actorId: "junglee/amazon-crawler",
    name: {
      en: "Amazon Product Scraper",
      es: "Extractor de Productos de Amazon",
    },
    description: {
      en: "Scrape Amazon product listings including titles, prices, ratings, reviews, and product details for market research.",
      es: "Extrae listados de productos de Amazon incluyendo títulos, precios, calificaciones, reseñas y detalles de producto para investigación de mercado.",
    },
    category: "ecommerce",
    useCases: [
      "research product prices on Amazon",
      "compare competitor products and ratings",
      "track pricing trends for a product category",
      "extract Amazon product reviews and specifications",
    ],
    inputSchema: {
      fields: [
        {
          key: "keyword",
          type: "string",
          label: { en: "Search keyword", es: "Palabra clave de búsqueda" },
          description: {
            en: "Amazon search keyword or product category",
            es: "Palabra clave de búsqueda o categoría de producto en Amazon",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxItems",
          type: "number",
          label: { en: "Max products", es: "Máximo de productos" },
          description: {
            en: "Maximum number of products to return",
            es: "Número máximo de productos a devolver",
          },
          required: false,
          default: 50,
          userFacing: true,
          min: 1,
          max: 1000,
        },
        {
          key: "country",
          type: "string",
          label: { en: "Amazon country", es: "País de Amazon" },
          description: {
            en: "Amazon marketplace country code (e.g., 'US', 'ES', 'UK')",
            es: "Código de país del marketplace de Amazon (ej. 'US', 'ES', 'UK')",
          },
          required: false,
          default: "US",
          userFacing: false,
        },
        {
          key: "includeDescription",
          type: "boolean",
          label: { en: "Include descriptions", es: "Incluir descripciones" },
          description: {
            en: "Include full product description in results",
            es: "Incluir descripción completa del producto en los resultados",
          },
          required: false,
          default: true,
          userFacing: false,
        },
      ],
      defaults: {
        keyword: "",
        maxItems: 50,
        country: "US",
        includeDescription: true,
      },
    },
    outputFields: [
      "title",
      "price",
      "rating",
      "reviewsCount",
      "asin",
      "url",
      "imageUrl",
      "brand",
      "description",
      "isPrime",
    ],
    pricing: {
      model: "per-result",
      costPer1000: { min: 2.5, max: 5.0 },
    },
    healthCheck: {
      input: { keyword: "usb cable", maxItems: 3 },
      expectedMinResults: 2,
      maxDurationSeconds: 90,
    },
    validation: {
      requiredFields: ["keyword"],
      uniqueKey: "asin",
    },
    pairsWellWith: ["google-search"],
    maintainer: "junglee",
  },

  // ─── 10. Contact Extractor ────────────────────────────────────────────
  {
    id: "contact-extractor",
    actorId: "vdrmota/contact-info-scraper",
    name: {
      en: "Contact Info Extractor",
      es: "Extractor de Información de Contacto",
    },
    description: {
      en: "Extract email addresses, phone numbers, and social media links from any website. Useful for building lead lists and contact databases.",
      es: "Extrae correos electrónicos, números de teléfono y enlaces de redes sociales de cualquier sitio web. Útil para crear listas de leads y bases de contactos.",
    },
    category: "maps",
    useCases: [
      "extract contact information from company websites",
      "build a lead list with emails and phone numbers",
      "find email addresses and social media links on a page",
      "collect business contact details for outreach",
    ],
    inputSchema: {
      fields: [
        {
          key: "startUrls",
          type: "string[]",
          label: { en: "Website URLs", es: "URLs de sitios web" },
          description: {
            en: "Website URLs to extract contact info from",
            es: "URLs de sitios web de los cuales extraer información de contacto",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxDepth",
          type: "number",
          label: { en: "Crawl depth", es: "Profundidad de rastreo" },
          description: {
            en: "How many link levels deep to crawl for contact info",
            es: "Cuántos niveles de enlaces rastrear en profundidad para info de contacto",
          },
          required: false,
          default: 2,
          userFacing: true,
          min: 0,
          max: 10,
        },
        {
          key: "maxPagesPerDomain",
          type: "number",
          label: { en: "Max pages per domain", es: "Máximo de páginas por dominio" },
          description: {
            en: "Maximum pages to crawl per domain",
            es: "Máximo de páginas a rastrear por dominio",
          },
          required: false,
          default: 20,
          userFacing: false,
          min: 1,
          max: 100,
        },
        {
          key: "sameDomain",
          type: "boolean",
          label: { en: "Same domain only", es: "Solo mismo dominio" },
          description: {
            en: "Only follow links within the same domain",
            es: "Solo seguir enlaces dentro del mismo dominio",
          },
          required: false,
          default: true,
          userFacing: false,
        },
      ],
      defaults: {
        startUrls: [],
        maxDepth: 2,
        maxPagesPerDomain: 20,
        sameDomain: true,
      },
    },
    outputFields: [
      "emails",
      "phones",
      "socialLinks",
      "domain",
      "pageUrl",
      "companyName",
    ],
    pricing: {
      model: "per-page",
      costPer1000: { min: 1.5, max: 3.0 },
    },
    healthCheck: {
      input: {
        startUrls: [{ url: "https://example.com" }],
        maxDepth: 1,
        maxPagesPerDomain: 3,
      },
      expectedMinResults: 1,
      maxDurationSeconds: 60,
    },
    validation: {
      requiredFields: ["startUrls"],
      uniqueKey: "domain",
    },
    pairsWellWith: ["google-maps", "web-crawler", "google-search"],
    maintainer: "vdrmota",
  },

  // ─── 11. LinkedIn Jobs ────────────────────────────────────────────────
  {
    id: "linkedin-jobs",
    actorId: "bebity/linkedin-jobs-scraper",
    name: {
      en: "LinkedIn Jobs Scraper",
      es: "Extractor de Empleos de LinkedIn",
    },
    description: {
      en: "Scrape LinkedIn job postings including title, company, location, salary, and job description for recruitment and market research.",
      es: "Extrae ofertas de empleo de LinkedIn incluyendo título, empresa, ubicación, salario y descripción del puesto para reclutamiento e investigación.",
    },
    category: "professional",
    useCases: [
      "search for job postings by role and location",
      "research salary ranges in a specific industry",
      "monitor job market trends for specific skills",
      "collect hiring data from LinkedIn for analysis",
    ],
    inputSchema: {
      fields: [
        {
          key: "searchUrl",
          type: "string",
          label: { en: "LinkedIn Jobs search URL or keywords", es: "URL de búsqueda de empleos o palabras clave" },
          description: {
            en: "LinkedIn Jobs search URL or search keywords",
            es: "URL de búsqueda de empleos en LinkedIn o palabras clave",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxItems",
          type: "number",
          label: { en: "Max job listings", es: "Máximo de ofertas de empleo" },
          description: {
            en: "Maximum number of job listings to return",
            es: "Número máximo de ofertas de empleo a devolver",
          },
          required: false,
          default: 50,
          userFacing: true,
          min: 1,
          max: 1000,
        },
        {
          key: "location",
          type: "string",
          label: { en: "Location", es: "Ubicación" },
          description: {
            en: "Filter jobs by location (e.g., 'Remote', 'New York')",
            es: "Filtrar empleos por ubicación (ej. 'Remoto', 'Madrid')",
          },
          required: false,
          default: "",
          userFacing: true,
        },
        {
          key: "scrapeCompany",
          type: "boolean",
          label: { en: "Include company details", es: "Incluir detalles de la empresa" },
          description: {
            en: "Also scrape company information for each job listing",
            es: "También extraer información de la empresa para cada oferta",
          },
          required: false,
          default: false,
          userFacing: false,
        },
      ],
      defaults: {
        searchUrl: "",
        maxItems: 50,
        location: "",
        scrapeCompany: false,
      },
    },
    outputFields: [
      "title",
      "companyName",
      "location",
      "salary",
      "description",
      "postedAt",
      "applicantsCount",
      "jobUrl",
      "contractType",
      "experienceLevel",
    ],
    pricing: {
      model: "per-result",
      costPer1000: { min: 3.0, max: 6.0 },
    },
    healthCheck: {
      input: { searchUrl: "software engineer", maxItems: 3 },
      expectedMinResults: 2,
      maxDurationSeconds: 90,
    },
    validation: {
      requiredFields: ["searchUrl"],
      uniqueKey: "jobUrl",
    },
    pairsWellWith: ["linkedin-profiles"],
    maintainer: "bebity",
  },

  // ─── 12. LinkedIn Profiles ────────────────────────────────────────────
  {
    id: "linkedin-profiles",
    actorId: "dev_fusion/linkedin-profile-scraper",
    name: {
      en: "LinkedIn Profile Scraper",
      es: "Extractor de Perfiles de LinkedIn",
    },
    description: {
      en: "Extract public LinkedIn profile data including work experience, education, skills, and summary for lead generation and research.",
      es: "Extrae datos de perfiles públicos de LinkedIn incluyendo experiencia laboral, educación, habilidades y resumen para generación de leads.",
    },
    category: "professional",
    useCases: [
      "research professional backgrounds of potential leads",
      "collect LinkedIn profile data for recruiting",
      "gather information on industry professionals",
      "build a database of contacts with their skills and experience",
    ],
    inputSchema: {
      fields: [
        {
          key: "profileUrls",
          type: "string[]",
          label: { en: "LinkedIn profile URLs", es: "URLs de perfiles de LinkedIn" },
          description: {
            en: "LinkedIn profile URLs to scrape",
            es: "URLs de perfiles de LinkedIn a extraer",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxItems",
          type: "number",
          label: { en: "Max profiles", es: "Máximo de perfiles" },
          description: {
            en: "Maximum number of profiles to scrape",
            es: "Número máximo de perfiles a extraer",
          },
          required: false,
          default: 25,
          userFacing: true,
          min: 1,
          max: 500,
        },
        {
          key: "includeSkills",
          type: "boolean",
          label: { en: "Include skills", es: "Incluir habilidades" },
          description: {
            en: "Whether to extract the skills section",
            es: "Si se debe extraer la sección de habilidades",
          },
          required: false,
          default: true,
          userFacing: false,
        },
        {
          key: "includeExperience",
          type: "boolean",
          label: { en: "Include experience", es: "Incluir experiencia" },
          description: {
            en: "Whether to extract work experience details",
            es: "Si se debe extraer detalles de experiencia laboral",
          },
          required: false,
          default: true,
          userFacing: false,
        },
      ],
      defaults: {
        profileUrls: [],
        maxItems: 25,
        includeSkills: true,
        includeExperience: true,
      },
    },
    outputFields: [
      "fullName",
      "headline",
      "summary",
      "location",
      "experience",
      "education",
      "skills",
      "profileUrl",
      "connectionsCount",
    ],
    pricing: {
      model: "per-result",
      costPer1000: { min: 4.0, max: 8.0 },
    },
    healthCheck: {
      input: {
        profileUrls: [
          "https://www.linkedin.com/in/williamhgates/",
        ],
        maxItems: 1,
      },
      expectedMinResults: 1,
      maxDurationSeconds: 90,
    },
    validation: {
      requiredFields: ["profileUrls"],
      uniqueKey: "profileUrl",
    },
    pairsWellWith: ["linkedin-jobs", "contact-extractor"],
    maintainer: "dev_fusion",
  },

  // ─── 13. Tweets (by user/URL) ─────────────────────────────────────────
  {
    id: "tweets",
    actorId: "apidojo/tweet-scraper",
    name: {
      en: "Tweet Collector",
      es: "Recolector de Tweets",
    },
    description: {
      en: "Collect tweets from specific users or tweet URLs. Ideal for archiving tweet threads and monitoring individual accounts.",
      es: "Recopila tweets de usuarios específicos o URLs de tweets. Ideal para archivar hilos y monitorear cuentas individuales.",
    },
    category: "social",
    useCases: [
      "archive tweets from a specific user account",
      "collect a tweet thread or conversation",
      "monitor a public figure's Twitter activity",
      "extract tweets from specific URLs for analysis",
    ],
    inputSchema: {
      fields: [
        {
          key: "handles",
          type: "string[]",
          label: { en: "Twitter handles or URLs", es: "Cuentas de Twitter o URLs" },
          description: {
            en: "Twitter usernames (without @) or tweet URLs to collect",
            es: "Nombres de usuario de Twitter (sin @) o URLs de tweets a recopilar",
          },
          required: true,
          userFacing: true,
        },
        {
          key: "maxItems",
          type: "number",
          label: { en: "Max tweets", es: "Máximo de tweets" },
          description: {
            en: "Maximum number of tweets to collect",
            es: "Número máximo de tweets a recopilar",
          },
          required: false,
          default: 100,
          userFacing: true,
          min: 1,
          max: 10000,
        },
        {
          key: "includeReplies",
          type: "boolean",
          label: { en: "Include replies", es: "Incluir respuestas" },
          description: {
            en: "Whether to include replies in results",
            es: "Si se deben incluir respuestas en los resultados",
          },
          required: false,
          default: false,
          userFacing: false,
        },
        {
          key: "sort",
          type: "string",
          label: { en: "Sort order", es: "Orden" },
          description: {
            en: "Sort by: Latest or Top",
            es: "Ordenar por: Más recientes o Principales",
          },
          required: false,
          default: "Latest",
          userFacing: false,
        },
      ],
      defaults: {
        handles: [],
        maxItems: 100,
        includeReplies: false,
        sort: "Latest",
      },
    },
    outputFields: [
      "text",
      "retweetCount",
      "likeCount",
      "replyCount",
      "authorName",
      "authorUsername",
      "createdAt",
      "tweetId",
      "url",
      "isReply",
    ],
    pricing: {
      model: "per-result",
      costPer1000: { min: 1.0, max: 3.0 },
    },
    healthCheck: {
      input: { handles: ["elonmusk"], maxItems: 3 },
      expectedMinResults: 2,
      maxDurationSeconds: 60,
    },
    validation: {
      requiredFields: ["handles"],
      uniqueKey: "tweetId",
    },
    pairsWellWith: ["twitter", "reddit"],
    maintainer: "apidojo",
  },
];

// ─── Helper functions ───────────────────────────────────────────────────

export function findToolById(id: string): ToolCatalogEntry | undefined {
  return toolCatalog.find((t) => t.id === id);
}

export function searchCatalog(query: string, locale: Locale): ToolSearchResult[] {
  const q = query.toLowerCase();
  return toolCatalog
    .filter(
      (t) =>
        t.name[locale].toLowerCase().includes(q) ||
        t.description[locale].toLowerCase().includes(q) ||
        t.useCases.some((uc) => uc.toLowerCase().includes(q)) ||
        t.category.includes(q)
    )
    .map((t) => ({
      id: t.id,
      name: t.name[locale],
      description: t.description[locale],
      category: t.category,
      healthStatus: "unknown",
      costPer1000: t.pricing.costPer1000,
      pairsWellWith: t.pairsWellWith,
    }));
}

export function getToolConfig(
  toolId: string,
  locale: Locale
): ToolConfigResult | null {
  const tool = findToolById(toolId);
  if (!tool) return null;

  return {
    toolId: tool.id,
    toolName: tool.name[locale],
    fields: tool.inputSchema.fields
      .filter((f) => f.userFacing)
      .map((f) => ({
        key: f.key,
        label: f.label[locale],
        description: f.description[locale],
        type: f.type,
        required: f.required,
        default: f.default,
        min: f.min,
        max: f.max,
      })),
    defaults: tool.inputSchema.defaults,
  };
}

export function estimateCost(
  toolId: string,
  resultCount: number
): CostEstimate | null {
  const tool = findToolById(toolId);
  if (!tool) return null;

  const { min, max } = tool.pricing.costPer1000;
  const factor = resultCount / 1000;
  const markup = 1.4;

  return {
    min: Math.round(min * factor * markup * 100) / 100,
    max: Math.round(max * factor * markup * 100) / 100,
    expected: Math.round(((min + max) / 2) * factor * markup * 100) / 100,
    breakdown: `${resultCount} results × $${min}-${max}/1000 × 1.4 markup`,
  };
}
