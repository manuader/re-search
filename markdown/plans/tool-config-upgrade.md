# ResearchBot — Configuración avanzada de herramientas de scraping

## Misión

Elevar la configuración de los scrapers de Apify de "solo keywords + volumen" a una configuración rica, transparente y editable. El chatbot debe aprovechar **todos los parámetros relevantes** de cada tool (rangos de fecha, idioma, geografía, filtros de engagement, tipo de contenido, ordenamiento, etc.) y guiar al usuario a la granularidad que necesita. El panel derecho del chat se convierte en una **vista viva** de la configuración actual donde el usuario puede editar keywords y tools, y ve el precio recalcular en tiempo real.

### Problema concreto que motivó esta iteración

Un usuario pidió investigar opinión pública sobre un político en Twitter y obtuvo 1000 tweets todos de abril de 2026 (los más recientes). Le hubiera gustado distribuir el dataset temporalmente: "500 tweets de los últimos 30 días, 300 del último año, 200 de períodos históricos". Hoy no tiene forma de expresar eso. Además, cambió "tweets en español" por default sin pedírselo, o asumió "todos los idiomas" sin confirmación. El chatbot debe **preguntar antes de asumir** en los parámetros que materialmente afectan el dataset.

### Objetivo de diseño

- El chatbot sabe **qué parámetros soporta cada tool** y los usa para precisar el pedido.
- El chatbot **pregunta en el idioma del usuario** con opciones claras ("¿querés solo tweets recientes, una muestra del último año, o una distribución temporal balanceada?"), no con nombres de campos técnicos.
- El **panel derecho** muestra la config completa, editable, con recalculo de precio en vivo.
- El usuario puede agregar/editar keywords, cambiar tools, ajustar volúmenes, cambiar rangos de fecha — y el precio se actualiza antes del checkout.
- **Configuraciones avanzadas opcionales**: el usuario casual no se ahoga en parámetros, pero el poweruser puede entrar a "modo avanzado" y tocar todo lo que la tool soporta.

---

## Fase 0 — Exploración obligatoria

Antes de tocar nada:

1. Leer `lib/apify/catalog.ts` completo. Listar cada tool disponible y los campos que hoy se guardan en su `config`.
2. Para cada tool del catálogo, leé la documentación del actor en Apify (web, buscalo por actor ID) y listá **todos** los parámetros del `input schema` soportados. Esto es research, no código — dame una tabla `tool × parámetro × tipo × default × efecto sobre el dataset`.
3. Leer `lib/ai/chat-tools.ts` completo, especialmente el tool `searchTools` / `suggestTool` o similar, y el tool que confirma la configuración antes del checkout.
4. Leer el system prompt actual del chatbot (`lib/ai/system-prompt.ts` o similar).
5. Revisar el componente del panel derecho (`components/chat/config-panel.tsx` o nombre similar). Entender qué muestra hoy.
6. Leer el módulo de pricing (`lib/pricing/`) para entender qué inputs consume hoy y cómo tendría que cambiar si agregamos parámetros que afectan volumen (ej. un `dateRange` más amplio puede requerir más páginas de Apify y por lo tanto más costo).
7. Resumime en ≤12 bullets lo que encontraste, con ✅/⚠️/❌. **Es crítico el paso 2** — sin la tabla de parámetros por tool no podés avanzar.

**Pará acá y esperá aprobación.** Mandame la tabla del paso 2 adjunta al resumen.

---

## Fase 1 — Modelo de datos: schema de parámetros por tool

### 1.1 Principio

No hardcodear parámetros por tool en UI ni en el chatbot. Cada tool del catálogo declara su **schema de parámetros** de forma estructurada. El chatbot, el panel derecho, el validador y el pricing consumen ese schema. Agregar una tool nueva o un parámetro nuevo a una tool existente **no debe requerir tocar la UI ni el prompt** — solo extender el schema.

### 1.2 Tipos

