# ResearchBot — Migración a Pay-Per-Use

## Misión

Reemplazar el sistema actual de **créditos prepagos** por un modelo **pay-per-use puro** donde cada research (y cada reporte) es una transacción única, pagada antes de ejecutar, con margen garantizado. Además, internacionalizar la pantalla de billing y todo el flujo nuevo de checkout.

La app es ResearchBot (Next.js 15 + Supabase + Inngest + Mercado Pago + Claude Haiku/Sonnet + Apify). Hay PRD e `idea.md` en el repo que describen el sistema actual — leelos pero asumí que parte del código real difiere del PRD (el usuario avisó que el flujo de billing actual está roto).

### Objetivo de negocio

- El usuario paga exactamente por lo que consume, una sola vez por research.
- Si quiere regenerar un reporte o generar uno nuevo con otro estilo, paga aparte.
- Nunca perdemos plata (invariante duro: `price_charged ≥ actual_cost` — siempre).
- Precio accesible pero rentable. Sin suscripciones, sin saldo, sin "welcome credits".
- Todo el dinero se ve y se cobra en el mismo checkout, antes de ejecutar.

---

## Fase 0 — Exploración obligatoria (NO tocar código aún)

1. `tree -L 3 -I 'node_modules|.next|.git|dist|build|.vercel'` del repo.
2. Leé **completos** estos archivos (buscalos por nombre aproximado — el PRD puede no coincidir con la realidad):
   - `src/app/[locale]/**/billing/**/*` (pantalla actual de billing).
   - `src/lib/payments/**/*` (MP SDK wrapper, credit helpers).
   - `src/lib/supabase/types.ts` (schema real de la DB).
   - Migraciones Supabase en `supabase/migrations/**` si existen.
   - `src/lib/inngest/functions/execute-research*` (pipeline actual).
   - `src/lib/ai/chat-tools.ts` (buscá el tool `executeResearch` y la verificación de balance).
   - Webhooks: `src/app/api/webhooks/mercadopago/route.ts`.
   - `src/messages/en.json` y `src/messages/es.json` (qué claves de billing ya existen).
   - Hook `use-credit-balance`, componente `credit-balance`, `buy-credits`, `transaction-history`.
   - RLS policies actuales sobre `transactions`.
3. Identificá el **estado real** vs el PRD:
   - ¿La tabla `transactions` existe? ¿Qué columnas tiene de verdad?
   - ¿El trigger de welcome credits existe?
   - ¿El webhook de MP está implementado y firmando?
   - ¿El flujo de reserva + reconciliación en Inngest existe o es solo PRD?
   - ¿`executeResearch` verifica balance hoy?
4. Resumime en ≤12 bullets lo que encontraste, marcando con ✅ lo que existe y funciona, ⚠️ lo que existe pero está roto/incompleto, ❌ lo que está solo en el PRD.

**Pará acá y esperá mi visto bueno antes de pasar a Fase 1.** No asumas nada.

---

## Fase 1 — Diseño: confirmar decisiones antes de implementar

Estas decisiones tienen impacto financiero y de producto. Presentámelas como un documento corto (`docs/pay-per-use-design.md`) con tus recomendaciones, y esperá confirmación antes de escribir código de dominio.

### 1.1 Fórmula de pricing (proponé concretos, no rangos)

El precio al usuario se compone de:

```
internal_cost =
    scraping_cost_estimated        // usar pricing.costPer1000.max de cada tool × volumen
  + ai_analysis_cost_estimated     // tokens_por_item × N_items_esperados, a tarifa Haiku Batch
  + report_generation_cost         // 0 si el usuario no eligió reporte; si eligió: estimar por tokens de output esperados
  + chatbot_cost_consumed          // REAL, no estimado: suma de tokens ya gastados en la sesión de chat hasta este checkout

safety_buffer = max($0.50, internal_cost × 0.15)

price_charged = round_up_to_cent( (internal_cost + safety_buffer) × markup_multiplier )
```

`markup_multiplier` **escalonado** para que tickets grandes sigan siendo accesibles:

| internal_cost    | markup_multiplier |
|------------------|-------------------|
| < $2             | 1.60              |
| $2 – $6          | 1.50              |
| $6 – $15         | 1.40              |
| > $15            | 1.35              |

**Precio mínimo absoluto:** $1.50 USD (cubre payment processing + overhead mínimo).

Estos números son una propuesta. En tu doc de diseño, **calculalos con los costos reales del catálogo de tools** (Apify pricing × volúmenes típicos del MVP) y mostrame 4 ejemplos realistas: (a) 100 reviews de Google Maps sin reporte, (b) 500 tweets con sentiment y reporte, (c) 50 resultados de Google Search sin AI, (d) 1000 tweets multi-análisis con reporte premium. Quiero ver tabla `{internal, buffer, markup, price_user, margen_$, margen_%}`.

