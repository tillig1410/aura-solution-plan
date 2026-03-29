-- Migration 008: tips (pourboires nominatifs)

CREATE TABLE tips (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id              UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  booking_id               UUID        REFERENCES bookings(id) ON DELETE SET NULL,
  client_id                UUID        NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  practitioner_id          UUID        NOT NULL REFERENCES practitioners(id) ON DELETE RESTRICT,
  amount_cents             INTEGER     NOT NULL CHECK (amount_cents > 0),
  stripe_payment_intent_id TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tips_merchant_id ON tips(merchant_id);
CREATE INDEX idx_tips_practitioner_id ON tips(practitioner_id);
CREATE INDEX idx_tips_client_id ON tips(client_id);

ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tips_tenant_isolation" ON tips
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

-- View: tips aggregated by practitioner
CREATE VIEW tips_by_practitioner AS
  SELECT
    practitioner_id,
    merchant_id,
    COALESCE(SUM(amount_cents), 0)::BIGINT AS total_cents,
    COUNT(*)::BIGINT AS tip_count
  FROM tips
  GROUP BY practitioner_id, merchant_id;
