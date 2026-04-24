# ResearchBot — Documento Definitivo

## 1. Visión del Producto

ResearchBot es una plataforma web donde cualquier persona describe en lenguaje natural qué quiere investigar, y un chatbot inteligente la guía para extraer datos de internet, analizarlos con IA, y generar reportes accionables. Todo con costos transparentes y modelo pay-per-use.

**Posicionamiento: "Deep Research as a Service"** — no es un social listening tool (Brandwatch, Brand24), no es una plataforma de scraping (Apify, Octoparse). Es una capa de inteligencia conversacional que transforma una necesidad de investigación en datos estructurados y reportes, sin conocimiento técnico.

### Flujo del usuario

```
1. Login → Chat con el bot → "Quiero investigar X"
2. El bot interpreta la necesidad y sugiere herramientas de su catálogo curado
3. El usuario elige herramientas → ve costo estimado en tiempo real
4. Configura keywords, filtros, volumen (guiado por el bot)
5. Opcionalmente agrega análisis IA (sentimiento, clasificación, etc.)
6. Ve resumen final de costos → Acepta
7. Se ejecuta la extracción → progreso en tiempo real
8. Recibe Excel/CSV con datos crudos + campos IA
9. Genera reportes interactivos con dashboards e insights
```

### Ejemplos de uso

| Necesidad | Herramientas sugeridas |
|---|---|
| "Qué opina la gente de la recolección de basura en Buenos Aires" | Twitter + Reddit + Google Search |
| "Lista de restaurantes en Palermo sin página web" | Google Maps (filtrar sin website) |
| "Comparar precios de zapatillas Nike en MercadoLibre vs Amazon" | MercadoLibre Scraper + Amazon Scraper |
| "Reviews de mi hotel en Booking y TripAdvisor" | Booking Scraper + TripAdvisor Scraper |
| "Qué videos de TikTok son tendencia sobre skincare" | TikTok Scraper |
| "Artículos sobre blockchain del último año" | Website Content Crawler |
| "Emails de contacto de dentistas en Madrid" | Google Maps + Email Extractor |

---

## 2. Análisis Competitivo

### El mercado y dónde entramos

| Segmento | Players | Precio | Limitación |
|---|---|---|---|
| Enterprise social listening | Brandwatch, Meltwater, Talkwalker | $800-$5000+/mes, contratos anuales | Carísimo, rígido, solo social media |
| Mid-market monitoring | Brand24 ($79/mes), Awario ($29/mes), Mention ($41/mes) | $29-499/mes suscripción | Solo monitoreo continuo, no research puntual |
| Plataformas de scraping | Apify ($29/mes), Octoparse ($75/mes) | $29-299/mes + uso | Técnico, sin análisis ni reportes |
| **ResearchBot** | — | **$0/mes + pay-per-use ($3-15 por research)** | — |

### Nuestro gap de mercado

Ninguna herramienta existente combina:
1. Interfaz conversacional (sin conocimiento técnico)
2. Modelo pay-per-use (sin suscripción)
3. Análisis IA personalizable por el usuario
4. Generación automática de reportes con dashboards
5. Transparencia total de costos antes de ejecutar

### Usuarios target

- Consultores de marketing/PR (research puntual para clientes)
- Investigadores académicos y periodistas de datos
- Startups validando ideas
- Agencias pequeñas que no pagan $800/mes por Brandwatch
- Equipos de gobierno/municipios analizando percepción ciudadana
- Product managers investigando feedback

### Oportunidad LATAM

El mercado de herramientas de research en español está subatendido. Un producto en español con IA que entienda lunfardo, modismos y contexto local tiene ventaja clara sobre herramientas enterprise en inglés.

---

## 3. Stack Tecnológico

### Frontend + Backend: Next.js 15 (App Router, TypeScript)

**Justificación**: combina frontend + API routes + SSR en un solo proyecto. Menos repos, deploy simple. Server Components reduce JS al cliente. Streaming nativo para el chatbot.

**Descartados**: React + Express separado (doble deploy), Vue/Nuxt (ecosistema más chico), SvelteKit (componentes limitados).

### UI: Tailwind CSS + shadcn/ui

**Justificación**: componentes de alta calidad sin diseñar desde cero. Excelente soporte en Claude Code. Responsive out-of-the-box.

### Base de datos + Auth + Realtime + Storage: Supabase (PostgreSQL)