**Si mis números propuestos producen precios poco competitivos o márgenes irreales, proponé alternativos con justificación.** No es sagrado, pero el invariante sí.

### 1.2 Cost cap en runtime (crítico)

Durante la ejecución en Inngest, después de cada step relevante (por ejemplo, cada tool scraping terminada, o cada batch AI completado), recalcular `actual_cost_accumulated`. Si:

```
actual_cost_accumulated >= price_charged × 0.85
```

→ **abortar gracefully**: marcar `research_orders.status = 'completed_partial'`, entregar lo que haya, registrar métrica `cap_triggered=true`. No hay refund al usuario (ya se le entrega valor parcial). Sí hay alerta interna.

El umbral 0.85 da colchón de 15% por si el último step parcial se pasa. Justificá en el doc si proponés otro.

### 1.3 Refund policy

| Situación | Acción |
|---|---|
| Order creada, usuario no paga en 30 min | `expired`, no se toca MP, nada más |
| Pago exitoso, falla ANTES de llamar a Apify | Refund 100% vía MP API, orden → `refunded` |
| Pago exitoso, falla después de gastar en APIs | Refund `price_charged - actual_cost × markup_multiplier_floor` con piso en $0. Es decir: devolvemos el markup proporcional del trabajo no hecho, nunca devolvemos por debajo del costo real. |
| Cap triggered (completed_partial) | Sin refund. Se entrega valor parcial. |
| Reporte generado pero el usuario lo regenera | Sin refund. Cada generación es una order separada. |

En el doc, enumerá exactamente qué endpoints de MP se usan para refund, y cómo se manejan errores del refund API (si falla, marcar `refund_pending`, cron retry).

### 1.4 Estrategia de chatbot cost

El chatbot (Claude Haiku 4.5) consume tokens durante la planificación. Proponer e implementar UNA de estas estrategias (recomiendo la B por simplicidad y transparencia):

- **A — Tracking granular:** middleware en `/api/chat/route.ts` acumula `input_tokens + output_tokens` por project_id en una tabla `chat_token_usage`. En checkout, leer el total y convertirlo a USD.
- **B — Flat fee:** cobrar $0.05 fijo por research para cubrir el chatbot (los costos reales rondan $0.005-0.02, margen sobrado).
- **C — Híbrido:** A pero con piso de $0.02 y techo de $0.20.

Elegir A, B o C justificando. **La B es el default recomendado.**

### 1.5 Selección de tipo de reporte

Antes del checkout, el usuario elige:
- `none` → $0 agregado al precio. Puede generarlo después en otra order.
- `standard` → el que hoy genera Sonnet 4.6. Presupuestar tokens realistas.
- `advanced` → versión con más análisis estadístico (si lo implementás como variante del prompt). Puede salir post-MVP, pero dejá el campo en la DB preparado.

En `research_orders.report_type` guardar el elegido. Order posterior para regenerar/cambiar reporte = nueva order con `kind='report'` (ver 1.6).

### 1.6 Dos tipos de order

```typescript
type OrderKind = 'research' | 'report';
```

- `research`: scraping + AI analysis + chatbot + (opcional) reporte inicial.
- `report`: **solo** generación de reporte sobre un project ya existente con datos. Precio mucho menor, típicamente $0.50-$1.50. Cada regeneración o cambio de tipo → nueva order `kind='report'`.

**Un project solo puede tener UNA order `research` de por vida**, pero N orders `report`.

---

**Stop acá, mostrame el doc de diseño, esperá mi ok. No avances a Fase 2 sin aprobación explícita.**

---

## Fase 2 — Schema + migraciones

Crear migración SQL nueva (`supabase/migrations/<timestamp>_pay_per_use.sql`). Sigan existiendo las tablas de negocio (`research_projects`, `scraping_jobs`, `raw_data`, `reports`, `chat_messages`), pero:

### 2.1 Nueva tabla `research_orders`

