# ResearchBot — Dashboard Admin

## Misión

Construir un dashboard interno para administradores que permita: monitorear costos de todas las APIs (Apify, Claude Haiku/Sonnet, Mercado Pago fees), auditar gastos de usuarios, observar la salud operativa de la app, y detectar anomalías financieras antes de que escalen. El dashboard es **solo lectura en MVP** y los admins se crean **exclusivamente desde Supabase** (no hay UI ni endpoint para otorgar permisos).

El sistema asume que ya están implementadas las fases de la migración a pay-per-use: existen `research_orders`, `analytics_events`, `scraping_jobs.actual_cost`, `ai_analysis_configs.actual_cost`, `actor_health` y el catálogo de tools. Si algo de eso falta, pará y avisame antes de construir sobre aire.

### Principios de diseño

El dashboard de admin es el **radio de explosión más alto** de la app. Si un admin compromete su cuenta, el atacante ve gastos, márgenes, estructura de costos, y potencialmente PII de usuarios. Por eso la arquitectura se rige por tres reglas no negociables:

1. **Defensa en profundidad.** Middleware + verificación en cada API route + RLS en Supabase. Si una capa falla, la siguiente contiene.
2. **Read-only por defecto.** Ningún endpoint admin puede mutar orders, transactions, users, ni pricing. Las mutaciones se agregan después, con diseño explícito y doble validación.
3. **Todo auditado.** Cada visita a datos sensibles queda registrada en `admin_audit_log` con admin_id, ruta, filtros aplicados y timestamp.

---

## Fase 0 — Exploración obligatoria

Antes de escribir código:

1. Confirmá que existen las tablas `research_orders`, `analytics_events`, `scraping_jobs`, `ai_analysis_configs`, `actor_health`, `profiles`.
2. Verificá si `profiles` ya tiene alguna columna tipo `role`, `is_admin`, o similar. Si existe, entendé cómo se usa antes de agregar otra.
3. Listá las API routes existentes bajo `src/app/api/**` para no colisionar con prefijos.
4. Buscá si hay middleware (`src/middleware.ts`) y entendé cómo maneja locales y auth hoy.
5. Confirmá que `next-intl` está configurado y que `messages/en.json` y `messages/es.json` existen.
6. Resumime en ≤8 bullets lo que encontraste, marcando ✅/⚠️/❌.

**Pará y esperá mi ok antes de Fase 1.** Si falta alguna de las fuentes de datos asumidas, no continuamos.

---

## Fase 1 — Modelo de seguridad (crítico)

### 1.1 Schema: flag de admin y audit log

Migración nueva: `supabase/migrations/<timestamp>_admin_dashboard.sql`.

```sql
-- 1. Flag de admin en profiles (si no existe ya algo similar)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_granted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_granted_by UUID REFERENCES profiles(id);

-- 2. Audit log — una fila por acción admin (view sensible o mutation futura)
CREATE TABLE admin_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    UUID NOT NULL REFERENCES profiles(id),
  action      TEXT NOT NULL,         -- 'view_user_detail' | 'view_order_detail' | 'export_orders_csv' | 'refund_triggered' | ...
  resource    TEXT,                  -- 'user:uuid' | 'order:uuid' | null
  filters     JSONB,                 -- filtros/query params aplicados
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_admin_time ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action, created_at DESC);
CREATE INDEX idx_admin_audit_log_resource ON admin_audit_log(resource) WHERE resource IS NOT NULL;

-- 3. RLS: el audit log NO es legible por usuarios normales, ni siquiera por admins por cliente
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
-- (no policies = ningún acceso vía anon/authenticated key. Solo service_role lee/escribe.)

-- 4. Helper function: chequear is_admin desde otras policies
CREATE OR REPLACE FUNCTION is_admin(user_id UUID) RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = user_id), FALSE);
$$;

-- 5. Política de provisioning: solo service_role puede setear is_admin
-- Los clientes anon/authenticated NO pueden hacer UPDATE sobre is_admin.
-- Esto se enforza con una RLS policy explícita sobre profiles:

CREATE POLICY "users cannot self-elevate"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
    AND admin_granted_at IS NOT DISTINCT FROM (SELECT admin_granted_at FROM profiles WHERE id = auth.uid())
    AND admin_granted_by IS NOT DISTINCT FROM (SELECT admin_granted_by FROM profiles WHERE id = auth.uid())
  );
```