**Justificación**: 
- PostgreSQL hosteado con tier gratis generoso (500 MB, auth incluida)
- Auth integrada (email, Google, GitHub) sin implementar nada
- Realtime subscriptions para progreso del scraping en vivo
- Storage para Excel/CSV/PDF generados
- Row Level Security para multi-tenancy
- El usuario ya tiene Supabase conectado como MCP

**Descartados**: Firebase (vendor lock-in, NoSQL), PlanetScale (MySQL), Neon (sin auth/storage integrado).

### Chatbot: Vercel AI SDK (@ai-sdk/anthropic)

**Justificación**: streaming nativo, tool calling integrado con Claude, diseñado para Next.js. Soporta Server-Sent Events sin config extra.

### LLM — Chatbot + Reportes: Claude Sonnet 4.6

- $3 input / $15 output por millón de tokens
- Usado para: interpretar intent del usuario, sugerir herramientas, configurar parámetros, generar reportes
- Costo por conversación típica: ~$0.02-0.05

### LLM — Clasificación + Sentimiento: Claude Haiku 4.5

- $1 input / $5 output por millón de tokens
- Con Batch API (50% off): $0.50 / $2.50 por MTok
- Con prompt caching (90% off en inputs repetidos): hasta 95% ahorro
- Procesar 1000 registros ≈ **$0.05 en batch**
- Precisión excelente en español, detecta sarcasmo y lunfardo

### Scraping: Apify (catálogo curado)

**Justificación**:
- No se expone todo el store — catálogo curado de ~20 herramientas testeadas
- API REST simple: enviar input, recibir dataset JSON
- Free tier $5/mes para testing, Starter $29/mes
- Costo típico: $0.001-$0.05 por resultado según actor
- Maneja proxies, CAPTCHAs, rate limiting, retries internamente

**Descartados como primary**: Bright Data (enterprise, caro), ScraperAPI (solo proxy), Firecrawl (solo web→markdown), scrapers propios (mantenimiento alto para MVP).

### Background Jobs: Inngest

**Justificación**: el scraping tarda minutos/horas, no puede correr en API routes (timeout 30s en Vercel). Inngest tiene tier gratis de 25K eventos/mes, retries automáticos, se integra nativamente con Next.js.

**Descartados**: BullMQ + Redis (requiere server), AWS Lambda + SQS (overkill).

### Deploy: Vercel

**Justificación**: deploy nativo para Next.js. Pro a $20/mes. Edge functions para streaming. Preview deployments por PR. El usuario ya tiene Vercel conectado.

### Pagos: Stripe (global) o Mercado Pago (Argentina)

Modelo de créditos prepagos. El usuario compra créditos, cada research consume créditos.

### Costos de infra mensuales (operador)

| Servicio | Costo |
|---|---|
| Vercel Pro | $20 |
| Supabase Free→Pro | $0-25 |
| Inngest Free | $0 |
| Dominio | ~$1 |
| Health checks Apify | ~$2-5 (mini-tests diarios) |
| **Total MVP** | **$23-51/mes** |

---

## 4. Catálogo Curado de Herramientas

### Criterios de inclusión

Cada herramienta debe cumplir TODOS:
- Mantenida por Apify oficial O developer top (>10K usuarios)
- Success rate >90% verificado con tests propios
- Actualizada en los últimos 30 días
- Pricing predecible
- Output schema documentado

### Catálogo MVP (~20 herramientas)

#### 🗺️ Mapas y Negocios Locales
| Nombre público | Actor Apify | Confiabilidad | Costo aprox/1000 |
|---|---|---|---|
| Buscador de Negocios | compass/crawler-google-places | ⭐ Muy alta | $3-7 |
| Reseñas de Google Maps | compass/google-maps-reviews | ⭐ Muy alta | $2-5 |
| Extractor de Contactos | vdrmota/contact-info-scraper | ⭐ Alta | $1-3 |

#### 📱 Redes Sociales
| Nombre público | Actor Apify | Confiabilidad | Costo aprox/1000 |
|---|---|---|---|
| Twitter/X | apidojo/twitter-scraper | ⚠️ Media-Alta | $2-5 |
| Instagram - Posts | apify/instagram-scraper | ⭐ Alta | $3-8 |
| Instagram - Perfiles | apify/instagram-profile-scraper | ⭐ Alta | $2-5 |
| TikTok | clockworks/tiktok-scraper | ⭐ Alta | $1-3 |
| Facebook | apify/facebook-posts-scraper | ⭐ Alta | $3-8 |
| Reddit | trudax/reddit-scraper | ⭐ Alta | $1-2 |
| YouTube | bernardo/youtube-scraper | ⭐ Alta | $2-4 |