```sql
CREATE TABLE research_orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES profiles(id),
  project_id           UUID NOT NULL REFERENCES research_projects(id),
  kind                 TEXT NOT NULL CHECK (kind IN ('research','report')),
  status               TEXT NOT NULL DEFAULT 'pending_payment'
                       CHECK (status IN (
                         'pending_payment','paid','executing',
                         'completed','completed_partial','failed',
                         'refunded','refund_pending','expired'
                       )),

  -- Pricing (inmutable una vez creada; si cambia algo, nueva order)
  estimated_internal_cost_usd DECIMAL(10,4) NOT NULL,
  safety_buffer_usd           DECIMAL(10,4) NOT NULL,
  markup_multiplier           DECIMAL(5,3)  NOT NULL,
  price_charged_usd           DECIMAL(10,4) NOT NULL,
  cost_breakdown              JSONB NOT NULL,   -- {scraping, ai_analysis, report, chatbot, buffer, markup_amount}
  price_local                 DECIMAL(10,2),    -- opcional, en moneda MP
  price_local_currency        TEXT,

  -- Configuración congelada (lo que se va a ejecutar)
  config_snapshot             JSONB NOT NULL,   -- tools elegidas, volúmenes, keywords, AI configs, report_type
  report_type                 TEXT NOT NULL DEFAULT 'none'
                              CHECK (report_type IN ('none','standard','advanced')),

  -- Pago
  payment_provider            TEXT NOT NULL DEFAULT 'mercadopago',
  payment_preference_id       TEXT,              -- MP preference.id
  payment_id                  TEXT,              -- MP payment.id
  payment_status              TEXT,              -- raw MP status
  payment_url                 TEXT,              -- init_point
  paid_at                     TIMESTAMPTZ,
  refund_id                   TEXT,
  refunded_amount_usd         DECIMAL(10,4),
  refunded_at                 TIMESTAMPTZ,

  -- Ejecución
  actual_cost_usd             DECIMAL(10,4),
  cap_triggered               BOOLEAN DEFAULT false,
  execution_started_at        TIMESTAMPTZ,
  execution_completed_at      TIMESTAMPTZ,
  failure_reason              TEXT,

  -- Timeline
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX idx_research_orders_user ON research_orders(user_id, created_at DESC);
CREATE INDEX idx_research_orders_project ON research_orders(project_id);
CREATE INDEX idx_research_orders_status ON research_orders(status) WHERE status IN ('pending_payment','executing','refund_pending');
CREATE UNIQUE INDEX ux_research_orders_payment_id ON research_orders(payment_id) WHERE payment_id IS NOT NULL;
```

RLS: `user_id = auth.uid()`. Inserts y updates desde el cliente denegados — todo pasa por server-side.

### 2.2 Sobre la tabla `transactions` existente

No la borres. Reusala o renombrala a `payment_events` según lo que encuentres:
- Si tiene referencias en código → mantenela, agregá columna `order_id UUID REFERENCES research_orders(id)` y dejá de usar los types `credit_purchase`, `scraping_reserve`, etc. Los tipos nuevos: `order_payment`, `order_refund`.
- Si no tiene uso real → migrate los datos relevantes a `research_orders` y deprecá.

**Preservá historia:** no borres datos de usuarios existentes (si los hay). Si hay usuarios con balance positivo, incluí un script que emita refund vía MP por el balance remanente (con log, y decisión mía antes de correrlo).

### 2.3 Eliminá welcome credits

- Borrar el trigger de Supabase que inserta `+$3` al crear profile.
- En `lib/payments/credits.ts` (o equivalente), deprecar `getCreditBalance` — conservá la función pero con `@deprecated` y que devuelva `0` + log de uso para detectar llamadores que falten migrar.

### 2.4 Relación order ↔ project

- `research_projects` agrega `current_order_id UUID REFERENCES research_orders(id)`.
- Un project en `status='draft'` puede tener una order `pending_payment` activa a lo sumo. Al crear otra, cancelar/expirar la anterior (idempotente).
- Al completarse una research order, `research_projects.status` pasa a `completed` o `completed_partial`.

---

## Fase 3 — Motor de estimación (`lib/pricing/`)

Módulo nuevo con responsabilidad única: calcular `estimated_internal_cost_usd` y `cost_breakdown` para una configuración dada. Determinístico, puro, testeable.

```typescript
// lib/pricing/types.ts
export interface PricingInput {
  tools: Array<{ toolId: string; config: ToolConfig; estimatedResults: number }>;
  aiAnalyses: Array<{ type: AnalysisType; estimatedItems: number }>;
  reportType: 'none' | 'standard' | 'advanced';
  chatbotCostUsd: number;   // del tracking de sesión, o flat fee según 1.4
  currency?: 'USD';
}

export interface PricingOutput {
  internalCostUsd: number;
  safetyBufferUsd: number;
  markupMultiplier: number;
  priceChargedUsd: number;
  breakdown: {
    scraping: Array<{ toolId: string; cost: number }>;
    aiAnalysis: Array<{ type: string; cost: number }>;
    report: number;
    chatbot: number;
    buffer: number;
    markupAmount: number;
  };
  warnings: string[];  // ej: "tool X tiene health=degraded, precio puede variar"
}

export function quotePricing(input: PricingInput): PricingOutput;
```

### Reglas de implementación

