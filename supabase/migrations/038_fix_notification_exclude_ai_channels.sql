CREATE OR REPLACE FUNCTION public.get_bookings_pending_notification()
RETURNS TABLE (
  id                 UUID,
  merchant_id        UUID,
  client_id          UUID,
  status             TEXT,
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  source_channel     TEXT,
  client_name        TEXT,
  client_phone       TEXT,
  client_whatsapp_id TEXT,
  client_messenger_id TEXT,
  client_telegram_id TEXT,
  service_name       TEXT,
  practitioner_name  TEXT,
  ai_name            TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
  SELECT
    b.id,
    b.merchant_id,
    b.client_id,
    b.status::TEXT,
    b.starts_at,
    b.ends_at,
    b.source_channel::TEXT,
    c.name        AS client_name,
    c.phone       AS client_phone,
    c.whatsapp_id AS client_whatsapp_id,
    c.messenger_id AS client_messenger_id,
    c.telegram_id AS client_telegram_id,
    s.name        AS service_name,
    p.name        AS practitioner_name,
    m.ai_name
  FROM bookings b
  LEFT JOIN clients c       ON c.id = b.client_id
  LEFT JOIN services s      ON s.id = b.service_id
  LEFT JOIN practitioners p ON p.id = b.practitioner_id
  LEFT JOIN merchants m     ON m.id = b.merchant_id
  WHERE b.status IN ('confirmed', 'cancelled')
    AND b.updated_at > now() - interval '5 minutes'
    AND b.source_channel NOT IN ('dashboard', 'whatsapp', 'messenger', 'telegram', 'sms', 'voice')
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.booking_id = b.id
        AND n.type IN ('confirmation', 'cancellation')
    );
$func$;
