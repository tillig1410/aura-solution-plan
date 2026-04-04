-- Migration 012: stripe_events (idempotency for webhook deduplication)

CREATE TABLE stripe_events (
  id   TEXT        PRIMARY KEY,  -- Stripe event ID (evt_xxx)
  type TEXT        NOT NULL,     -- Event type (payment_intent.succeeded, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cleanup old events after 90 days (optional cron job)
CREATE INDEX idx_stripe_events_created_at ON stripe_events(created_at);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stripe_events_service_role_only" ON stripe_events
  FOR ALL USING (auth.role() = 'service_role');