- Importar el catálogo estático existente (`lib/apify/catalog.ts`). Para cada tool, usar `pricing.costPer1000.max × (estimatedResults / 1000)`.
- AI analysis por tipo: mantener en `lib/pricing/constants.ts` un mapa `{ sentiment: { tokensPerItem: 400 }, classification: { tokensPerItem: 300 }, ... }`. Precios Haiku Batch en constantes con fecha de última actualización.
- Report: tokens esperados por tipo (`standard`: ~3000 output tokens, `advanced`: ~6000).
- Chatbot: según la estrategia elegida en 1.4. Default flat $0.05.
- Precio mínimo piso de $1.50 — si el cálculo da menos, elevar y loguear.
- Redondeo: siempre HACIA ARRIBA al centavo (nunca truncar hacia abajo — podría generar `price < internal_cost` en edge case).

### Tests obligatorios

- Todas las tiers del markup escalonado.
- Precio mínimo enforcement.
- Cada combinación de `reportType × n_tools × n_analyses`.
- Invariante: `price_charged ≥ internal_cost × 1.15` en el 100% de los casos generados por fuzz (100+ inputs random).
- Snapshot de los 4 ejemplos de Fase 1.1.

---

## Fase 4 — Lifecycle de la order

### 4.1 Estados y transiciones

```
                     pay → paid ───────────┐
pending_payment ──┬──                      │
                  ├── expire (30') → expired
                  └── cancel → expired
                                           │
paid ──► executing ──┬──► completed ◄──────┘
                     ├──► completed_partial (cap)
                     ├──► failed ──► refund_pending ──► refunded
                     └──► refund_pending (pre-Apify failure) ──► refunded
```

Cada transición en UNA función server-side con validación de estado. Nunca update directo desde el cliente. Máquina de estados explícita en `lib/orders/state-machine.ts`.

### 4.2 API routes nuevas

- `POST /api/orders` → crea order + MP preference. Body: `{ projectId, reportType }`. Server consulta project, arma `PricingInput`, llama `quotePricing`, inserta order, crea preference en MP, retorna `{ orderId, paymentUrl, breakdown, priceCharged }`.
- `GET /api/orders/:id` → estado actual (polling del frontend si es necesario).
- `POST /api/orders/:id/cancel` → solo si `pending_payment`, marca `expired`.
- `POST /api/webhooks/mercadopago` → ya existe, adaptarlo: verificar HMAC, buscar order por `payment_preference_id`, idempotente, transición `pending_payment → paid`, dispatch Inngest event `research/execute` con `orderId`.

### 4.3 Idempotencia de webhook

MP puede mandar el mismo webhook N veces. Reglas:
- Buscar por `payment_id`. Si existe order con ese `payment_id` y status ≥ `paid`, retornar 200 sin hacer nada.
- Si status es `pending_payment` y MP reporta `approved`, transicionar y disparar Inngest.
- Lock optimista con `WHERE status = 'pending_payment'` en el UPDATE.
- Log estructurado: `{orderId, mpPaymentId, mpStatus, action}`.

### 4.4 Cron de expiración

Inngest cron cada 5 min: `UPDATE research_orders SET status='expired' WHERE status='pending_payment' AND expires_at < now()`.

### 4.5 Integración con Inngest existente

En `execute-research.ts`:
- Primer step: `loadOrder(orderId)` — si no está `paid`, abort con log.
- Transicionar `paid → executing`.
- Después de cada job scraping completo y después de cada batch AI, calcular `actual_cost_accumulated` y comparar con cap (Fase 1.2). Si se triggera, abort gracefully.
- Al terminar: calcular `actual_cost_usd`, update order con `completed` o `completed_partial`, timestamp, liberar proyecto.
- Si fallas tempranas → disparar event `order/refund` que ejecuta función `refund-order.ts`.

### 4.6 `refund-order.ts`

Nueva función Inngest. Llama MP refund API. Si falla → marca `refund_pending` y reintenta vía cron con backoff (max 24h, después alerta operativa).

---

## Fase 5 — UI + i18n

### 5.1 Internacionalización del billing actual (PRIORITARIO)

1. Auditar la pantalla actual `/[locale]/billing` y todos sus subcomponentes. Listar **todos** los strings hardcodeados.
2. Agregar keys a `messages/en.json` y `messages/es.json` bajo namespace `billing.*`.
3. Reemplazar por `useTranslations('billing')`.
4. Formateo de montos: usar `Intl.NumberFormat(locale, { style: 'currency', currency })`, nunca template strings con `$`.
5. Formateo de fechas: `Intl.DateTimeFormat`.

### 5.2 Rediseño de `/[locale]/billing`

Nueva estructura (sin "balance", sin "buy credits"):

- **Tabs:** "Historial" | "Pendientes de pago" | "Reembolsos".
- **Historial:** tabla de orders completed/completed_partial/refunded. Columnas: fecha, project title (link), tipo (research/report), precio pagado, estado, acciones (ver reporte, descargar recibo).
- **Pendientes:** orders `pending_payment` no expiradas. Botón "Pagar ahora" (abre MP) y "Cancelar".
- **Reembolsos:** orders con `refunded` o `refund_pending`. Muestra monto y motivo.
- Filtros: rango de fechas, estado, project.

