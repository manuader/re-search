-- =============================================================================
-- Migration: Admin Dashboard
-- Security fixes, audit log, materialized views for admin monitoring.
-- =============================================================================

-- ─── 1. Add missing admin columns to profiles ──────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_granted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_granted_by UUID REFERENCES profiles(id);

-- ─── 2. Fix profiles UPDATE RLS — prevent self-elevation to admin ──────────

-- The existing policy allows any authenticated user to UPDATE all columns
-- on their own row, including is_admin. Replace it with one that freezes
-- admin-related columns to their current DB values.

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid())
    AND admin_granted_at IS NOT DISTINCT FROM (SELECT p.admin_granted_at FROM profiles p WHERE p.id = auth.uid())
    AND admin_granted_by IS NOT DISTINCT FROM (SELECT p.admin_granted_by FROM profiles p WHERE p.id = auth.uid())
  );

-- ─── 3. is_admin() helper function ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_admin(user_id UUID) RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = user_id), FALSE);
$$;

-- ─── 4. Admin audit log ────────────────────────────────────────────────────

CREATE TABLE admin_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    UUID NOT NULL REFERENCES profiles(id),
  action      TEXT NOT NULL,
  resource    TEXT,
  filters     JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_admin_time ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action, created_at DESC);
CREATE INDEX idx_admin_audit_log_resource ON admin_audit_log(resource) WHERE resource IS NOT NULL;

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can read/write.

-- ─── 5. Admin materialized views ───────────────────────────────────────────

-- 5a. Daily costs (revenue, margin, orders by day)
CREATE MATERIALIZED VIEW v_admin_daily_costs AS
SELECT
  date_trunc('day', o.execution_completed_at)::date AS day,
  COUNT(*)                                          AS orders_completed,
  SUM(o.actual_cost_usd)                            AS total_internal_cost_usd,
  SUM((o.cost_breakdown->>'chatbot')::numeric)      AS chatbot_cost_usd,
  SUM((o.cost_breakdown->>'report')::numeric)       AS report_cost_usd,
  SUM(o.price_charged_usd)                          AS total_revenue_usd,
  SUM(o.price_charged_usd - o.actual_cost_usd)      AS total_margin_usd,
  AVG(o.price_charged_usd - o.actual_cost_usd)      AS avg_margin_usd
FROM research_orders o
WHERE o.status IN ('completed','completed_partial')
  AND o.execution_completed_at IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;

CREATE UNIQUE INDEX ux_admin_daily_costs_day ON v_admin_daily_costs(day);

-- 5b. Apify cost by tool (last 30 days)
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
  COUNT(*) FILTER (WHERE sj.status='failed')::float / NULLIF(COUNT(*), 0) AS failure_rate,
  MAX(sj.completed_at)            AS last_run_at
FROM scraping_jobs sj
WHERE sj.created_at > now() - interval '30 days'
  AND sj.actual_cost IS NOT NULL
GROUP BY sj.tool_id, sj.tool_name
ORDER BY total_cost_usd DESC;

CREATE UNIQUE INDEX ux_admin_apify_cost_tool ON v_admin_apify_cost_by_tool(tool_id);

-- 5c. Claude cost by day and model
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
  COUNT(*) FILTER (WHERE o.report_type <> 'none') AS batches
FROM research_orders o
WHERE o.status IN ('completed','completed_partial')
  AND o.execution_completed_at > now() - interval '30 days'
GROUP BY 1
ORDER BY day DESC, model;

CREATE UNIQUE INDEX ux_admin_claude_cost_day_model ON v_admin_claude_cost(day, model);