### 1.2 Cómo se crea un admin

**Única vía: SQL editor de Supabase, ejecutado manualmente por un humano con acceso al proyecto.**

```sql
-- Ejecutar MANUALMENTE en Supabase SQL editor:
UPDATE profiles
SET is_admin = TRUE,
    admin_granted_at = now(),
    admin_granted_by = NULL  -- NULL para el primer admin (bootstrap)
WHERE email = 'founder@researchbot.com';

-- Para admins posteriores, usá el UUID de un admin ya existente como granted_by:
UPDATE profiles
SET is_admin = TRUE,
    admin_granted_at = now(),
    admin_granted_by = '<uuid-del-admin-que-lo-otorga>'
WHERE email = 'teammate@researchbot.com';
```

Documentar este procedimiento en `docs/admin-provisioning.md`. No agregar ningún endpoint, UI, CLI ni script automatizable que haga esto. **Si alguien propone un "formulario de invitación de admins", rechazalo — viola el modelo.**

Para revocar:
```sql
UPDATE profiles SET is_admin = FALSE WHERE id = '<uuid>';
```

### 1.3 MFA recomendado (no blocker de MVP)

Documentar en el mismo `docs/admin-provisioning.md` que toda cuenta admin **debe** tener MFA habilitado en Supabase Auth (TOTP). Esto se configura en el dashboard de Supabase por cuenta, no en código. En una fase futura, agregar un check en middleware que verifique `user_metadata.mfa_enabled === true` para admins y los fuerce a habilitar MFA antes de acceder al panel.

### 1.4 Middleware: primera línea de defensa

Extender `src/middleware.ts`. Para toda ruta que matchee `/[locale]/admin/**` o `/api/admin/**`:

1. Verificar sesión válida de Supabase. Si no, redirect a login (rutas UI) o 401 (API).
2. Cargar `profiles.is_admin` para el `user_id` de la sesión. **Esta query se hace cada request** — no cachear en cookie/JWT, porque revocar un admin tiene que tener efecto inmediato. Aceptar el costo de ~1 query por request admin (es tráfico bajo).
3. Si `is_admin !== true` → 404 en rutas UI (no 403: no revelar la existencia del panel), 404 JSON en API.
4. Si sí → continuar, y adjuntar `x-admin-id` a los headers del request (para que las API routes ya lo tengan resuelto).

```typescript
// Pseudo-código del middleware
if (pathname.startsWith(`/${locale}/admin`) || pathname.startsWith('/api/admin')) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return pathname.startsWith('/api/') ? json(401) : redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single();

  if (!profile?.is_admin) {
    // 404 intencional: no revela que la ruta existe
    return pathname.startsWith('/api/') ? json(404) : notFound();
  }
  req.headers.set('x-admin-id', user.id);
}
```

### 1.5 Defensa por capas

- **Capa 1 (middleware):** bloquea acceso a rutas admin.
- **Capa 2 (API route):** cada handler admin re-verifica `is_admin` antes de ejecutar. No confiar en headers del middleware — un bug de routing podría saltarlo.
- **Capa 3 (Supabase RLS):** todas las queries del dashboard usan el cliente con la cookie del usuario. Las vistas/tablas exponen policies que permiten `SELECT` a `is_admin(auth.uid())`. Si el middleware y la API route fallan, la DB dice no.
- **Capa 4 (audit log):** cada hit a endpoints admin que tocan datos sensibles inserta en `admin_audit_log` antes de retornar.

### 1.6 Rate limit en endpoints admin