### 5.3 Nueva pantalla de checkout: `/[locale]/projects/[id]/checkout`

1. Llega desde el chat cuando el usuario confirma research.
2. Server component que:
   - Valida ownership del project.
   - Recupera config del chat (tools + AI analyses elegidas).
   - Recibe query param `reportType` o default `none`.
   - Llama `quotePricing` server-side.
3. UI:
   - **Resumen del research** (read-only, tools, volúmenes, keywords).
   - **Selector de reporte** con precios visibles en tiempo real (tabs: ninguno / estándar / avanzado).
   - **Breakdown del precio** (colapsable) con cada componente como línea.
   - **Total destacado** en grande.
   - **Botón "Pagar $X y ejecutar"** → llama `POST /api/orders` y redirige a `payment_url`.
   - **Disclaimer**: "El precio es final. No se devolverá el cobro excepto en caso de fallo del sistema. Ver términos."
4. Cambiar el selector de reporte recalcula el precio **vía API** (no duplicar la lógica de pricing en el cliente; el cliente solo muestra).

### 5.4 Pantallas de retorno de MP

- `/[locale]/checkout/success?order_id=...` — "Pago recibido. Tu research se está ejecutando" + link al project.
- `/[locale]/checkout/failure?order_id=...` — "El pago no se completó" + botón reintentar (abre MP preference de nuevo si no expiró).
- `/[locale]/checkout/pending?order_id=...` — "Pago en proceso" (efectivo, Rapipago, etc.).

### 5.5 Chatbot: eliminar verificación de balance

- En `lib/ai/chat-tools.ts`, el tool `executeResearch` cambia: ya no verifica balance ni crea transactions. Redirige al frontend a `/projects/[id]/checkout` devolviendo un `{ action: 'redirect_checkout', url }` que el componente de chat intercepta.
- Remover del system prompt cualquier mención a "créditos" / "credits" / "balance" / "welcome credits". Reemplazar por mensajes sobre pricing transparente y pago por research.

### 5.6 Generación posterior de reporte

- En `/[locale]/projects/[id]/report`, si el project ya tiene `status in ('completed','completed_partial')` y el usuario quiere generar un nuevo reporte (o cambiar tipo): botón "Generar reporte ($X)" que crea una order `kind='report'`, flujo idéntico al checkout.
- Mostrar historial de reports generados con su order correspondiente.

---

## Fase 6 — Deprecación limpia del sistema de créditos

1. Eliminar componentes: `buy-credits.tsx`, `credit-balance.tsx`.
2. `transaction-history.tsx` → reutilizar como `order-history.tsx` con datos nuevos.
3. Hooks: `use-credit-balance` → borrar. Reemplazar usos por `use-user-orders`.
4. Borrar lógica de "reserve → reconcile" en execute-research. Ya no aplica: el precio es fijo.
5. Endpoint antiguo `/api/credits/purchase` (si existe) → eliminar.
6. System prompt del chatbot: ningún string "credits", "saldo", "comprar".
7. Buscá con grep global por `credit`, `balance`, `welcome` y validá que cada ocurrencia sea intencional o removela.

---

## Fase 7 — Observabilidad + testing

### 7.1 Logs estructurados por order

Cada transición de estado: `{ orderId, userId, projectId, fromStatus, toStatus, actualCost, priceCharged, margin, capTriggered, durationMs }`.

### 7.2 Métricas a agregar (dashboard interno o logs con tags)

- `orders.created`, `orders.paid`, `orders.expired`, `orders.refunded`.
- `orders.margin_usd` (histograma: `priceCharged - actualCost`).
- `orders.cap_triggered_rate` — **si supera 5%, alarma**: la estimación es muy agresiva.
- `orders.negative_margin_count` — **debe ser 0**. Si >0, bug crítico en estimación o cap.
- Tiempo medio `created → paid` y `paid → completed`.

### 7.3 Tests

- **Unit:** `quotePricing` (cubrimiento total de tiers + edge cases).
- **Unit:** state machine de orders (transiciones válidas/invalidas).
- **Integration:** webhook de MP idempotente (simular mismo payload 5 veces, verificar 1 transición).
- **Integration:** cost cap (mockear jobs que exceden presupuesto, verificar partial).
- **Integration:** refund flow pre-Apify (order `paid` → failure temprano → refund 100%).
- **E2E** (Playwright): crear project → chat → checkout → pagar (mock MP sandbox) → ver research ejecutando → ver reporte → generar segundo reporte (nueva order).
- **i18n smoke:** render de `/[locale]/billing` y `/checkout` en `en` y `es`, assert que no hay strings hardcodeados detectables (helper que busca patterns como `>\s*[A-Z][a-z]+\s*<` en tests).

---

