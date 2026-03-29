-- Migration 003: services + practitioner_services (N:N)

CREATE TABLE services (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID    NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL,
  description       TEXT,
  duration_minutes  INTEGER NOT NULL,
  price_cents       INTEGER NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_services_merchant_id ON services(merchant_id);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_tenant_isolation" ON services
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Practitioner <-> Service N:N (both tables now exist)
CREATE TABLE practitioner_services (
  practitioner_id  UUID  NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  service_id       UUID  NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  merchant_id      UUID  NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  PRIMARY KEY (merchant_id, practitioner_id, service_id)
);

CREATE INDEX idx_practitioner_services_merchant ON practitioner_services(merchant_id);

ALTER TABLE practitioner_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioner_services_tenant_isolation" ON practitioner_services
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));
