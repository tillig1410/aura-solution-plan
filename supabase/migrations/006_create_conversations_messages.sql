-- Migration 006: conversations + messages

CREATE TABLE conversations (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID    NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  client_id   UUID    NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel     TEXT    NOT NULL
              CHECK (channel IN ('whatsapp','messenger','telegram','sms','voice')),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_merchant_id ON conversations(merchant_id);
CREATE INDEX idx_conversations_client_id   ON conversations(client_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_tenant_isolation" ON conversations
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Messages
CREATE TABLE messages (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           UUID    NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  conversation_id       UUID    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender                TEXT    NOT NULL CHECK (sender IN ('client','ai')),
  content               TEXT    NOT NULL,
  is_voice_transcription BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_merchant_id     ON messages(merchant_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_tenant_isolation" ON messages
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));