## Fase 8 — Analytics de conversión (funnel tracking)

Con pay-per-use, la métrica que importa pasa a ser **cuántos usuarios que llegan al checkout efectivamente pagan**. Necesitás data desde el día 1 para iterar el pricing con base empírica, no con intuición.

### 8.1 Eventos del funnel

Trackear server-side (tabla `analytics_events`) y client-side (para abandonos) los siguientes eventos, en este orden cronológico:

| Evento | Dónde se dispara | Payload mínimo |
|---|---|---|
| `project_created` | Servidor, al crear `research_projects` | `{ userId, projectId, locale }` |
| `chat_first_message` | Servidor, primer mensaje user | `{ userId, projectId }` |
| `tools_suggested` | Servidor, cuando `searchTools` retorna | `{ projectId, toolIds: string[] }` |
| `config_completed` | Servidor, cuando el chat tiene tools+keywords+volumen definidos | `{ projectId, toolCount, estimatedResults }` |
| `checkout_viewed` | Cliente, al montar la página de checkout | `{ projectId, estimatedPriceUsd, reportType }` |
| `report_type_changed` | Cliente, cada vez que cambia el selector | `{ projectId, from, to, newPriceUsd }` |
| `checkout_abandoned` | Cliente, beforeunload si no llegó a `payment_started` | `{ projectId, timeOnPageMs, priceShownUsd }` |
| `payment_started` | Servidor, al crear la order + preference MP | `{ orderId, projectId, priceChargedUsd, reportType }` |
| `payment_completed` | Servidor, en webhook de MP al pasar a `paid` | `{ orderId, priceChargedUsd, timeToPaymentMs }` |
| `payment_failed` | Servidor, webhook con status rejected | `{ orderId, reason }` |
| `payment_expired` | Servidor, cron que marca expired | `{ orderId, priceChargedUsd }` |
| `execution_completed` | Servidor, al completarse Inngest | `{ orderId, actualCostUsd, marginUsd, capTriggered, durationMs }` |
| `report_regenerated` | Servidor, al crear order `kind='report'` | `{ orderId, projectId, reportType, priceChargedUsd }` |

### 8.2 Tabla `analytics_events`

```sql
CREATE TABLE analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  event_name  TEXT NOT NULL,
  user_id     UUID REFERENCES profiles(id),
  project_id  UUID REFERENCES research_projects(id),
  order_id    UUID REFERENCES research_orders(id),
  payload     JSONB NOT NULL DEFAULT '{}',
  session_id  TEXT,           -- para correlacionar client events con el mismo visitante
  locale      TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_name_time ON analytics_events(event_name, created_at DESC);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_events_project ON analytics_events(project_id);
CREATE INDEX idx_analytics_events_order ON analytics_events(order_id) WHERE order_id IS NOT NULL;

-- RLS: sin lectura desde cliente (solo server con service role). Inserts vía API route /api/analytics.
```

PII: el payload JSONB **no** debe incluir contenido del chat, keywords, ni datos scrapeados. Solo métricas. Documentar esto en `lib/analytics/README.md`.

### 8.3 Módulo `lib/analytics/`

```typescript
// lib/analytics/events.ts
export type AnalyticsEventName =
  | 'project_created' | 'chat_first_message' | 'tools_suggested' | 'config_completed'
  | 'checkout_viewed' | 'report_type_changed' | 'checkout_abandoned'
  | 'payment_started' | 'payment_completed' | 'payment_failed' | 'payment_expired'
  | 'execution_completed' | 'report_regenerated';

export interface TrackEventInput {
  event: AnalyticsEventName;
  userId?: string;
  projectId?: string;
  orderId?: string;
  payload?: Record<string, unknown>;
  sessionId?: string;
}

// Server-side: inserta directo en Supabase con service role, no-throw (nunca romper el flujo).
export async function trackEvent(input: TrackEventInput): Promise<void>;

// Client-side: POST a /api/analytics, batch + beacon para abandonos.
export function trackClientEvent(input: TrackEventInput): void;
```

**Regla de oro:** analytics nunca rompe el flujo de negocio. Wrap todo en try/catch, log errors, nunca re-throw. Si Supabase está caído, el pago igual se procesa.

### 8.4 Endpoint `/api/analytics`

POST only. Rate limit por session: 60 eventos/min. Valida nombre del evento contra whitelist. Rechaza eventos con `user_id` distinto al del caller (si hay sesión). Para usuarios no autenticados, aceptar con `session_id` cookie.

Usa `navigator.sendBeacon()` en el cliente para `checkout_abandoned` — así el evento se envía aunque el usuario cierre la pestaña.

### 8.5 Vistas SQL para el funnel

Crear vistas materializadas (refresh diario vía cron Inngest) que den respuestas inmediatas a las preguntas clave:

