-- Migration 005: bookings
-- 6 statuts, verrouillage optimiste, index unique créneau praticien

CREATE TABLE bookings (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      UUID    NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  client_id        UUID    NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  practitioner_id  UUID    NOT NULL REFERENCES practitioners(id) ON DELETE RESTRICT,
  service_id       UUID    NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','no_show')),
  source_channel   TEXT    NOT NULL
                   CHECK (source_channel IN ('whatsapp','messenger','telegram','sms','voice','dashboard','booking_page')),
  cancelled_at     TIMESTAMPTZ,
  cancelled_by     TEXT    CHECK (cancelled_by IN ('client','merchant')),
  version          INTEGER DEFAULT 1,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Unique slot per practitioner (prevents double-booking)
CREATE UNIQUE INDEX idx_bookings_slot_unique
  ON bookings(merchant_id, practitioner_id, starts_at)
  WHERE status NOT IN ('cancelled', 'no_show');

CREATE INDEX idx_bookings_merchant_id    ON bookings(merchant_id);
CREATE INDEX idx_bookings_client_id      ON bookings(client_id);
CREATE INDEX idx_bookings_practitioner_id ON bookings(practitioner_id);
CREATE INDEX idx_bookings_starts_at      ON bookings(starts_at);
CREATE INDEX idx_bookings_status         ON bookings(status);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_tenant_isolation" ON bookings
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
