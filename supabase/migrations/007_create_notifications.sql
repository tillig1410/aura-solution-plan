-- Migration 007: notifications

CREATE TABLE notifications (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  UUID    NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  client_id    UUID    NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  booking_id   UUID    REFERENCES bookings(id) ON DELETE SET NULL,
  type         TEXT    NOT NULL
               CHECK (type IN (
                 'reminder_24h','reminder_1h','confirmation','cancellation',
                 'no_show','review_request','loyalty_upgrade','package_expiring'
               )),
  channel      TEXT    NOT NULL
               CHECK (channel IN ('whatsapp','messenger','telegram','sms','voice')),
  status       TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','sent','failed')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_merchant_id  ON notifications(merchant_id);
CREATE INDEX idx_notifications_scheduled_at ON notifications(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_notifications_booking_id   ON notifications(booking_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_tenant_isolation" ON notifications
  USING (merchant_id = (SELECT m.id FROM merchants m WHERE m.user_id = auth.uid()));