```typescript
// lib/apify/tool-schema.ts

export type ParamKind =
  | 'text'
  | 'number'
  | 'boolean'
  | 'enum'                // single select
  | 'multi_enum'          // multi select
  | 'date_range'          // {from, to}
  | 'date_distribution'   // [{bucket, percentage}] — para el caso Milei
  | 'geo'                 // country/region/coords
  | 'keyword_list';       // lista editable de strings

export interface ParamOption {
  value: string;
  labelKey: string;        // i18n key, ej 'tools.twitter.params.language.options.es'
  descriptionKey?: string;
}

export interface ToolParam {
  id: string;              // id estable, ej 'dateRange', 'language', 'minLikes'
  apifyField: string;      // nombre del campo en el input schema del actor
  kind: ParamKind;
  labelKey: string;
  descriptionKey: string;
  placeholderKey?: string;

  // Metadatos que usan chatbot, UI, validador y pricing
  importance: 'critical' | 'high' | 'medium' | 'low';
  //   critical: siempre preguntar (keywords, dateRange para search actors)
  //   high:     preguntar si el brief no lo define (language, geo)
  //   medium:   ofrecer en "avanzado" (sort, includeReplies)
  //   low:      raramente tocado (tech flags)

  advanced?: boolean;      // true => solo en "modo avanzado" del panel

  // Constraints
  required?: boolean;
  default?: unknown;
  min?: number; max?: number;
  options?: ParamOption[]; // para enum/multi_enum

  // Impacto en el costo
  affectsVolume?: boolean;          // si cambia este param, se recalcula `estimatedResults`
  volumeMultiplier?: (value: unknown, base: number) => number;
  // ej: para dateRange, rangos más largos no aumentan volumen (el usuario define el target),
  //     pero para `includeReplies: true`, multiplicador 1.4x porque el actor baja más data.

  // Validación custom
  validate?: (value: unknown, allParams: Record<string, unknown>) => string | null;

  // Compatibilidad: este param solo aplica si otro tiene cierto valor
  dependsOn?: { paramId: string; equals: unknown };
}

export interface ToolSchema {
  toolId: string;          // coincide con catalog
  paramGroups: Array<{
    id: string;             // 'essentials' | 'filters' | 'advanced' | 'temporal' | 'engagement'
    labelKey: string;
    params: ToolParam[];
  }>;

  // Validación cross-parameter (ej. si language='es', geo no debería ser 'JP')
  crossValidate?: (config: Record<string, unknown>) => Array<{ paramId: string; message: string }>;

  // Para el chatbot: preguntas sugeridas que debe hacer si estos params quedan sin definir
  clarifyingQuestions?: Array<{
    paramIds: string[];          // params que cubre la pregunta
    promptTemplateKey: string;   // i18n key, soporta interpolación {brief}
    triggerIf: 'missing' | 'critical_missing' | 'high_importance_missing';
  }>;
}
```

### 1.3 Schemas concretos a implementar (MVP)

Al menos estos, basados en la Fase 0 paso 2:

- **Twitter/X search actor** → el caso urgente. Params mínimos:
  - `keywords` (critical, keyword_list)
  - `dateRange` (critical, date_range) — `{from, to}`
  - `dateDistribution` (high, date_distribution) — opcional, para el pedido del ejemplo. Si se usa, el scraping se parte en N sub-runs con rangos distintos.
  - `language` (high, enum: es, en, pt, fr, de, any)
  - `geo` (high, geo)
  - `minLikes`, `minReposts`, `minViews` (medium, number) — filtros de engagement
  - `includeReplies` (medium, boolean, affects volume)
  - `includeRetweets` (medium, boolean, affects volume)
  - `sort` (medium, enum: latest, top, relevant)
  - `verifiedOnly` (medium, boolean)
  - `excludeKeywords` (medium, keyword_list)
- **Instagram / TikTok search** — análogos donde aplique.
- **Google Maps Reviews** →
  - `placeQuery` (critical, text) o `placeIds` (critical, keyword_list)
  - `dateRange` (high, date_range)
  - `language` (high, enum)
  - `minRating`, `maxRating` (medium, number 1–5)
  - `sort` (medium, enum: relevant, newest, highest, lowest)
  - `includeOwnerResponses` (medium, boolean, affects volume)
- **LinkedIn posts** →
  - `keywords`, `dateRange`, `sort`, `postType`, `industry` (multi_enum), `seniority` (multi_enum), `language`.
- **Google Search** →
  - `query`, `language`, `geo`, `dateRange`, `resultType` (enum: web, news, images), `excludeDomains` (keyword_list).