```sql
-- Vista 1: conversión etapa por etapa (últimos 30 días)
CREATE MATERIALIZED VIEW v_funnel_30d AS
SELECT
  COUNT(DISTINCT CASE WHEN event_name='project_created'    THEN project_id END) AS projects,
  COUNT(DISTINCT CASE WHEN event_name='chat_first_message' THEN project_id END) AS chats_started,
  COUNT(DISTINCT CASE WHEN event_name='config_completed'   THEN project_id END) AS configs_completed,
  COUNT(DISTINCT CASE WHEN event_name='checkout_viewed'    THEN project_id END) AS checkouts_viewed,
  COUNT(DISTINCT CASE WHEN event_name='payment_started'    THEN project_id END) AS payments_started,
  COUNT(DISTINCT CASE WHEN event_name='payment_completed'  THEN order_id END)   AS payments_completed
FROM analytics_events
WHERE created_at > now() - interval '30 days';

-- Vista 2: abandono por rango de precio (detectar si hay umbral psicológico)
CREATE MATERIALIZED VIEW v_abandonment_by_price AS
SELECT
  width_bucket((payload->>'priceShownUsd')::numeric, 0, 50, 10) AS price_bucket,
  COUNT(*) FILTER (WHERE event_name='checkout_viewed') AS viewed,
  COUNT(*) FILTER (WHERE event_name='payment_completed') AS paid,
  ROUND(100.0 * COUNT(*) FILTER (WHERE event_name='payment_completed')
               / NULLIF(COUNT(*) FILTER (WHERE event_name='checkout_viewed'), 0), 2) AS conversion_pct
FROM analytics_events
WHERE created_at > now() - interval '30 days'
  AND event_name IN ('checkout_viewed','payment_completed')
GROUP BY price_bucket
ORDER BY price_bucket;

-- Vista 3: distribución de elección de report_type
CREATE MATERIALIZED VIEW v_report_type_distribution AS
SELECT
  payload->>'reportType' AS report_type,
  COUNT(*) AS paid_orders,
  AVG((payload->>'priceChargedUsd')::numeric) AS avg_price_usd
FROM analytics_events
WHERE event_name='payment_completed' AND created_at > now() - interval '30 days'
GROUP BY payload->>'reportType';

-- Vista 4: tiempo medio de decisión (checkout viewed → payment completed)
CREATE MATERIALIZED VIEW v_time_to_pay AS
WITH viewed AS (
  SELECT project_id, MIN(created_at) AS viewed_at
  FROM analytics_events WHERE event_name='checkout_viewed' GROUP BY project_id
),
paid AS (
  SELECT project_id, MIN(created_at) AS paid_at
  FROM analytics_events WHERE event_name='payment_completed' GROUP BY project_id
)
SELECT
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (paid_at - viewed_at))) AS p50_sec,
  PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (paid_at - viewed_at))) AS p90_sec
FROM viewed JOIN paid USING (project_id);
```

### 8.6 Dashboard interno (mínimo viable)

Crear `/[locale]/admin/analytics` (protegido por flag `profiles.is_admin`) que muestre:

1. **Funnel completo** — gráfico de barras decreciente con tasa de conversión entre etapas.
2. **Conversión por rango de precio** — identifica si hay un price point donde la conversión cae en picada.
3. **Distribución de report_type** — cuántos eligen `none` / `standard` / `advanced`.
4. **Margen promedio por order** — distribución + P50/P90.
5. **Cap trigger rate** — % de orders ejecutadas que tocaron el cap.
6. **Tasa de abandono de checkout** — `abandoned / viewed`.
7. **Time-to-pay P50/P90** — cuánto tarda un usuario en pagar una vez ve el checkout.

Usar shadcn `<Chart>` (Recharts) para los gráficos. No metas librerías nuevas.

### 8.7 A/B testing hook (opcional pero recomendado desde el inicio)

Dejá un mecanismo simple para experimentar con pricing:

```typescript
// lib/analytics/experiments.ts
export function getExperimentVariant(userId: string, experiment: string): 'A' | 'B';
```

Hash determinístico `hash(userId + experimentName) % 2`. Guardá la variante en `analytics_events.payload.variant`. Así podés A/B testear markup multipliers, orden de las opciones de reporte, copy del botón de checkout, etc., sin infra extra.

No actives ningún experimento en MVP — solo que el código esté listo.

### 8.8 Privacidad y retention

- No loguear nunca: contenido de mensajes del chat, keywords, contenido scrapeado, tokens de auth.
- IP y user-agent solo en eventos server. No en client events.
- Retention: purge automático de eventos > 365 días (cron mensual Inngest). Agregados en vistas materializadas sobreviven.
- Mencionar en política de privacidad que se recolectan métricas de uso anónimas.

### 8.9 Tests