-- 5d. User spending (lifetime)
CREATE MATERIALIZED VIEW v_admin_user_spending AS
SELECT
  p.id                                        AS user_id,
  p.email,
  p.locale,
  p.created_at                                AS user_created_at,
  COUNT(DISTINCT o.id)                        AS orders_paid,
  COUNT(DISTINCT o.project_id)                AS projects_paid,
  COALESCE(SUM(o.price_charged_usd), 0)       AS lifetime_revenue_usd,
  COALESCE(SUM(o.actual_cost_usd), 0)         AS lifetime_internal_cost_usd,
  COALESCE(SUM(o.price_charged_usd - o.actual_cost_usd), 0) AS lifetime_margin_usd,
  MAX(o.paid_at)                              AS last_paid_at
FROM profiles p
LEFT JOIN research_orders o
       ON o.user_id = p.id
      AND o.status IN ('completed','completed_partial','refunded')
GROUP BY p.id, p.email, p.locale, p.created_at
ORDER BY lifetime_revenue_usd DESC NULLS LAST;

CREATE UNIQUE INDEX ux_admin_user_spending_uid ON v_admin_user_spending(user_id);

-- 5e. Stuck orders
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

CREATE UNIQUE INDEX ux_admin_stuck_orders_id ON v_admin_stuck_orders(id);

-- 5f. Margin anomalies (orders where actual cost > price charged)
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

CREATE UNIQUE INDEX ux_admin_margin_anomalies_id ON v_admin_margin_anomalies(id);

-- 5g. Cap trigger rate by day
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

CREATE UNIQUE INDEX ux_admin_cap_trigger_day ON v_admin_cap_trigger_rate(day);

-- ─── 6. Helper function for refreshing materialized views via RPC ───────────

CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow known view names to prevent SQL injection
  IF view_name NOT IN (
    'v_admin_daily_costs', 'v_admin_apify_cost_by_tool', 'v_admin_claude_cost',
    'v_admin_user_spending', 'v_admin_stuck_orders', 'v_admin_margin_anomalies',
    'v_admin_cap_trigger_rate', 'v_funnel_30d', 'v_abandonment_by_price',
    'v_report_type_distribution', 'v_time_to_pay'
  ) THEN
    RAISE EXCEPTION 'Unknown materialized view: %', view_name;
  END IF;

  EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);
END;
$$;

-- ─── 7. Add unique indexes to existing materialized views ──────────────────
-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY

-- v_funnel_30d is a single row — add a dummy constant column for uniqueness
DROP MATERIALIZED VIEW IF EXISTS v_funnel_30d;
CREATE MATERIALIZED VIEW v_funnel_30d AS
SELECT
  1 AS id,
  COUNT(DISTINCT CASE WHEN event_name='project_created'    THEN project_id END) AS projects,
  COUNT(DISTINCT CASE WHEN event_name='chat_first_message' THEN project_id END) AS chats_started,
  COUNT(DISTINCT CASE WHEN event_name='config_completed'   THEN project_id END) AS configs_completed,
  COUNT(DISTINCT CASE WHEN event_name='checkout_viewed'    THEN project_id END) AS checkouts_viewed,
  COUNT(DISTINCT CASE WHEN event_name='payment_started'    THEN project_id END) AS payments_started,
  COUNT(DISTINCT CASE WHEN event_name='payment_completed'  THEN order_id END)   AS payments_completed
FROM analytics_events
WHERE created_at > now() - interval '30 days';

CREATE UNIQUE INDEX ux_funnel_30d_id ON v_funnel_30d(id);

-- v_abandonment_by_price
CREATE UNIQUE INDEX IF NOT EXISTS ux_abandonment_price_bucket ON v_abandonment_by_price(price_bucket);

-- v_report_type_distribution
CREATE UNIQUE INDEX IF NOT EXISTS ux_report_type_dist ON v_report_type_distribution(report_type);

-- v_time_to_pay is a single row
DROP MATERIALIZED VIEW IF EXISTS v_time_to_pay;
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
  1 AS id,
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (paid_at - viewed_at))) AS p50_sec,
  PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (paid_at - viewed_at))) AS p90_sec
FROM viewed JOIN paid USING (project_id);

CREATE UNIQUE INDEX ux_time_to_pay_id ON v_time_to_pay(id);