Agregá más según lo que encontraste en Fase 0. **El schema debe reflejar lo que el actor real soporta, no lo que nos gustaría soportar.**

### 1.4 Distribución temporal (caso especial del ejemplo)

Este es el patrón que resuelve el pedido del usuario de Milei. Definir un parámetro tipo `date_distribution`:

```typescript
type DateDistribution = Array<{
  bucket: string;          // label i18n o libre: "last_week", "last_month", "last_year", "historical"
  from: string;            // ISO date
  to: string;              // ISO date
  targetResults: number;   // cuántos tweets de este bucket
}>;
```

Presets en i18n (ES default):
- **"Solo lo más reciente"** → un único bucket, últimos 30 días, 100% del volumen.
- **"Distribución balanceada"** → 40% último mes, 30% últimos 6 meses, 20% último año, 10% histórico.
- **"Análisis temporal completo"** → 25/25/25/25 en 4 buckets definidos por el chatbot según el dateRange total.
- **"Personalizado"** → el usuario define los buckets y porcentajes en el panel.

En ejecución, el backend crea N scraping jobs de Apify (uno por bucket) en vez de uno, sumando los resultados al mismo project. Esto implica cambios en Inngest (ver Fase 4).

### 1.5 Migración SQL

`scraping_jobs` ya tiene `config JSONB`. Solo asegurarse que el schema nuevo encaja. Agregar:

```sql
ALTER TABLE scraping_jobs
  ADD COLUMN IF NOT EXISTS bucket_label TEXT,    -- para distribución temporal
  ADD COLUMN IF NOT EXISTS parent_job_id UUID REFERENCES scraping_jobs(id);
  -- Si un tool corre con date_distribution, se crean N jobs hijos del mismo parent
```

---

## Fase 2 — Integración con el chatbot

### 2.1 Cambios en el system prompt

El system prompt actual probablemente dice algo como "suggest tools and keywords". Hay que reescribirlo para que:

1. Antes de cerrar una configuración, itere por los params `importance='critical'` que quedaron sin definir y **pregunte explícitamente**.
2. Para params `high`, pregunte si el brief del usuario no los menciona ni implica.
3. Nunca asuma valores para params que afectan materialmente el dataset (dateRange, language, geo) — prefiere preguntar sobre asumir.
4. Cuando ofrece `date_distribution`, use lenguaje humano: "¿te interesan solo los tweets más recientes, o querés una muestra distribuida en el tiempo para ver evolución?"
5. Resuma la config completa antes del checkout, en lenguaje natural: "Vamos a scrapear ~500 tweets en español sobre 'milei reelección', de los últimos 6 meses, con al menos 10 likes, ordenados por relevancia. ¿Procedemos?"

Fragmento del prompt (adaptar al tono actual):

```
When suggesting a tool, you have access to its parameter schema via the `getToolSchema` tool.
NEVER finalize a research configuration without having a value for every CRITICAL parameter.
For HIGH-importance parameters, ask the user unless the brief clearly implies a value.
For MEDIUM/LOW parameters, use sensible defaults but mention the most impactful ones briefly
("I'll include replies by default — let me know if you want only original posts").

For time-sensitive research on social media, ALWAYS clarify temporal scope:
- If the user cares about current opinion → recent window (last weeks).
- If the user cares about evolution/trends → offer date_distribution.
- If unclear → ask which of these they want.

When presenting the final config, describe it in natural language using the user's locale,
not as a JSON dump. Ask for confirmation before updating the config panel.

You are speaking in ${locale}. Use the same language for all questions and summaries.
```

### 2.2 Nuevos tools del chatbot (function calling)

Agregar al `lib/ai/chat-tools.ts`:

```typescript
// Obtener el schema completo de una tool para razonar sobre qué preguntar
getToolSchema(toolId: string) → ToolSchema

// Actualizar la configuración del project en curso
updateProjectConfig(input: {
  toolId: string;
  params: Record<string, unknown>;   // parcial — merge con lo existente
  estimatedResults?: number;
}) → { ok: true, newPriceUsd: number }

// Agregar/remover una tool al project
addToolToProject(toolId: string, initialConfig: Record<string, unknown>) → { ok: true, newPriceUsd: number }
removeToolFromProject(toolId: string) → { ok: true, newPriceUsd: number }

// Sugerir una date_distribution basada en un brief
suggestDateDistribution(input: {
  totalTargetResults: number;
  researchIntent: 'current_snapshot' | 'evolution' | 'historical_comparison';
  spanStart?: string; spanEnd?: string;
}) → DateDistribution

// Resumir la config en lenguaje natural para confirmar con el usuario
summarizeConfig(projectId: string) → { summary: string; priceUsd: number; warnings: string[] }
```