#### 🔍 Búsqueda Web y Contenido
| Nombre público | Actor Apify | Confiabilidad | Costo aprox/1000 |
|---|---|---|---|
| Buscador Web (Google) | apify/google-search-scraper | ⭐ Muy alta | $1-2 |
| Extractor de Contenido Web | apify/website-content-crawler | ⭐ Muy alta | $0.50-2 |
| Google News | apify/google-news-scraper | ⭐ Alta | $1-2 |

#### 🛒 E-commerce
| Nombre público | Actor Apify | Confiabilidad | Costo aprox/1000 |
|---|---|---|---|
| Amazon - Productos | junglee/amazon-crawler | ⭐ Alta | $2-5 |
| Amazon - Reseñas | junglee/amazon-reviews-scraper | ⭐ Alta | $2-4 |

#### 🏨 Viajes
| Nombre público | Actor Apify | Confiabilidad | Costo aprox/1000 |
|---|---|---|---|
| TripAdvisor | maxcopell/tripadvisor | ⭐ Alta | $2-5 |
| Booking | voyager/booking-scraper | ⭐ Alta | $2-5 |

#### 📊 Reviews y Reputación
| Nombre público | Actor Apify | Confiabilidad | Costo aprox/1000 |
|---|---|---|---|
| Trustpilot | yin/trustpilot-scraper | ⭐ Alta | $1-3 |

*Nota: los Actor IDs son indicativos. Verificar en la Apify Store antes de implementar y correr tests de validación.*

### Nombres internos vs públicos

El usuario NUNCA ve "Apify", "Actor", ni IDs técnicos. Solo ve nombres descriptivos como "Buscador de Negocios" o "Extractor de Twitter". Esto permite cambiar el proveedor debajo sin afectar la UX.

---

## 5. Sistema de Confiabilidad

### 5.1 Health Monitoring

Cron cada 12 horas ejecuta un mini-test por cada herramienta del catálogo con un input conocido. 

**Reglas automáticas:**
- 3 fallos consecutivos → marcar como `down`, dejar de ofrecerla
- Success rate <80% en 7 días → marcar como `degraded`, mostrar warning
- Success rate vuelve a >90% → marcar como `healthy`
- `down` por >7 días → alerta al admin para buscar reemplazo

**UX del estado de salud:**
```
✅ "Funcionando (98% de éxito esta semana)"
⚠️ "Funcionamiento parcial (78% — puede devolver menos resultados)"
❌ "No disponible temporalmente"
```

### 5.2 Política "No Data, No Charge"

- Se reservan créditos al inicio (no se debitan)
- Al terminar, se cobra solo el costo real
- Si devuelve 0 resultados → reembolso total
- Si devuelve <50% de lo esperado → cobro proporcional con 20% de descuento extra
- La diferencia entre estimado y real se devuelve siempre

### 5.3 Validación Post-Scraping

Antes de entregar datos, validar:
- Campos vacíos en datos críticos
- Duplicados (remover automáticamente)
- Integridad (fechas válidas, URLs reales, scores en rango)
- Relevancia (sample check con IA contra el query original)

Si la calidad es baja, advertir al usuario antes de cobrar.

### 5.4 Fallbacks por Categoría (mediano plazo)

| Categoría | Primario (Apify) | Fallback |
|---|---|---|
| Google Maps | compass/crawler-google-places | SerpApi |
| Twitter/X | apidojo/twitter-scraper | Scraper propio con Crawlee |
| Web content | apify/website-content-crawler | Firecrawl API |
| Google Search | apify/google-search-scraper | Serper.dev |
| Instagram/TikTok | actors oficiales | Sin fallback barato (aceptar riesgo) |

### 5.5 Scrapers Propios (largo plazo)

Si una fuente concentra >30% del tráfico, construir scraper propio con Crawlee (open-source de Apify) hosteado en infra propia. Prioridad: Google Search > Web Crawler > Google Maps > Twitter.

---

## 6. Módulos del Sistema

### 6.1 Chatbot (core UX)

El chatbot usa Claude Sonnet 4.6 con tool calling para:

**Tools disponibles:**