60 req/min por admin. No es defensa contra humano legítimo — es defensa contra credenciales comprometidas que scripteen exfiltración. Implementar en middleware o en wrapper de route.

---

## Fase 2 — Vistas SQL para métricas

Materializar las métricas pesadas. Evita queries lentas en cada render y desacopla el dashboard del costo en DB. Refresh cada 15 min vía Inngest cron.

```sql
-- === COSTOS APIS ===

-- Gasto interno total por día, desglosado por fuente
CREATE MATERIALIZED VIEW v_admin_daily_costs AS
SELECT
  date_trunc('day', o.execution_completed_at)::date AS day,
  COUNT(*) AS orders_completed,
  SUM(o.actual_cost_usd)                    AS total_internal_cost_usd,
  SUM((o.cost_breakdown->>'chatbot')::numeric)   AS chatbot_cost_usd,
  SUM((o.cost_breakdown->>'report')::numeric)    AS report_cost_usd,
  SUM(o.price_charged_usd)                  AS total_revenue_usd,
  SUM(o.price_charged_usd - o.actual_cost_usd) AS total_margin_usd,
  AVG(o.price_charged_usd - o.actual_cost_usd) AS avg_margin_usd
FROM research_orders o
WHERE o.status IN ('completed','completed_partial')
  AND o.execution_completed_at IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;

-- Costo de Apify por tool (últimos 30 días)
CREATE MATERIALIZED VIEW v_admin_apify_cost_by_tool AS
SELECT
  sj.tool_id,
  sj.tool_name,
  COUNT(*)                        AS runs,
  SUM(sj.actual_cost)             AS total_cost_usd,
  AVG(sj.actual_cost)             AS avg_cost_per_run,
  SUM(sj.actual_results)          AS total_results,
  CASE WHEN SUM(sj.actual_results) > 0
       THEN SUM(sj.actual_cost) / SUM(sj.actual_results) * 1000
       ELSE NULL END              AS effective_cost_per_1000,
  COUNT(*) FILTER (WHERE sj.status='failed')::float / COUNT(*) AS failure_rate,
  MAX(sj.completed_at)            AS last_run_at
FROM scraping_jobs sj
WHERE sj.created_at > now() - interval '30 days'
  AND sj.actual_cost IS NOT NULL
GROUP BY sj.tool_id, sj.tool_name
ORDER BY total_cost_usd DESC;

-- Costo de Claude (Haiku batch + Sonnet reports), últimos 30 días
CREATE MATERIALIZED VIEW v_admin_claude_cost AS
SELECT
  date_trunc('day', a.created_at)::date AS day,
  'haiku_batch'                         AS model,
  SUM(a.actual_cost)                    AS cost_usd,
  COUNT(*)                              AS batches
FROM ai_analysis_configs a
WHERE a.actual_cost IS NOT NULL
  AND a.created_at > now() - interval '30 days'
GROUP BY 1
UNION ALL
SELECT
  date_trunc('day', o.execution_completed_at)::date AS day,
  'sonnet_report'                       AS model,
  SUM((o.cost_breakdown->>'report')::numeric) AS cost_usd,
  COUNT(*) FILTER (WHERE o.report_type <> 'none') AS reports
FROM research_orders o
WHERE o.status IN ('completed','completed_partial')
  AND o.execution_completed_at > now() - interval '30 days'
GROUP BY 1
ORDER BY day DESC, model;

-- === USUARIOS ===

-- Spending por usuario (lifetime)
CREATE MATERIALIZED VIEW v_admin_user_spending AS
SELECT
  p.id                              AS user_id,
  p.email,
  p.locale,
  p.created_at                      AS user_created_at,
  COUNT(DISTINCT o.id)              AS orders_paid,
  COUNT(DISTINCT o.project_id)      AS projects_paid,
  COALESCE(SUM(o.price_charged_usd), 0) AS lifetime_revenue_usd,
  COALESCE(SUM(o.actual_cost_usd), 0)   AS lifetime_internal_cost_usd,
  COALESCE(SUM(o.price_charged_usd - o.actual_cost_usd), 0) AS lifetime_margin_usd,
  MAX(o.paid_at)                    AS last_paid_at
FROM profiles p
LEFT JOIN research_orders o
       ON o.user_id = p.id
      AND o.status IN ('completed','completed_partial','refunded')
GROUP BY p.id, p.email, p.locale, p.created_at
ORDER BY lifetime_revenue_usd DESC NULLS LAST;

-- === SALUD OPERATIVA ===

-- Orders con estado "atascado" que requieren intervención
CREATE MATERIALIZED VIEW v_admin_stuck_orders AS
SELECT
  o.id, o.user_id, o.project_id, o.status,
  o.price_charged_usd, o.created_at, o.execution_started_at,
  EXTRACT(EPOCH FROM (now() - COALESCE(o.execution_started_at, o.created_at))) / 60 AS stuck_minutes,
  o.failure_reason
FROM research_orders o
WHERE
  (o.status = 'executing'      AND o.execution_started_at < now() - interval '45 minutes') OR
  (o.status = 'refund_pending' AND o.created_at            < now() - interval '1 hour')    OR
  (o.status = 'paid'           AND o.paid_at               < now() - interval '10 minutes')
ORDER BY stuck_minutes DESC;

-- Anomalías de margen: orders donde cobramos menos que el costo (debería ser 0)
CREATE MATERIALIZED VIEW v_admin_margin_anomalies AS
SELECT
  o.id, o.user_id, o.price_charged_usd, o.actual_cost_usd,
  (o.actual_cost_usd - o.price_charged_usd) AS loss_usd,
  o.cap_triggered, o.execution_completed_at, o.cost_breakdown
FROM research_orders o
WHERE o.status IN ('completed','completed_partial')
  AND o.actual_cost_usd IS NOT NULL
  AND o.actual_cost_usd > o.price_charged_usd
ORDER BY loss_usd DESC;

-- Cap trigger rate (últimos 30 días)
CREATE MATERIALIZED VIEW v_admin_cap_trigger_rate AS
SELECT
  date_trunc('day', execution_completed_at)::date AS day,
  COUNT(*) AS total_completed,
  COUNT(*) FILTER (WHERE cap_triggered) AS cap_triggered_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cap_triggered) / NULLIF(COUNT(*), 0), 2) AS cap_trigger_pct
FROM research_orders
WHERE status IN ('completed','completed_partial')
  AND execution_completed_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 1 DESC;

-- Health de actors (leer de actor_health directo — ya es liviana)
-- Tasa de falla de webhooks de MP (requiere una tabla mp_webhook_events; si no existe, usar logs de Vercel/Inngest)
```

