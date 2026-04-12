-- Migration 029: Add cleanup of inactive conversations to get_or_create_active_conversation
-- Date: 2026-04-12
--
-- Problem: When a conversation is manually closed (is_active=false), the next message
-- creates a new one. Old inactive conversations pile up indefinitely.
--
-- Fix: When creating a NEW conversation, also delete inactive conversations for the
-- same (merchant, client, channel) older than 7 days. This piggybacks cleanup on
-- normal usage — no cron needed.

CREATE OR REPLACE FUNCTION public.get_or_create_active_conversation(
  p_merchant_id UUID,
  p_client_id   UUID,
  p_channel     TEXT
)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- 1. Chercher une conversation active existante
  SELECT c.id INTO v_id
  FROM conversations c
  WHERE c.merchant_id = p_merchant_id
    AND c.client_id   = p_client_id
    AND c.channel     = p_channel
    AND c.is_active   = TRUE
  ORDER BY c.created_at DESC
  LIMIT 1;

  -- 2. Si pas trouvé, en créer une + cleanup
  IF v_id IS NULL THEN
    INSERT INTO conversations (merchant_id, client_id, channel, is_active)
    VALUES (p_merchant_id, p_client_id, p_channel, TRUE)
    RETURNING conversations.id INTO v_id;

    -- 3. Cleanup: supprimer les conversations inactives > 7 jours
    --    pour ce même (merchant, client, channel)
    DELETE FROM conversations
    WHERE merchant_id = p_merchant_id
      AND client_id   = p_client_id
      AND channel     = p_channel
      AND is_active   = FALSE
      AND created_at  < now() - interval '7 days';
  END IF;

  RETURN QUERY SELECT v_id AS id;
END;
$$;
