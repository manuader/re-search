-- =============================================================================
-- Migration: Admin Alerts
-- =============================================================================

CREATE TABLE admin_alerts (
  id              BIGSERIAL PRIMARY KEY,
  level           TEXT NOT NULL CHECK (level IN ('info','warning','critical')),
  code            TEXT NOT NULL,
  message         TEXT NOT NULL,
  context         JSONB,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_alerts_unresolved ON admin_alerts(created_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_admin_alerts_code ON admin_alerts(code, created_at DESC);

ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;
-- No policies = service_role only