### 2.3 Validaciones automáticas del chatbot

Cuando el modelo llama `updateProjectConfig`, el server-side corre:
- El `validate` de cada param modificado.
- El `crossValidate` del schema.
- Si hay errores, retorna `{ ok: false, errors }` al modelo y **el modelo debe informar al usuario en lenguaje natural** en su próxima turn, no "función falló con error X".

### 2.4 Regla anti-alucinación

El chatbot **no inventa** IDs de tools, nombres de parámetros ni valores de enums. Siempre obtiene `getToolSchema` primero. Si intenta llamar `updateProjectConfig` con un `paramId` que no existe en el schema, el server retorna error descriptivo y el modelo corrige.

---

## Fase 3 — Panel derecho: vista viva + editor

### 3.1 Ubicación y estructura

Componente `components/chat/research-config-panel.tsx`. Tres secciones colapsables:

1. **Resumen** (siempre visible, arriba)
   - Title del project (editable).
   - Tools activas (chips con ícono).
   - Volumen estimado total (ej "~850 items").
   - **Precio estimado grande**, con breakdown colapsable al click.
   - Botón primario "Ir al checkout" — deshabilitado si hay errores de validación.

2. **Keywords** (siempre visible)
   - Lista editable de chips. Cada chip tiene ✕ para quitar.
   - Input "Agregar keyword". Submit con Enter o coma.
   - Sub-chip de `excludeKeywords` si aplica (color distinto, prefijo "−").
   - Drag-reorder (opcional, post-MVP).
   - Cambio → debounce 400ms → llama `PATCH /api/projects/:id/config` → recalcula precio.

3. **Herramientas** (expandible por cada tool)
   - Cada tool es una card.
   - Header: nombre, costo aprox, toggle para activar/desactivar.
   - Body: params agrupados por `paramGroup.id`.
     - Grupos `essentials` y `filters` abiertos por default.
     - Grupo `advanced` colapsado, con CTA "Mostrar opciones avanzadas".
   - Cada param renderiza según su `kind` (ver 3.2).
   - Footer: "Volumen target" slider + estimado de costo para esta tool.

### 3.2 Renderers por `ParamKind`

Crear `components/chat/param-inputs/` con un archivo por kind:

- `text` → `<Input>` con debounce.
- `number` → `<Input type="number">` con min/max. Si tiene pasos útiles (ej. `minLikes`), mostrar sugerencias rápidas (0, 10, 100, 1k).
- `boolean` → `<Switch>` con label y descripción.
- `enum` → `<Select>` (con labels i18n de `ParamOption.labelKey`).
- `multi_enum` → `<CheckboxGroup>` o `<MultiSelect>`.
- `date_range` → `<DateRangePicker>` con presets ("últimos 7 días", "último mes", "último año", "personalizado").
- `date_distribution` → **componente especial** (ver 3.3).
- `geo` → `<Combobox>` con países (ISO 3166), opcional región/ciudad.
- `keyword_list` → igual que el de keywords pero a nivel de tool (algunos tools aceptan keywords distintas a las globales).

Todos los renderers:
- Son controlled components.
- Emiten cambios al padre que debounce-patchea al server.
- Muestran error inline si el `validate` del schema falla.
- Son accesibles (labels asociados, keyboard nav, ARIA).

### 3.3 Componente `DateDistributionEditor`

Critical UX. Diseño:

- Toggle inicial: **Preset** | **Personalizado**.
- **Preset** → 4 cards clicables con los presets de 1.4 ("Solo reciente", "Balanceada", "Temporal completa", "Personalizada"). Cada card muestra un mini-gráfico de barras ilustrativo.
- **Personalizado** → tabla editable:
  | Bucket (label) | From | To | % del target | Items estimados |
  | "Último mes"   | ...  | ... | 40%         | 400             |
  - Botón "+ Agregar bucket".
  - Suma de % debe dar 100%. Si no, error visible.
  - Los buckets no pueden solaparse. Si se solapan, warning pero no bloqueo (algunos actors aceptan overlap).