- `trackEvent` nunca throwea, incluso con Supabase caído (mock rejection, assert que el caller sigue).
- Endpoint `/api/analytics` rechaza eventos fuera de whitelist (400).
- Rate limit se activa a los 60 eventos/min por session.
- Vistas materializadas se refrescan sin error en fixture de 10k eventos.

---

## Invariantes duros (no los viole nunca)

1. **`price_charged ≥ internal_cost_estimated × 1.15`** — enforced en `quotePricing`.
2. **`price_charged ≥ $1.50`** — enforced en `quotePricing`.
3. **`order.actual_cost_usd ≤ price_charged`** en el 99.9% de los casos. Si >, log CRITICAL, alarma operativa. El cap en runtime debe prevenir esto.
4. **Una order `paid` solo pasa a `executing` una sola vez** — idempotencia del webhook.
5. **Ninguna order se ejecuta sin `status='paid'`** — primer step del Inngest function lo valida.
6. **El refund nunca devuelve más de `price_charged - max(internal_cost_real, 0)`** — el usuario paga mínimo nuestro costo real.
7. **El cliente nunca calcula precios** — siempre server-side vía `quotePricing`. El cliente solo muestra.
8. **El chatbot no menciona "créditos"** — ningún texto del sistema ni del prompt.
9. **Analytics nunca rompe el flujo** — try/catch + log, nunca re-throw.

---

## Restricciones duras (NO HACER)

- ❌ No mantener el sistema de créditos "por si acaso". Se reemplaza por completo.
- ❌ No duplicar la lógica de pricing en el cliente.
- ❌ No insertar strings hardcodeados en UI nueva (todo i18n desde el minuto 0).
- ❌ No confiar en MP sobre el estado del pago: siempre consultar `GET /v1/payments/{id}` para verificar antes de transicionar.
- ❌ No usar `any` en `lib/pricing`, `lib/orders` ni `lib/analytics`. Si realmente hace falta, comentar por qué.
- ❌ No mandar notificaciones por email sin pasar por locale (cuando las agregues).
- ❌ No lanzar la deprecación en producción sin script de migración de usuarios existentes (refund de balances remanentes).
- ❌ No incluir PII (contenido de chat, keywords, datos scrapeados) en eventos de analytics.

---

## Criterios de aceptación

El feature está listo cuando:

1. ✅ Un usuario nuevo sin `welcome credits` puede registrarse, crear project, chatear, llegar al checkout, pagar con MP sandbox, ver su research ejecutado, y descargar reporte — todo sin ver jamás la palabra "saldo" / "créditos" / "balance".
2. ✅ El mismo flujo funciona en locale `en` y `es`, con formateo de moneda correcto en cada uno.
3. ✅ Los 4 ejemplos de pricing de Fase 1.1 coinciden con los valores reales calculados en producción para las mismas entradas.
4. ✅ Tests unit + integration + e2e pasan en CI.
5. ✅ `grep -rn "buy-credits\|credit-balance\|useCreditBalance" src/` no devuelve nada.
6. ✅ Generar un segundo reporte del mismo project crea una order `kind='report'` con precio correcto (solo el costo del reporte + buffer + markup).
7. ✅ Simulación de cap: un Inngest job mockeado que intenta gastar más que `price × 0.85` se aborta y la order queda `completed_partial`.
8. ✅ Simulación de webhook duplicado (5 llamadas con mismo `payment_id`): la order transiciona a `paid` exactamente una vez, Inngest dispara exactamente un event.
9. ✅ Dashboard/logs muestran `margin_usd > 0` en el 100% de las orders completadas de test.
10. ✅ Pantalla de billing antigua completamente migrada, sin regresiones, y el PR incluye screenshots en `en` y `es`.
11. ✅ Un flujo e2e completo genera al menos 6 eventos de analytics en orden correcto (`project_created` → ... → `execution_completed`), todos visibles en `analytics_events`.
12. ✅ El dashboard `/admin/analytics` renderiza sin errores con el fixture de eventos y muestra el funnel.

---

## Orden sugerido de implementación

1. Fase 0 (exploración) — mostrame el resumen.
2. Fase 1 (doc de diseño) — mostrame el doc, esperá ok.
3. Fase 2 (migraciones) + Fase 3 (pricing module con tests) — se pueden solapar.
4. Fase 4 (orders + webhook + Inngest integration).
5. Fase 5 (UI + i18n) — checkout primero, billing después.
6. Fase 6 (cleanup / deprecation).
7. Fase 7 (observabilidad + tests faltantes).
8. Fase 8 (analytics) — dejala al final para que las vistas trabajen sobre el flujo ya estable, pero los eventos se instrumentan en cada fase (no lo dejes todo para el final).
9. PR único grande con commits atómicos por fase, o PR por fase mergeando a una branch integradora. Preferí la segunda.

**Empezá por Fase 0 y esperá mi aprobación antes de avanzar.**