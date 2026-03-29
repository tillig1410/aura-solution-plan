-- Migration 010: client_subscriptions + loyalty_programs

CREATE TABLE client_subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id             UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  client_id               UUID        NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  service_id              UUID        NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  name                    TEXT        NOT NULL,
  price_cents             INTEGER     NOT NULL CHECK (price_cents >= 0),
  stripe_subscription_id  TEXT        NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'cancelled', 'past_due')),
  current_period_uses     INTEGER     DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_subscriptions_merchant_id ON client_subscriptions(merchant_id);
CREATE INDEX idx_client_subscriptions_client_id ON client_subscriptions(client_id);

ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_subscriptions_tenant_isolation" ON client_subscriptions
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

CREATE TRIGGER client_subscriptions_updated_at
  BEFORE UPDATE ON client_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Loyalty programs (one per merchant)
CREATE TABLE loyalty_programs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID        UNIQUE NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  points_per_visit  INTEGER     NOT NULL DEFAULT 10,
  points_per_euro   INTEGER     NOT NULL DEFAULT 1,
  silver_threshold  INTEGER     NOT NULL DEFAULT 100,
  gold_threshold    INTEGER     NOT NULL DEFAULT 500,
  is_active         BOOLEAN     DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_programs_tenant_isolation" ON loyalty_programs
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

CREATE TRIGGER loyalty_programs_updated_at
  BEFORE UPDATE ON loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- View: booking stats per merchant
CREATE VIEW booking_stats AS
  SELECT
    b.merchant_id,
    COUNT(*)::BIGINT AS total_bookings,
    COUNT(*) FILTER (WHERE b.status = 'completed')::BIGINT AS completed,
    COUNT(*) FILTER (WHERE b.status = 'no_show')::BIGINT AS no_shows,
    COUNT(*) FILTER (WHERE b.status = 'cancelled')::BIGINT AS cancelled,
    SUM(s.price_cents) FILTER (WHERE b.status = 'completed') AS revenue_cents
  FROM bookings b
  JOIN services s ON s.id = b.service_id
  GROUP BY b.merchant_id;