### Refresh

Inngest cron `*/15 * * * *` que corre `REFRESH MATERIALIZED VIEW CONCURRENTLY v_admin_*`. Log duración de cada refresh — si alguna pasa de 30s, rediseñar.

### RLS sobre las vistas

Las vistas materializadas en Postgres no respetan RLS por defecto. Para exponerlas solo a admins:

```sql
-- Crear una SECURITY DEFINER function que lea la vista y validá is_admin adentro.
CREATE OR REPLACE FUNCTION admin_daily_costs()
RETURNS SETOF v_admin_daily_costs
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM v_admin_daily_costs;
END;
$$;

-- Repetir el patrón para cada vista. El cliente invoca vía Supabase RPC.
-- Alternativa: no exponer las vistas por RLS — leerlas desde API routes con service_role
-- después de verificar is_admin en el server. Es más simple. Elegir un patrón y ser consistente.
```

**Recomendado:** leer las vistas desde API routes Next.js con `service_role`, porque ya tenemos la verificación en middleware + handler. Las RPC functions agregan complejidad innecesaria.

---

## Fase 3 — API routes

Todas bajo `/api/admin/**`. Read-only. JSON responses. Todas invocan `assertAdmin(req)` como primera línea.

### 3.1 Helper compartido

```typescript
// src/lib/admin/guard.ts
export async function assertAdmin(req: Request): Promise<{ adminId: string }> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AdminError(401, 'unauthorized');

  const { data } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single();

  if (!data?.is_admin) throw new AdminError(404, 'not_found');
  return { adminId: user.id };
}

// src/lib/admin/audit.ts
export async function logAdminAction(
  adminId: string,
  action: string,
  opts: { resource?: string; filters?: object; req?: Request } = {}
): Promise<void> {
  // Fire-and-forget, nunca rompe el flujo
  try {
    const supa = createServiceClient();
    await supa.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      resource: opts.resource,
      filters: opts.filters,
      ip_address: opts.req?.headers.get('x-forwarded-for') ?? null,
      user_agent: opts.req?.headers.get('user-agent') ?? null,
    });
  } catch (e) { console.error('[admin_audit_log] insert failed', e); }
}
```

