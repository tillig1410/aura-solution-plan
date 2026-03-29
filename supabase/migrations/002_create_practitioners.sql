-- Migration 002: practitioners + practitioner_availability
-- Note: practitioner_services (N:N avec services) est dans migration 003

CREATE TABLE practitioners (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID    NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  email       TEXT,
  color       TEXT    NOT NULL,
  specialties TEXT[]  DEFAULT '{}',
  is_active   BOOLEAN DEFAULT true,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_practitioners_merchant_id ON practitioners(merchant_id);

ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioners_tenant_isolation" ON practitioners
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

CREATE TRIGGER practitioners_updated_at
  BEFORE UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Practitioner availability (recurring schedules + date exceptions)
CREATE TABLE practitioner_availability (
  id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      UUID      NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  practitioner_id  UUID      NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  day_of_week      SMALLINT  CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       TIME      NOT NULL,
  end_time         TIME      NOT NULL,
  is_available     BOOLEAN   DEFAULT true,
  exception_date   DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_availability_practitioner ON practitioner_availability(practitioner_id);
CREATE INDEX idx_availability_merchant     ON practitioner_availability(merchant_id);

ALTER TABLE practitioner_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioner_availability_tenant_isolation" ON practitioner_availability
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));