- Preview visual: timeline horizontal con segmentos coloreados por bucket, proporcionales al %.

### 3.4 Recalcular precio

Cada cambio dispara:
1. Debounce 400ms.
2. `PATCH /api/projects/:id/config` con la config completa actualizada.
3. Server corre `quotePricing` con la config nueva y devuelve `{ priceUsd, breakdown, warnings }`.
4. UI actualiza el precio mostrado con una pequeña animación (fade in el nuevo valor).
5. Si hay `warnings` (ej. "este filtro puede reducir mucho los resultados"), mostrarlos como banner amarillo arriba del panel.

Evitar thrashing: cancelar requests en vuelo si llega un cambio nuevo (AbortController).

### 3.5 Sincronización chatbot ↔ panel

Cuando el chatbot llama `updateProjectConfig`, el server:
1. Actualiza la DB.
2. Emite un evento por Supabase Realtime al canal `project:${projectId}`.
3. El panel está suscripto a ese canal y se actualiza sin reload.
4. Visualmente, resaltar con un flash breve (2s, color `#60a5fa` de fondo) los campos que el chatbot modificó — así el usuario ve qué cambió.

Al revés: cuando el usuario edita en el panel, el chatbot debe enterarse. Inyectar al siguiente turn del chat un system message invisible: "The user manually updated the config. Current state: {summary}". Así si le preguntan "¿por qué agregaste ese filtro?", el modelo sabe que no fue él.

### 3.6 Modo "avanzado" global

Toggle arriba del panel: "Modo avanzado". Cuando está OFF, los params con `advanced: true` no se ven en ninguna tool. Cuando está ON, se ven todos. Persistir la preferencia en `profiles.ui_preferences`.

---

## Fase 4 — Backend: ejecución con parámetros expandidos

### 4.1 Traducción schema → input de Apify

Cada tool tiene una función `mapConfigToApifyInput(config: Record<string, unknown>): object` que transforma los params semánticos (`dateRange`, `minLikes`) en el formato exacto que espera el actor (`since`, `until`, `minFaves`, lo que sea).

Este mapper vive en `lib/apify/mappers/<toolId>.ts`. Uno por tool. Tests unitarios obligatorios:

- Inputs típicos → output correcto.
- Edge cases: arrays vacíos, undefined, nulls.
- Fecha ISO → formato esperado por el actor.
- Validación de que todos los campos críticos del actor estén presentes.

### 4.2 Ejecución con `date_distribution`

Si la config tiene `dateDistribution`, el Inngest function `execute-research` expande ese job en N sub-jobs:

```
scraping_job (parent, tool=twitter) [kind: parent, no ejecuta]
├── scraping_job (bucket=last_month, target=400) [kind: child, ejecuta actor]
├── scraping_job (bucket=last_6_months, target=300) [kind: child, ejecuta actor]
├── scraping_job (bucket=last_year, target=200) [kind: child, ejecuta actor]
└── scraping_job (bucket=historical, target=100) [kind: child, ejecuta actor]
```

Cada child se ejecuta en paralelo (o secuencial si queremos controlar rate-limits de Apify). Al completar todos, el parent se marca `completed` y sus resultados agregados son la suma de los children.

**Cost cap de pay-per-use:** evaluar después de cada child, no solo al final. Si el total acumulado pasa el 85% del precio cobrado, abortar children pendientes.

### 4.3 Pricing actualizado

`quotePricing` ahora recibe la config expandida. Para params que tengan `affectsVolume` o `volumeMultiplier`, aplicar el multiplicador antes de calcular costo de scraping:

```typescript
const effectiveResults = baseTargetResults
  * product(schema.params.filter(p => p.affectsVolume).map(p => p.volumeMultiplier(config[p.id], baseTargetResults)));
```

Para `dateDistribution`, el costo es la suma del costo de cada bucket (cada uno corre como un sub-job con su propio `targetResults`).