### 3.2 Endpoints

| Método + Path | Devuelve | Notas |
|---|---|---|
| `GET /api/admin/overview` | KPIs del día: revenue_24h, orders_24h, active_users_24h, margin_24h, pending_orders, stuck_orders | Agregar cacheo en memoria 60s |
| `GET /api/admin/costs/daily?from=&to=` | `v_admin_daily_costs` filtrado | Validar rango max 180 días |
| `GET /api/admin/costs/apify` | `v_admin_apify_cost_by_tool` | — |
| `GET /api/admin/costs/claude` | `v_admin_claude_cost` | — |
| `GET /api/admin/users?q=&sort=&limit=&cursor=` | `v_admin_user_spending` paginado | Cursor-based pagination, max 50 por página |
| `GET /api/admin/users/:id` | Detalle de usuario: perfil + últimas 20 orders + total spending | **Audit log: `view_user_detail`** |
| `GET /api/admin/orders?status=&from=&to=&userId=&cursor=` | Listado filtrado de orders | Cursor pagination |
| `GET /api/admin/orders/:id` | Detalle completo: breakdown, scraping_jobs, ai_analysis_configs, audit trail | **Audit log: `view_order_detail`** |
| `GET /api/admin/orders/:id/cost-breakdown` | Reconstrucción detallada: costo por job + AI + reporte + chatbot vs lo cobrado | **Audit log: `view_order_costs`** |
| `GET /api/admin/health` | Estado de sistema: actors (de `actor_health`), stuck orders, margin anomalies, cap rate | — |
| `GET /api/admin/alerts` | Lista de alertas activas (ver Fase 5) | — |
| `GET /api/admin/funnel?from=&to=` | Datos de `v_funnel_30d` y vistas relacionadas de Phase 8 analytics | — |
| `GET /api/admin/audit?adminId=&action=&limit=` | Lectura del `admin_audit_log` | Solo visible a admins, **audit log: `view_audit_log`** (sí, meta-log) |
| `GET /api/admin/export/orders.csv?from=&to=` | CSV streaming de orders en el rango | **Audit log: `export_orders_csv`** con filtros |
| `GET /api/admin/export/users.csv` | CSV streaming de user spending | **Audit log: `export_users_csv`** |

### 3.3 Lo que NO se expone

Explícitamente bloqueado en MVP, incluso para admins:

- Contenido de `chat_messages` (PII, conversaciones privadas).
- Contenido de `raw_data` (datos scrapeados, pueden contener PII).
- Tokens, API keys, hashes de password.
- Ningún endpoint `POST`/`PUT`/`DELETE`/`PATCH` bajo `/api/admin/**`. Si se necesita en el futuro, diseño nuevo en Fase 7.

### 3.4 Paginación y límites

- Nunca devolver `SELECT *` sin `LIMIT`. Default limit 25, max 100.
- Cursor-based: `ORDER BY created_at DESC, id DESC` + cursor opaco base64.
- CSV export: streaming (Node Readable) para evitar memoria.