```typescript
// Tool 1: Buscar herramientas en el catálogo curado
function searchTools(query: string): Tool[] {
  // Busca en actor_catalog por use_cases, categories, description
  // Devuelve las herramientas relevantes con estado de salud y precio
}

// Tool 2: Obtener schema de configuración de una herramienta
function getToolConfig(toolId: string): InputSchema {
  // Devuelve los campos configurables con defaults inteligentes
  // Claude decide cuáles preguntar al usuario y cuáles auto-configurar
}

// Tool 3: Estimar costo
function estimateCost(toolId: string, config: object): CostEstimate {
  // Calcula costo estimado basado en pricing del actor + volumen
}

// Tool 4: Sugerir keywords
function suggestKeywords(objective: string, tool: string): string[] {
  // Genera keywords óptimas incluyendo variaciones semánticas,
  // errores ortográficos, sinónimos, hashtags, lenguaje coloquial
}

// Tool 5: Sugerir análisis IA
function suggestAIAnalysis(objective: string, dataType: string): AnalysisConfig[] {
  // Sugiere qué análisis IA aplicar según el objetivo
}
```

**System prompt del chatbot: (requiere mejoras y refinamiento, mas detalle y especificidad)**

```
Sos el asistente de ResearchBot, una plataforma de investigación 
de datos públicos en internet.

Tu trabajo es:
1. Entender qué quiere investigar el usuario
2. Sugerir las mejores herramientas de tu catálogo
3. Configurar los parámetros de forma conversacional
4. Mostrar costos estimados de forma transparente
5. Sugerir análisis IA que agreguen valor

Reglas:
- Nunca mencionar "Apify", "Actor", ni términos técnicos de scraping
- Llamar a las herramientas por su nombre público ("Buscador de Negocios")
- Siempre mostrar el costo estimado antes de ejecutar
- Si una herramienta tiene estado "degraded", avisar al usuario
- Si una herramienta está "down", sugerir alternativas
- Para campos técnicos (proxy, headers, cookies), configurar silenciosamente
- Sugerir keywords en el idioma del usuario incluyendo variaciones coloquiales
- Máximo 1-2 preguntas por mensaje para no abrumar
```

### 6.2 Motor de Ejecución

```
1. Usuario confirma → crear research_project, reservar créditos
2. Por cada herramienta seleccionada:
   a. POST a Apify API → iniciar Actor run
   b. Polling cada 30s vía Inngest steps
   c. Descargar dataset al completar
   d. Validar calidad de datos
   e. Insertar en raw_data
   f. Emitir evento Supabase Realtime → UI actualiza progreso
3. Calcular costo real, ajustar créditos
4. Si hay análisis IA configurado → ejecutar enrichment
5. Marcar proyecto como "completed"
```

### 6.3 Análisis IA

**Templates pre-armados:**

| Template | Campos que agrega | Modelo |
|---|---|---|
| Sentimiento | `ai_sentiment` (positivo/neutro/negativo), `ai_score` (1-10) | Haiku 4.5 batch |
| Clasificación custom | `ai_category` (categorías definidas por usuario) | Haiku 4.5 batch |
| Extracción de entidades | `ai_entities` (personas, lugares, marcas) | Haiku 4.5 batch |
| Resumen | `ai_summary` (1-2 oraciones) | Haiku 4.5 batch |
| Detección de spam | `ai_is_genuine` (boolean) | Haiku 4.5 batch |
| Pain points | `ai_pain_points` (problemas mencionados) | Haiku 4.5 batch |

**Análisis custom**: el usuario define categorías, escala, o cualquier campo a extraer. El bot genera el prompt automáticamente.

**Implementación**: lotes de 20 registros enviados a Haiku 4.5 Batch API. Prompt pide respuesta en JSON puro. Costo: ~$0.05 por 1000 registros.

### 6.4 Exportación

- Excel (.xlsx) con headers formateados, columnas autoajustadas, font Arial 10
- CSV como alternativa
- Subidos a Supabase Storage con link de descarga

### 6.5 Reportes

Claude Sonnet 4.6 analiza los datos procesados y genera:
- Dashboard HTML interactivo (Recharts para gráficos)
- Distribución de sentimiento, clasificación, fuentes
- Top insights detectados
- Tendencias temporales
- Word clouds de temas
- Recomendaciones accionables
- Exportable a PDF vía Puppeteer

---

## 7. Arquitectura tentativa de Base de Datos (no definitiva)

