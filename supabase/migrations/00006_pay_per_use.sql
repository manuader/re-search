-- =============================================================================
-- Migration: Pay-Per-Use Model
-- Replaces the credit-based billing system with per-research-order payments.
-- =============================================================================

-- ─── 1. New table: research_orders ──────────────────────────────────────────

CREATE TABLE research_orders (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES profiles(id),
  project_id                  UUID NOT NULL REFERENCES research_projects(id),
  kind                        TEXT NOT NULL CHECK (kind IN ('research','report')),
  status                      TEXT NOT NULL DEFAULT 'pending_payment'
                              CHECK (status IN (
                                'pending_payment','paid','executing',
                                'completed','completed_partial','failed',
                                'refunded','refund_pending','expired'
                              )),

  -- Pricing (immutable once created; if anything changes, create a new order)
  estimated_internal_cost_usd DECIMAL(10,4) NOT NULL,
  safety_buffer_usd           DECIMAL(10,4) NOT NULL,
  markup_multiplier           DECIMAL(5,3)  NOT NULL,
  price_charged_usd           DECIMAL(10,4) NOT NULL,
  cost_breakdown              JSONB NOT NULL,
  price_local                 DECIMAL(10,2),
  price_local_currency        TEXT,

  -- Frozen configuration (what will be executed)
  config_snapshot             JSONB NOT NULL,
  report_type                 TEXT NOT NULL DEFAULT 'none'
                              CHECK (report_type IN ('none','executive','professional','technical')),

  -- Payment
  payment_provider            TEXT NOT NULL DEFAULT 'mercadopago',
  payment_preference_id       TEXT,
  payment_id                  TEXT,
  payment_status              TEXT,
  payment_url                 TEXT,
  paid_at                     TIMESTAMPTZ,
  refund_id                   TEXT,
  refunded_amount_usd         DECIMAL(10,4),
  refunded_at                 TIMESTAMPTZ,

  -- Execution
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
CREATE INDEX idx_research_orders_status ON research_orders(status)
  WHERE status IN ('pending_payment','executing','refund_pending');
CREATE UNIQUE INDEX ux_research_orders_payment_id ON research_orders(payment_id)
  WHERE payment_id IS NOT NULL;

-- RLS: users can only SELECT their own orders. All writes go through server-side.
ALTER TABLE research_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON research_orders FOR SELECT
  USING (user_id = auth.uid());

-- ─── 2. Update transactions table ──────────────────────────────────────────

-- Add order_id FK
ALTER TABLE transactions ADD COLUMN order_id UUID REFERENCES research_orders(id);

-- Expand the type CHECK to include new order types + fix missing scraping_adjustment
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'credit_purchase', 'scraping_reserve', 'scraping_cost',
    'scraping_adjustment', 'ai_cost', 'refund',
    'order_payment', 'order_refund'
  ));

-- ─── 3. Remove welcome credits trigger ─────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate handle_new_user WITHOUT the welcome credits insertion
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ─── 4. Add current_order_id to research_projects ──────────────────────────

ALTER TABLE research_projects
  ADD COLUMN current_order_id UUID REFERENCES research_orders(id);

-- Add completed_partial to project status if not already there
ALTER TABLE research_projects DROP CONSTRAINT IF EXISTS research_projects_status_check;
ALTER TABLE research_projects ADD CONSTRAINT research_projects_status_check
  CHECK (status IN ('draft', 'configured', 'running', 'completed', 'completed_partial', 'failed'));

-- ─── 5. Analytics events table ─────────────────────────────────────────────

CREATE TABLE analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  event_name  TEXT NOT NULL,
  user_id     UUID REFERENCES profiles(id),
  project_id  UUID REFERENCES research_projects(id),
  order_id    UUID REFERENCES research_orders(id),
  payload     JSONB NOT NULL DEFAULT '{}',
  session_id  TEXT,
  locale      TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_name_time ON analytics_events(event_name, created_at DESC);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_events_project ON analytics_events(project_id);
CREATE INDEX idx_analytics_events_order ON analytics_events(order_id) WHERE order_id IS NOT NULL;

-- RLS: no client reads; inserts only via server (service role).
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- ─── 6. Materialized views for funnel analytics ────────────────────────────

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

CREATE MATERIALIZED VIEW v_report_type_distribution AS
SELECT
  payload->>'reportType' AS report_type,
  COUNT(*) AS paid_orders,
  AVG((payload->>'priceChargedUsd')::numeric) AS avg_price_usd
FROM analytics_events
WHERE event_name='payment_completed' AND created_at > now() - interval '30 days'
GROUP BY payload->>'reportType';

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

-- ─── 7. Add is_admin flag to profiles ──────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