Tests:
- Config con 1 tool y 1000 results → costo esperado.
- Misma config con `includeReplies: true` y multiplier 1.4 → 40% más costo.
- `dateDistribution` de 4 buckets con target total 1000 → costo similar a 1000 de un solo bucket (en realidad un poco mayor porque Apify cobra por start).

### 4.4 Persistir config resuelta

En `scraping_jobs.config`, guardar la config **resuelta** (después de todos los defaults aplicados), no la parcial. Esto garantiza que un job que corre hoy y otro mañana con "la misma config" efectivamente tuvieron los mismos params, aunque el schema cambie en el medio.

---

## Fase 5 — i18n completo

Todo lo que el usuario ve (labels, descripciones, opciones de enum, placeholders, mensajes de error, presets, warnings) vive en `messages/en.json` y `messages/es.json` bajo el namespace `tools.<toolId>.*`.

Ejemplo:

```json
{
  "tools": {
    "twitter_search": {
      "name": "Twitter / X Search",
      "groups": {
        "essentials": "Esenciales",
        "temporal": "Temporal",
        "filters": "Filtros de engagement",
        "advanced": "Avanzado"
      },
      "params": {
        "keywords": { "label": "Palabras clave", "description": "Términos a buscar en los tweets" },
        "dateRange": { "label": "Rango de fechas", "description": "Período de publicación de los tweets" },
        "dateDistribution": {
          "label": "Distribución temporal",
          "description": "Cómo distribuir los tweets en el tiempo",
          "presets": {
            "recent_only": "Solo lo más reciente",
            "balanced": "Distribución balanceada",
            "temporal_full": "Análisis temporal completo",
            "custom": "Personalizado"
          }
        },
        "language": {
          "label": "Idioma",
          "options": {
            "es": "Español",
            "en": "Inglés",
            "any": "Cualquiera"
          }
        },
        "minLikes": { "label": "Likes mínimos", "description": "Excluir tweets con menos de X likes" }
      }
    }
  }
}
```

Helper `useToolI18n(toolId, paramId)` que resuelve labels y descripciones con fallback a la key si falta traducción (y loguea una vez en dev).

---

## Fase 6 — Testing

### 6.1 Unit tests

- **Schemas:** cada `ToolSchema` se puede importar, todas las keys de i18n referenciadas existen (test que lee `messages/es.json` y verifica que cada `labelKey` tenga entrada).
- **Mappers:** `mapConfigToApifyInput` para cada tool, con fixtures.
- **Validators:** `validate` y `crossValidate` para cada tool con casos válidos/inválidos.
- **Pricing:** multiplicadores por param funcionando, especialmente `dateDistribution`.

### 6.2 Integration tests

- `PATCH /api/projects/:id/config` con partial config → merge correcto, validación, recalculo de precio.
- `POST /api/projects/:id/tools` agrega tool con default config.
- El chatbot tool `updateProjectConfig` falla gracefully con paramId inválido.
- `execute-research` expande `dateDistribution` en N children correctamente.
- Cost cap se evalúa después de cada child.

### 6.3 E2E

- Flow Milei:
  1. Usuario pide "opinión pública sobre Milei".
  2. Chatbot pregunta por scope temporal.
  3. Usuario dice "distribuido en el tiempo para ver evolución".
  4. Chatbot aplica preset `temporal_full`.
  5. Panel derecho muestra 4 buckets.
  6. Usuario edita un bucket manualmente en el panel.
  7. Precio recalcula.
  8. Checkout → ejecuta 4 sub-jobs.
  9. Dataset final contiene items distribuidos en los 4 buckets (verificar con metadata `bucket_label` en raw_data).

- Flow Google Maps Reviews:
  1. Usuario pide "reviews de un restaurante".
  2. Chatbot pregunta `placeQuery` (critical) y `language` (high).
  3. Chatbot ofrece filtros de rating ("¿querés solo reviews críticas o todas?").
  4. Panel muestra params.
  5. Usuario activa modo avanzado, cambia `sort` a `newest`.
  6. Precio se mantiene (sort no afecta volumen).
  7. Checkout ejecuta.

### 6.4 Regression guard

