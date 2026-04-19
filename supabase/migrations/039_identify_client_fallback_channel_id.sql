-- Migration 039: identify_or_create_client fallback lookup par channel_id
-- Fix duplicate key idx_clients_merchant_whatsapp when phone edited but whatsapp_id orphaned

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

  -- Lookup par phone_normalized (cas standard)
  v_id := (SELECT c.id FROM public.clients c
           WHERE c.merchant_id = p_merchant_id
             AND c.phone_normalized = v_norm
           LIMIT 1);

  -- Fallback lookup par channel_id si phone_normalized vide
  IF v_id IS NULL THEN
    IF p_channel = 'whatsapp' THEN
      v_id := (SELECT c.id FROM public.clients c
               WHERE c.merchant_id = p_merchant_id
                 AND c.whatsapp_id = p_raw_phone
               LIMIT 1);
    ELSIF p_channel = 'messenger' THEN
      v_id := (SELECT c.id FROM public.clients c
               WHERE c.merchant_id = p_merchant_id
                 AND c.messenger_id = p_raw_phone
               LIMIT 1);
    ELSIF p_channel = 'telegram' THEN
      v_id := (SELECT c.id FROM public.clients c
               WHERE c.merchant_id = p_merchant_id
                 AND c.telegram_id = p_raw_phone
               LIMIT 1);
    END IF;
  END IF;

  IF v_id IS NULL THEN
    -- INSERT nouveau client (INSERT RETURNING INTO est la syntaxe PL/pgSQL valide)
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
    -- UPDATE fill channel_id manquant uniquement
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
  'mig 039: lookup phone_normalized then fallback channel_id before INSERT, avoids duplicate key on orphan channel_id';

GRANT EXECUTE ON FUNCTION public.identify_or_create_client(UUID, TEXT, TEXT, TEXT) TO service_role;