### 3.5 Caching

- `overview` cachea 60s en memoria por proceso (OK porque los KPIs son tolerantes a este delay).
- El resto no cachea — lee vistas materializadas, que ya son el cache.
- Header `Cache-Control: private, no-store` en todas las respuestas admin.

---

## Fase 4 — UI

### 4.1 Layout: `/[locale]/admin/layout.tsx`

Sidebar fijo con navegación:

- 📊 Overview
- 💰 Costos (sub: APIs, Apify por tool, Claude)
- 👥 Usuarios
- 🧾 Orders
- 🩺 Salud del sistema
- 📈 Funnel
- 🔔 Alertas
- 📋 Audit log
- 📤 Export

Top bar con: email del admin logueado, toggle de locale, badge visual "ADMIN MODE" en color distintivo (rojo/ámbar) para que el admin nunca confunda el panel con la app del usuario.

En la primera request, mostrar un tooltip/banner dismissable: "Todas tus acciones en este panel quedan registradas." — aviso explícito. Recordatorio de que el admin es responsable de sus acciones.

### 4.2 Páginas

Cada página sigue el patrón: Server Component que hace fetch server-side, pasa props al Client Component interactivo.

- `/[locale]/admin` → Overview: 6 KPI cards (revenue 24h, margin 24h, orders 24h, active users 24h, pending payments, stuck orders). Gráfico de línea: revenue vs cost últimos 30 días. Lista corta de alertas activas.
- `/[locale]/admin/costs` → Tabs: "General" | "Apify" | "Claude". Cada tab con gráfico + tabla.
- `/[locale]/admin/users` → Tabla paginada con search, sort por lifetime_revenue, filtros por locale. Click en fila → `/admin/users/:id`.
- `/[locale]/admin/users/[id]` → Header con info del usuario, KPIs personales, tabla de orders del usuario, timeline de actividad.
- `/[locale]/admin/orders` → Tabla paginada con filtros (status, date range, user email). Click → detalle.
- `/[locale]/admin/orders/[id]` → Breakdown completo: summary, cost breakdown (tabla lineada), scraping jobs, AI configs, timeline de eventos, link al project.
- `/[locale]/admin/health` → Grid: health de actors (del `actor_health`), stuck orders, margin anomalies, cap trigger rate chart.
- `/[locale]/admin/funnel` → Reutiliza vistas de Phase 8. Funnel visualization + conversion by price.
- `/[locale]/admin/alerts` → Lista de alertas activas + historial.
- `/[locale]/admin/audit` → Tabla paginada del audit log, filtros por admin, acción, rango.
- `/[locale]/admin/export` → Formulario simple: elegir tipo + rango → descarga CSV.

### 4.3 Componentes

Usar shadcn/ui. Para gráficos, Recharts (ya debería estar si hicieron Phase 8). Nada de librerías nuevas.

Componentes reutilizables a crear en `components/admin/`:
- `<KPICard title value delta currency />`
- `<DataTable columns rows pagination />`
- `<DateRangePicker />`
- `<CurrencyCell amount currency />` — usa `Intl.NumberFormat`
- `<StatusBadge status />` — para order statuses
- `<AdminAlertBanner level message />`

### 4.4 i18n

**Todo el panel internacionalizado.** Namespace `admin.*` en `messages/en.json` y `messages/es.json`. Mismas reglas que el resto de la app: nada hardcodeado.

Nombres de columnas, tooltips, filtros, labels, fechas, monedas — todo a través de `useTranslations` y `Intl.*`.

### 4.5 Seguridad en UI

- `robots.txt`: `Disallow: /admin`. Además headers `X-Robots-Tag: noindex` en el layout admin.
- CSP estricto en admin pages (inline scripts prohibidos donde sea posible).
- Nunca mostrar el token/API key crudo, ni password hashes, ni PII de otros usuarios en ventanas de debug.
- Si el admin abre un link a un project del usuario, esa página debe estar en modo "admin viewing" visible (banner), y también se audita.