Test que itera por todo el catálogo de tools y garantiza:
- Cada tool tiene `ToolSchema` registrada.
- Cada param tiene `labelKey` y `descriptionKey` presentes en `messages/es.json` y `messages/en.json`.
- Cada tool tiene `mapConfigToApifyInput`.
- Cada param con `options` tiene labels para todas las options.

---

## Invariantes duros

1. El chatbot **nunca** finaliza una config sin haber resuelto todos los params `critical`.
2. El chatbot **nunca** inventa un `paramId` o valor de enum que no esté en `ToolSchema`.
3. El panel y el chatbot ven siempre el mismo estado (DB + Supabase Realtime como source of truth).
4. Toda edición del panel dispara recalculo server-side de precio — el cliente nunca calcula.
5. `date_distribution` se ejecuta como N sub-jobs con `parent_job_id`, no como un solo job con merge posterior.
6. El cost cap se evalúa entre sub-jobs, no solo al final.
7. Cada `ToolSchema` tiene i18n completo en todos los locales soportados.
8. Ningún componente del panel hardcodea parámetros de una tool específica — todo se renderiza desde `ToolSchema`.

---

## Restricciones duras (NO HACER)

- ❌ No hardcodear lógica de un actor específico en el componente del panel. Todo por schema.
- ❌ No duplicar pricing en el cliente.
- ❌ No asumir defaults silenciosos en params `critical` o `high` — preguntar.
- ❌ No exponer el mapper `mapConfigToApifyInput` al cliente (la config que el cliente ve es la semántica, no la Apify raw).
- ❌ No aceptar `dateDistribution` donde los buckets suman >100% o <100%.
- ❌ No ejecutar sub-jobs de `dateDistribution` sin evaluar cost cap entre ellos.
- ❌ No agregar tools al catálogo sin su `ToolSchema`, mapper e i18n en el mismo PR.
- ❌ No usar `any` en `lib/apify/tool-schema.ts` ni en mappers.

---

## Criterios de aceptación

1. ✅ El flow Milei funciona: el usuario puede distribuir 1000 tweets en 4 buckets temporales, y el dataset final lo refleja (verificado por query SQL sobre `raw_data.bucket_label`).
2. ✅ En el catálogo de tools, agregar un parámetro nuevo a una tool existente (ej. `sort` a Twitter) requiere tocar solo `tool-schema.ts`, el mapper y los `messages/*.json` — ningún componente UI.
3. ✅ Editar una keyword en el panel actualiza el precio en <1s (debounce 400ms + query).
4. ✅ Agregar/remover una tool desde el panel funciona sin pasar por el chat.
5. ✅ El chatbot pregunta por `dateRange` cuando hace research social y el brief no lo define.
6. ✅ El chatbot resume la config en lenguaje natural antes del checkout, no como JSON.
7. ✅ Si el chatbot cambia la config, el panel muestra el cambio en tiempo real con flash visual.
8. ✅ Si el usuario cambia la config en el panel, el chatbot sabe el estado actualizado en su próximo turn.
9. ✅ Modo avanzado oculta/muestra los params `advanced: true` correctamente y persiste la preferencia.
10. ✅ El test de regression guard pasa para todas las tools del catálogo.
11. ✅ i18n completo - test que falla si falta alguna key referenciada.
12. ✅ Cost cap aborta la ejecución correctamente entre sub-jobs de un `dateDistribution` cuando la simulación supera el 85%.
13. ✅ Un param que no existe en la tool del actor (ej. `minLikes` en Google Maps Reviews) no aparece en su panel ni puede ser enviado por el chatbot.

---

## Orden sugerido de implementación

1. Fase 0 (exploración + tabla de params por tool) — mandame la tabla.
2. Fase 1.1–1.3 (tipos + schemas de 2–3 tools prioritarias, empezar por Twitter que es la del pedido).
3. Fase 4.1 (mappers de esas tools) + tests unitarios.
4. Fase 2 (chatbot tools nuevos + system prompt actualizado).
5. Fase 3 (panel derecho — empezar con renderers básicos, después `DateDistributionEditor`).
6. Fase 4.2–4.4 (backend de `dateDistribution` + pricing).
7. Fase 1.3 completar con el resto de tools del catálogo.
8. Fase 5 (i18n completo).
9. Fase 6 (tests).

**Empezá por Fase 0. No escribas código hasta que apruebe la tabla.**