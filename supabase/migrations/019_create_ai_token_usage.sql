-- Migration 019: ai_token_usage + budget IA par commerçant
-- Surveillance de la consommation tokens LLM (Gemini / Mistral fallback)

-- 1. Ajouter le budget mensuel IA sur merchants
ALTER TABLE merchants
  ADD COLUMN ai_monthly_token_budget INTEGER DEFAULT 100000,
  ADD COLUMN ai_alert_email         TEXT;

-- 2. Table de logs tokens par appel LLM
CREATE TABLE ai_token_usage (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  conversation_id   UUID        REFERENCES conversations(id) ON DELETE SET NULL,
  model             TEXT        NOT NULL,
  provider          TEXT        NOT NULL CHECK (provider IN ('gemini', 'mistral', 'static')),
  prompt_tokens     INTEGER     NOT NULL DEFAULT 0,
  completion_tokens INTEGER     NOT NULL DEFAULT 0,
  total_tokens      INTEGER     NOT NULL DEFAULT 0,
  cost_eur          NUMERIC(10,6) NOT NULL DEFAULT 0,
  is_fallback       BOOLEAN     NOT NULL DEFAULT false,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Index pour requêtes fréquentes
CREATE INDEX idx_ai_token_usage_created_at  ON ai_token_usage(created_at);
CREATE INDEX idx_ai_token_usage_merchant_month
  ON ai_token_usage(merchant_id, created_at);

-- 4. RLS — isolation par commerçant
ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_token_usage_tenant_isolation" ON ai_token_usage
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

-- 5. Note : n8n utilise SUPABASE_SERVICE_ROLE_KEY qui bypass le RLS.
-- Pas besoin de policy INSERT supplémentaire.

-- 5b. Table notifications système (alertes IA, monitoring — pas liées à un client)
CREATE TABLE system_notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL
              CHECK (type IN ('ai_budget_info','ai_budget_warning','ai_budget_critical','ai_anomaly','system_alert')),
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_notifications_merchant_id ON system_notifications(merchant_id);
CREATE INDEX idx_system_notifications_unread
  ON system_notifications(merchant_id, created_at) WHERE is_read = false;

ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_notifications_tenant_isolation" ON system_notifications
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

-- 6. Vue agrégée par commerçant / mois (security_invoker = true pour respecter le RLS)
CREATE OR REPLACE VIEW ai_token_monthly_summary
WITH (security_invoker = true) AS
SELECT
  merchant_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*)                        AS total_calls,
  SUM(total_tokens)               AS total_tokens,
  SUM(cost_eur)                   AS total_cost_eur,
  SUM(CASE WHEN is_fallback THEN 1 ELSE 0 END) AS fallback_count,
  SUM(CASE WHEN provider = 'static' THEN 1 ELSE 0 END) AS static_count
FROM ai_token_usage
GROUP BY merchant_id, DATE_TRUNC('month', created_at);