---

## Fase 5 — Sistema de alertas

Condiciones que disparan alertas internas. Detectadas por un Inngest cron cada 5 min, persistidas en una tabla `admin_alerts` (schema abajo). El dashboard las muestra; en versiones futuras se integra a email/Slack.

```sql
CREATE TABLE admin_alerts (
  id              BIGSERIAL PRIMARY KEY,
  level           TEXT NOT NULL CHECK (level IN ('info','warning','critical')),
  code            TEXT NOT NULL,        -- 'margin_anomaly' | 'cap_trigger_spike' | 'actor_down' | 'webhook_failures' | ...
  message         TEXT NOT NULL,
  context         JSONB,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_alerts_unresolved ON admin_alerts(created_at DESC) WHERE resolved_at IS NULL;
```

### Reglas iniciales

| Código | Nivel | Condición | Acción |
|---|---|---|---|
| `margin_anomaly` | **critical** | Existe al menos 1 fila en `v_admin_margin_anomalies` creada en las últimas 24h | Alerta por cada order afectada |
| `cap_trigger_spike` | warning | `cap_trigger_pct` del día actual > 5% con ≥20 orders ese día | Agrupar por día |
| `actor_down` | warning | `actor_health.status = 'down'` para algún tool | Una por tool, se resuelve cuando vuelve a `healthy` |
| `stuck_orders` | warning | ≥3 orders con `stuck_minutes > 60` simultáneamente | Refresh cada vez |
| `webhook_failures` | critical | Rate de fallo de webhooks MP > 10% en 1h (si hay logging) | — |
| `refund_pending_backlog` | warning | ≥5 orders en `refund_pending` > 2h | — |
| `first_admin_login_country` | info | Login de admin desde un país nuevo (geoIP del audit log) | Heurística simple, FP aceptables |

Cada regla es una función pura `check(db): Alert[]`. El cron las ejecuta, inserta las nuevas (dedup por `code` + `context.key` si aplica) y actualiza `resolved_at` cuando la condición se resuelve.

### Resolver manualmente

Endpoint `POST /api/admin/alerts/:id/acknowledge` (única excepción a "read-only" — es una transición de estado no financiera). Setea `resolved_at` y `resolved_by`. Audit log: `acknowledge_alert`.

---

## Fase 6 — Observabilidad meta

El propio dashboard admin debe ser observable.

- Log estructurado en cada hit a `/api/admin/**`: `{adminId, route, method, durationMs, status}`.
- Métrica: `admin_page_load_ms` P50/P90/P99 por ruta — si alguna vista tarda >2s en P90, rediseñar la query o la vista.
- Métrica: `admin_audit_log_rows_per_day` — si cae a 0 un día que hubo logins, algo del logging está roto.
- Dashboard en `/admin/health` muestra estas métricas (meta-dashboard).

---

## Fase 7 — Roadmap post-MVP (no implementar ahora, dejar documentado)

Documentar en `docs/admin-dashboard-roadmap.md` lo siguiente como **no-goals del MVP** para que quede explícito:

- **Mutaciones manuales (refunds, cancelaciones).** Requiere un modelo de "dual control" (un admin inicia, otro aprueba) para limitar abuso. Diseño aparte.
- **Impersonation.** Ver la app "como el usuario" para debugging. Muy útil, pero es el feature de más alto riesgo — requiere diseño propio (token temporal, banner permanente en sesión impersonated, audit log detallado, expiración automática).
- **Notificaciones externas.** Slack / email para alertas critical. Post-MVP.
- **Roles granulares.** Hoy `is_admin` es boolean. Eventualmente `viewer` vs `operator` vs `superadmin`. No vale la pena en equipo chico; agregar cuando seamos >5 admins.
- **Dashboard de cohortes / retention.** Datos interesantes pero prematuro.

---

## Invariantes duros

