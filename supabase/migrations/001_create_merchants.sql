-- Migration 001: merchants
-- Multi-tenant anchor table

CREATE TABLE merchants (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID        UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                        TEXT        NOT NULL,
  slug                        TEXT        UNIQUE NOT NULL,
  email                       TEXT        NOT NULL,
  phone                       TEXT,
  address                     TEXT,
  timezone                    TEXT        NOT NULL DEFAULT 'Europe/Paris',
  opening_hours               JSONB       NOT NULL DEFAULT '{}',
  stripe_account_id           TEXT,
  stripe_subscription_id      TEXT,
  seat_count                  INTEGER     NOT NULL DEFAULT 1,
  ai_name                     TEXT        DEFAULT 'AurA',
  ai_tone                     TEXT        DEFAULT 'friendly',
  ai_languages                TEXT[]      DEFAULT '{fr}',
  cancellation_delay_minutes  INTEGER     DEFAULT 120,
  voice_enabled               BOOLEAN     DEFAULT false,
  telnyx_phone_number         TEXT,
  google_place_id             TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_merchants_user_id ON merchants(user_id);
CREATE INDEX idx_merchants_slug ON merchants(slug);

-- RLS
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchants_tenant_isolation" ON merchants
  USING (user_id = auth.uid());

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