```sql
-- Usuarios (extendido de Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  display_name TEXT,
  credits_balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Proyectos de research
CREATE TABLE research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  -- draft | configured | running | completed | failed
  total_estimated_cost DECIMAL(10,2),
  total_actual_cost DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Jobs de scraping (1 por herramienta usada)
CREATE TABLE scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id),
  -- Herramienta (del catálogo curado)
  tool_id TEXT NOT NULL REFERENCES actor_catalog(id),
  tool_name TEXT,
  -- Configuración
  actor_input JSONB NOT NULL,
  search_terms TEXT[],
  -- Estimaciones y costos
  estimated_results INT,
  estimated_cost DECIMAL(10,2),
  actual_results INT,
  actual_cost DECIMAL(10,2),
  -- Estado
  status TEXT DEFAULT 'pending',
  -- pending | running | completed | failed | partial
  apify_run_id TEXT,
  apify_dataset_id TEXT,
  error_message TEXT,
  -- Calidad
  quality_score TEXT, -- high | medium | low
  validation_report JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Catálogo curado de herramientas
CREATE TABLE actor_catalog (
  id TEXT PRIMARY KEY,
  -- ej: "compass/crawler-google-places"
  public_name TEXT NOT NULL,
  -- ej: "Buscador de Negocios"
  description TEXT,
  category TEXT,
  -- maps, social, search, ecommerce, travel, reviews
  use_cases TEXT[],
  -- descripciones en lenguaje natural para matching
  input_schema JSONB,
  output_fields TEXT[],
  pricing_model TEXT,
  typical_cost_per_1000 TEXT,
  maintainer TEXT,
  -- apify (oficial), compass, clockworks, etc.
  popularity INT,
  pairs_well_with TEXT[],
  health_check_input JSONB,
  -- input mínimo para test automático
  validation_config JSONB,
  -- reglas de validación post-scraping
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Salud de herramientas
CREATE TABLE actor_health (
  actor_id TEXT PRIMARY KEY REFERENCES actor_catalog(id),
  status TEXT DEFAULT 'unknown',
  -- healthy | degraded | down | unknown
  success_rate_7d DECIMAL(5,2),
  success_rate_30d DECIMAL(5,2),
  avg_cost_per_result DECIMAL(10,4),
  last_test_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INT DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Log de health checks
CREATE TABLE actor_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT REFERENCES actor_catalog(id),
  test_result TEXT,
  -- success | partial | failure
  results_count INT,
  cost DECIMAL(10,4),
  duration_seconds INT,
  error_message TEXT,
  tested_at TIMESTAMPTZ DEFAULT now()
);

-- Configuraciones de análisis IA
CREATE TABLE ai_analysis_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id),
  analysis_type TEXT NOT NULL,
  -- sentiment | classification | entities | summary | custom
  config JSONB NOT NULL,
  output_field_name TEXT NOT NULL,
  model TEXT DEFAULT 'haiku-4.5',
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Datos extraídos
CREATE TABLE raw_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id),
  job_id UUID REFERENCES scraping_jobs(id),
  source TEXT NOT NULL,
  -- nombre público de la herramienta
  content JSONB NOT NULL,
  -- todos los campos crudos del actor
  -- Campos IA (se llenan después)
  ai_fields JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reportes generados
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id),
  title TEXT,
  file_url TEXT,
  report_type TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transacciones de créditos
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  project_id UUID REFERENCES research_projects(id),
  amount DECIMAL(10,2) NOT NULL,
  -- positivo = compra, negativo = consumo, positivo = reembolso
  type TEXT NOT NULL,
  -- credit_purchase | scraping_cost | ai_cost | report_cost | refund
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mensajes del chat
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES research_projects(id),
  role TEXT NOT NULL, -- user | assistant
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 8. Estructura tentativa del Proyecto (no definitiva)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                # sidebar con proyectos
│   │   ├── page.tsx                  # dashboard: lista de proyectos
│   │   ├── projects/[id]/
│   │   │   ├── page.tsx              # chat + configuración + estimación
│   │   │   ├── data/page.tsx         # datos crudos + exportación
│   │   │   └── report/page.tsx       # reporte generado
│   │   └── billing/page.tsx          # créditos y transacciones
│   ├── api/
│   │   ├── chat/route.ts             # streaming + tool calling
│   │   ├── tools/
│   │   │   ├── suggest/route.ts      # buscar en catálogo curado
│   │   │   ├── [id]/config/route.ts  # schema de configuración
│   │   │   └── [id]/health/route.ts  # estado de salud
│   │   ├── scraping/
│   │   │   ├── estimate/route.ts     # estimación de costos
│   │   │   └── execute/route.ts      # lanzar ejecución
│   │   ├── analysis/route.ts         # ejecutar análisis IA
│   │   ├── export/route.ts           # generar Excel/CSV
│   │   ├── report/route.ts           # generar reporte
│   │   └── inngest/route.ts          # webhook de Inngest
│   └── layout.tsx
├── components/
│   ├── chat/
│   │   ├── chat-interface.tsx
│   │   ├── message-bubble.tsx
│   │   ├── cost-estimator.tsx        # widget de costos en tiempo real
│   │   └── tool-suggestion-card.tsx  # card de herramienta sugerida
│   ├── project/
│   │   ├── progress-tracker.tsx      # progreso del scraping
│   │   ├── data-preview.tsx          # preview de datos
│   │   └── report-viewer.tsx         # visor de reportes
│   └── ui/                           # shadcn components
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts                  # tipos generados del schema
│   ├── apify/
│   │   ├── client.ts                 # wrapper del SDK
│   │   ├── catalog.ts                # datos del catálogo curado
│   │   └── validator.ts              # validación post-scraping
│   ├── ai/
│   │   ├── chat-tools.ts             # definición de tools
│   │   ├── enrichment.ts             # batch classification + sentiment
│   │   └── report-generator.ts       # generación de reportes
│   └── inngest/
│       ├── client.ts
│       └── functions/
│           ├── run-scraping.ts       # ejecutar actor + polling
│           ├── run-analysis.ts       # batch IA
│           └── health-check.ts       # cron de health monitoring
├── hooks/
│   └── use-realtime-progress.ts
└── types/
    └── index.ts
```