1. `is_admin` solo se setea vía SQL en Supabase. Ninguna API route, UI, ni script automatizable lo hace.
2. Todo endpoint admin verifica `is_admin` en middleware **y** en el handler.
3. Toda acción admin que toca datos sensibles (user detail, order detail, costs, exports) escribe en `admin_audit_log`.
4. Ningún endpoint admin muta datos financieros o de usuarios en MVP (salvo `acknowledge_alert`).
5. El dashboard nunca expone: chat content, raw scraped data, tokens, password hashes.
6. Todas las respuestas admin tienen `Cache-Control: private, no-store`.
7. Rutas admin responden 404, no 403, cuando el usuario no es admin (no revelar existencia).
8. El middleware consulta `is_admin` en cada request — nunca cachear esta flag en cookie/JWT.

---

## Restricciones duras (NO HACER)

- ❌ No agregar UI/endpoint/CLI para crear admins. Solo SQL directo en Supabase.
- ❌ No cachear `is_admin` fuera del request actual.
- ❌ No exponer vistas materializadas directamente al cliente vía Supabase RLS si no pasan por un endpoint con audit log.
- ❌ No retornar PII de chat ni raw_data en ningún endpoint admin.
- ❌ No usar `any` en `lib/admin/**`.
- ❌ No duplicar lógica de permisos — un solo helper `assertAdmin` usado en todos lados.
- ❌ No agregar mutations en este MVP. Si aparece la necesidad, abrir ticket y diseñar aparte.
- ❌ No hardcodear strings en la UI admin (todo por `next-intl`).

---

## Criterios de aceptación

1. ✅ Un usuario con `is_admin=false` que pega la URL `/en/admin` ve 404, no 403.
2. ✅ Un usuario con `is_admin=true` ve el dashboard y los KPIs se renderizan.
3. ✅ Revocar admin (`UPDATE profiles SET is_admin=false`) lo patea del panel en el **siguiente request**, sin invalidar sesión manualmente.
4. ✅ Abrir un detalle de user o de order genera una fila en `admin_audit_log` con admin_id, action, resource, timestamp.
5. ✅ Ningún endpoint admin responde 200 a un POST/PUT/DELETE (salvo `acknowledge_alert`).
6. ✅ `grep -rn "is_admin" src/app/api/admin/` muestra verificación en cada route handler.
7. ✅ Las 7 vistas materializadas existen, se refrescan cada 15 min, y responden en <300ms al SELECT.
8. ✅ Una order con `actual_cost_usd > price_charged_usd` dispara `margin_anomaly` alert dentro de 5 min.
9. ✅ CSV export de 10k orders se descarga sin exceder 100MB de memoria en server (streaming).
10. ✅ Todo el panel renderiza correctamente en `en` y `es`, con formatos de moneda y fecha localizados.
11. ✅ Test E2E: un admin puede navegar Overview → Users → User detail → sus Orders → Order detail, y todo registra en audit log.
12. ✅ Test de seguridad: desde una sesión no-admin, intento directo a `/api/admin/costs/apify` → 404.
13. ✅ Test de seguridad: intento de `UPDATE profiles SET is_admin=true WHERE id=auth.uid()` desde cliente → falla por RLS.
14. ✅ `robots.txt` bloquea `/admin`, y `<meta name="robots" content="noindex">` presente en layout admin.

---

## Orden sugerido de implementación

1. Fase 0 (exploración) — resumen en ≤8 bullets.
2. Fase 1 (security schema + middleware + helpers) — **no avanzar si esto no está 100% testeado**.
3. Fase 2 (vistas materializadas + cron de refresh).
4. Fase 3 (API routes, una a una, con audit log).
5. Fase 4 (UI — Overview primero, después ir tile por tile).
6. Fase 5 (alertas + cron de detección).
7. Fase 6 (observabilidad meta).
8. Documentar Fase 7 (roadmap) — no implementar.

**Empezá por Fase 0 y esperame antes de avanzar.**