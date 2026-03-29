-- Migration 009: packages + client_packages (forfaits prépayés)

CREATE TABLE packages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  service_id      UUID        NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  total_uses      INTEGER     NOT NULL CHECK (total_uses > 0),
  price_cents     INTEGER     NOT NULL CHECK (price_cents >= 0),
  validity_days   INTEGER     CHECK (validity_days > 0),
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_packages_merchant_id ON packages(merchant_id);

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packages_tenant_isolation" ON packages
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

CREATE TRIGGER packages_updated_at
  BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Client purchased packages
CREATE TABLE client_packages (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id              UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  client_id                UUID        NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  package_id               UUID        NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  remaining_uses           INTEGER     NOT NULL CHECK (remaining_uses >= 0),
  purchased_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at               TIMESTAMPTZ,
  stripe_payment_intent_id TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_packages_merchant_id ON client_packages(merchant_id);
CREATE INDEX idx_client_packages_client_id ON client_packages(client_id);

ALTER TABLE client_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_packages_tenant_isolation" ON client_packages
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));
