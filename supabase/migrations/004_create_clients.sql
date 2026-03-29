-- Migration 004: clients

CREATE TABLE clients (
  id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id              UUID    NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name                     TEXT,
  phone                    TEXT,
  email                    TEXT,
  whatsapp_id              TEXT,
  messenger_id             TEXT,
  telegram_id              TEXT,
  preferred_practitioner_id UUID   REFERENCES practitioners(id) ON DELETE SET NULL,
  preferred_service_id      UUID   REFERENCES services(id) ON DELETE SET NULL,
  preferred_language       TEXT    DEFAULT 'fr',
  loyalty_points           INTEGER DEFAULT 0,
  loyalty_tier             TEXT    DEFAULT 'bronze',
  no_show_count            INTEGER DEFAULT 0,
  is_blocked               BOOLEAN DEFAULT false,
  notes                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Unique indexes per channel per merchant (multi-canal identification)
CREATE UNIQUE INDEX idx_clients_merchant_phone    ON clients(merchant_id, phone)       WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX idx_clients_merchant_whatsapp ON clients(merchant_id, whatsapp_id) WHERE whatsapp_id IS NOT NULL;
CREATE UNIQUE INDEX idx_clients_merchant_messenger ON clients(merchant_id, messenger_id) WHERE messenger_id IS NOT NULL;
CREATE UNIQUE INDEX idx_clients_merchant_telegram  ON clients(merchant_id, telegram_id)  WHERE telegram_id IS NOT NULL;

CREATE INDEX idx_clients_merchant_id ON clients(merchant_id);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_tenant_isolation" ON clients
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
