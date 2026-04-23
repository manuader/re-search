-- Fix: Enable RLS on actor_health and actor_health_log
-- These tables are read by the chatbot (tool health status) and written by Inngest cron.
-- Users should be able to read but never write directly.

ALTER TABLE actor_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_health_log ENABLE ROW LEVEL SECURITY;

-- Public read access (health status is not sensitive)
CREATE POLICY "Anyone can read actor health"
  ON actor_health FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read actor health log"
  ON actor_health_log FOR SELECT
  USING (true);

-- Fix: Set search_path on get_credit_balance to prevent mutable search_path attack
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM transactions
  WHERE user_id = p_user_id;
$$;