---

## 9. Modelo de Negocio

### Pricing al usuario

| Plan | Costo | Incluye |
|---|---|---|
| Free | $0 | 1 mini-research (50 resultados, 1 herramienta, sin reporte) |
| Créditos | Pay-as-you-go | Desde $5. Markup 40% sobre costo real |
| Pro | $29/mes | $50 en créditos incluidos + 20% descuento en uso adicional |
| Team | $99/mes | $200 en créditos + colaboración + API |

### Costo típico por research

| Tipo de research | Costo usuario |
|---|---|
| 500 tweets sobre un tema + sentimiento + reporte | ~$5-8 |
| 100 negocios de Google Maps + contactos | ~$3-5 |
| 200 reseñas de TripAdvisor + clasificación de quejas | ~$4-7 |
| 1000 resultados multi-fuente + análisis completo + reporte | ~$10-18 |

### Unit economics

- Research promedio cobra al usuario: ~$10
- Costo real APIs (Apify + Claude): ~$6
- Margen bruto: ~$4 (40%)
- 100 usuarios × 2 researches/mes = $2,000/mes revenue, $800 margen

---

## 10. Riesgos y Mitigaciones

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Actor de Apify deja de funcionar | Media | Health monitoring + desactivación automática + fallbacks |
| Apify sube precios | Baja | Markup absorbe variación, evaluar Crawlee propio |
| Datos de baja calidad | Media | Validación post-scraping + "no data, no charge" |
| Chatbot no interpreta bien | Media | Invertir en prompt engineering, templates de research |
| Twitter/X bloquea scraping | Alta | Warning al usuario, sugerir alternativas, scraper propio |
| Usuarios no entienden el sistema | Media | Chatbot guía todo, templates pre-armados |
| Competidor copia el modelo | Baja | First mover en español/LATAM, UX superior |
| Problemas legales por scraping | Baja | Solo datos públicos, respetar robots.txt, ToS claros |

---

## 12. Features Futuros (Post-MVP)

| Feature | Impacto | Esfuerzo |
|---|---|---|
| Templates de research pre-armados | Alto | Medio |
| Research colaborativo (compartir con equipo/cliente) | Alto | Medio |
| Scheduling (repetir research semanal/mensual) | Alto | Alto |
| Comparación temporal entre researches | Medio | Medio |
| API propia para developers | Medio | Alto |
| Integración Google Sheets/Notion/Airtable | Medio | Medio |
| Subir CSV propio + aplicar análisis IA (sin scraping) | Alto | Bajo |
| Agent mode (research 100% autónomo) | Muy alto | Alto |
| Marketplace de módulos de análisis (comunidad) | Alto | Muy alto |
| Alert system (avisar si hay pico de menciones) | Medio | Medio |