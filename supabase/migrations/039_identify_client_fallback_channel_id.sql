-- Migration 039: identify_or_create_client — fallback lookup par channel_id
--
-- Bug avant : si le phone d'un client a été modifié dans le dashboard mais que
-- son whatsapp_id (ou messenger_id, telegram_id) est resté = au numéro d'origine,
-- le RPC échoue avec "duplicate key violates idx_clients_merchant_whatsapp" car
-- il tente d'INSERT un nouveau client avec le whatsapp_id orphelin.
--
-- Fix : si lookup par phone_normalized échoue, retomber sur lookup par channel_id
-- correspondant. Ne rien modifier (pas de UPDATE silencieux du phone), juste
-- retourner le client existant — le commerçant gère manuellement s'il veut
-- déconnecter le canal de l'ancien contact.

CREATE OR REPLACE FUNCTION public.identify_or_create_client(
  p_merchant_id UUID,
  p_raw_phone   TEXT,
  p_name        TEXT,
  p_channel     TEXT
)
RETURNS TABLE(
  id                        UUID,
  name                      TEXT,
  phone                     TEXT,
  whatsapp_id               TEXT,
  messenger_id              TEXT,
  telegram_id               TEXT,
  loyalty_points            INTEGER,
  preferred_service_id      UUID,
  preferred_practitioner_id UUID,
  preferred_language        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_norm TEXT := public.normalize_phone_fr(p_raw_phone);
  v_id   UUID;
BEGIN
  IF v_norm IS NULL THEN
    RAISE EXCEPTION 'identify_or_create_client: invalid phone "%"', p_raw_phone;
  END IF;

  -- 1. Lookup par phone_normalized (cas standard)
  SELECT c.id INTO v_id
  FROM public.clients c
  WHERE c.merchant_id = p_merchant_id
    AND c.phone_normalized = v_norm
  LIMIT 1;

  -- 2. Fallback : lookup par channel_id si phone_normalized n'a rien donné
  -- (cas où le phone du client a été manuellement modifié mais le channel_id
  -- est resté = au numéro d'origine de l'expéditeur)
  IF v_id IS NULL THEN
    IF p_channel = 'whatsapp' THEN
      SELECT c.id INTO v_id
      FROM public.clients c
      WHERE c.merchant_id = p_merchant_id
        AND c.whatsapp_id = p_raw_phone
      LIMIT 1;
    ELSIF p_channel = 'messenger' THEN
      SELECT c.id INTO v_id
      FROM public.clients c
      WHERE c.merchant_id = p_merchant_id
        AND c.messenger_id = p_raw_phone
      LIMIT 1;
    ELSIF p_channel = 'telegram' THEN
      SELECT c.id INTO v_id
      FROM public.clients c
      WHERE c.merchant_id = p_merchant_id
        AND c.telegram_id = p_raw_phone
      LIMIT 1;
    END IF;
  END IF;

  IF v_id IS NULL THEN
    -- 3a. INSERT nouveau client
    INSERT INTO public.clients (
      merchant_id, name, phone,
      whatsapp_id, messenger_id, telegram_id,
      preferred_language
    ) VALUES (
      p_merchant_id,
      COALESCE(NULLIF(p_name, ''), 'Inconnu'),
      p_raw_phone,
      CASE WHEN p_channel = 'whatsapp'  THEN p_raw_phone END,
      CASE WHEN p_channel = 'messenger' THEN p_raw_phone END,
      CASE WHEN p_channel = 'telegram'  THEN p_raw_phone END,
      'fr'
    )
    RETURNING clients.id INTO v_id;
  ELSE
    -- 3b. UPDATE : fill seulement le channel_id manquant
    -- (ne touche jamais name ni phone original — voir migration 024)
    UPDATE public.clients c
    SET
      whatsapp_id  = COALESCE(c.whatsapp_id,  CASE WHEN p_channel = 'whatsapp'  THEN p_raw_phone END),
      messenger_id = COALESCE(c.messenger_id, CASE WHEN p_channel = 'messenger' THEN p_raw_phone END),
      telegram_id  = COALESCE(c.telegram_id,  CASE WHEN p_channel = 'telegram'  THEN p_raw_phone END),
      updated_at   = NOW()
    WHERE c.id = v_id;
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.name, c.phone, c.whatsapp_id, c.messenger_id, c.telegram_id,
    c.loyalty_points, c.preferred_service_id, c.preferred_practitioner_id, c.preferred_language
  FROM public.clients c
  WHERE c.id = v_id;
END;
$func$;

COMMENT ON FUNCTION public.identify_or_create_client(UUID, TEXT, TEXT, TEXT) IS
  'v2 (mig 039) : lookup par phone_normalized puis fallback par channel_id (whatsapp/messenger/telegram) avant INSERT. Évite "duplicate key idx_clients_merchant_whatsapp" quand le phone a été modifié mais le channel_id orphelin reste sur l ancien client. Comportement INSERT/UPDATE inchangé.';

GRANT EXECUTE ON FUNCTION public.identify_or_create_client(UUID, TEXT, TEXT, TEXT) TO service_role;
