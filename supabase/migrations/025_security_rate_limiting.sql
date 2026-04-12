-- Migration 025: Rate limiting, blocklist, pattern detection + merchant alert_phone
-- Date: 2026-04-12

-- 1. Blocked phones table
CREATE TABLE IF NOT EXISTS blocked_phones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT now(),
  blocked_by TEXT DEFAULT 'system'
);

-- RLS: only service_role can read/write (n8n uses service_role)
ALTER TABLE blocked_phones ENABLE ROW LEVEL SECURITY;

-- 2. Message rate log (ephemeral, auto-cleaned)
CREATE TABLE IF NOT EXISTS message_rate_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE message_rate_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_message_rate_phone_time ON message_rate_log(phone, created_at DESC);

-- 3. Add alert columns to merchants (for sending budget/security alerts)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS alert_phone TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS alert_channel TEXT DEFAULT 'telegram';

-- 4. RPC: check_message_security
--    Returns: allowed (bool), reason (text), messages_last_hour (int), messages_last_5min (int)
--    Side effects: logs the message, auto-blocks bots, cleans old entries
CREATE OR REPLACE FUNCTION check_message_security(
  p_phone TEXT,
  p_merchant_id UUID
)
RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT,
  messages_last_hour INTEGER,
  messages_last_5min INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_blocked BOOLEAN;
  v_msg_1h INTEGER;
  v_msg_5m INTEGER;
BEGIN
  -- 1. Check blocklist
  SELECT EXISTS(SELECT 1 FROM blocked_phones WHERE phone = p_phone)
  INTO v_blocked;

  IF v_blocked THEN
    RETURN QUERY SELECT false::BOOLEAN, 'blocked'::TEXT, 0::INTEGER, 0::INTEGER;
    RETURN;
  END IF;

  -- 2. Log this message
  INSERT INTO message_rate_log(phone, merchant_id) VALUES (p_phone, p_merchant_id);

  -- 3. Count messages in last 5 minutes
  SELECT count(*)::INTEGER INTO v_msg_5m
  FROM message_rate_log
  WHERE phone = p_phone AND created_at > now() - interval '5 minutes';

  -- 4. Bot detection: >100 messages in 5 min → auto-block
  IF v_msg_5m > 100 THEN
    INSERT INTO blocked_phones(phone, reason)
    VALUES (p_phone, 'auto-blocked: ' || v_msg_5m || ' messages in 5 min (bot)')
    ON CONFLICT (phone) DO NOTHING;
    RETURN QUERY SELECT false::BOOLEAN, 'bot_detected'::TEXT, 0::INTEGER, v_msg_5m;
    RETURN;
  END IF;

  -- 5. Count messages in last hour
  SELECT count(*)::INTEGER INTO v_msg_1h
  FROM message_rate_log
  WHERE phone = p_phone AND created_at > now() - interval '1 hour';

  -- 6. Rate limit: >20 messages/hour
  IF v_msg_1h > 20 THEN
    RETURN QUERY SELECT false::BOOLEAN, 'rate_limited'::TEXT, v_msg_1h, v_msg_5m;
    RETURN;
  END IF;

  -- 7. Cleanup entries older than 2 hours (keep table small)
  DELETE FROM message_rate_log WHERE created_at < now() - interval '2 hours';

  RETURN QUERY SELECT true::BOOLEAN, 'ok'::TEXT, v_msg_1h, v_msg_5m;
END;
$$;
