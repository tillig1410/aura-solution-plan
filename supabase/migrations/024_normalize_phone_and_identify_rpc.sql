-- Migration 024: Normalisation phone FR + RPC identify_or_create_client
--
-- Problem: les clients créés via le dashboard ont phone='0652880318' (format national FR),
-- tandis que les clients créés via WhatsApp ont phone='33652880318' (format international).
-- Résultat: le même humain est dédoublé dans public.clients (bug Alex/mr X observé 2026-04-11).
--
-- Fix en 3 composantes:
-- 1. Fonction IMMUTABLE `normalize_phone_fr(text)` qui convertit tous les formats FR en
--    digits-only international (33XXXXXXXXX).
-- 2. Colonne générée `clients.phone_normalized` + index unique (merchant_id, phone_normalized).
-- 3. RPC `identify_or_create_client(p_merchant_id, p_raw_phone, p_name, p_channel)` qui fait
--    l'insert-or-update intelligent: jamais de overwrite du name ou du phone existants,
--    fill seulement le channel_id manquant.

-- =============================================================================
-- 1. Fonction de normalisation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.normalize_phone_fr(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  WITH digits AS (
    SELECT regexp_replace(COALESCE(raw, ''), '[^0-9]', '', 'g') AS d
  )
  SELECT CASE
    WHEN d = '' THEN NULL
    -- 0XXXXXXXXX (10 chiffres commençant par 0) → 33XXXXXXXXX
    WHEN length(d) = 10 AND d LIKE '0%' THEN '33' || substring(d FROM 2)
    -- Déjà en digits-only (couvre 33XXXXXXXXX et formats non-FR)
    ELSE d
  END
  FROM digits;
$$;

COMMENT ON FUNCTION public.normalize_phone_fr(TEXT) IS
  'Normalise un numéro de téléphone FR vers digits-only international (33XXXXXXXXX). Strip tout caractère non-digit, convertit 0XXXXXXXXX vers 33XXXXXXXXX. IMMUTABLE (safe pour generated columns et index).';

-- =============================================================================
-- 2. Colonne générée phone_normalized
-- =============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT
  GENERATED ALWAYS AS (public.normalize_phone_fr(phone)) STORED;

COMMENT ON COLUMN public.clients.phone_normalized IS
  'Format normalisé du phone (33XXXXXXXXX) pour matcher entre canaux (WhatsApp/SMS/Messenger/Telegram/manuel). Généré automatiquement via normalize_phone_fr(phone).';

-- =============================================================================
-- 3. Safeguard: abort si doublons post-normalisation
-- =============================================================================

DO $$
DECLARE
  v_dup_count INTEGER;
  v_dup_sample TEXT;
BEGIN
  SELECT COUNT(*), string_agg(merchant_id::text || '/' || phone_normalized, ', ')
  INTO v_dup_count, v_dup_sample
  FROM (
    SELECT merchant_id, phone_normalized
    FROM public.clients
    WHERE phone_normalized IS NOT NULL
    GROUP BY merchant_id, phone_normalized
    HAVING COUNT(*) > 1
    LIMIT 10
  ) d;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index idx_clients_merchant_phone_normalized: % duplicate (merchant_id, phone_normalized) pairs exist. Sample: %. Resolve manually first (DELETE the duplicates, keeping the one with the most bookings).',
      v_dup_count, v_dup_sample;
  END IF;
END $$;

-- =============================================================================
-- 4. Remplacement de l'index unique
-- =============================================================================

-- Drop l'ancien index sur phone brut (utilisé par l'upsert PostgREST actuel)
DROP INDEX IF EXISTS public.idx_clients_merchant_phone;

-- Nouvel index unique sur phone_normalized (pour match cross-canal)
CREATE UNIQUE INDEX idx_clients_merchant_phone_normalized
  ON public.clients(merchant_id, phone_normalized);

COMMENT ON INDEX public.idx_clients_merchant_phone_normalized IS
  'Unicité d''un humain par merchant, tous canaux confondus. Match via phone_normalized (normalize_phone_fr).';

-- =============================================================================
-- 5. RPC identify_or_create_client
-- =============================================================================

CREATE OR REPLACE FUNCTION public.identify_or_create_client(
  p_merchant_id UUID,
  p_raw_phone   TEXT,
  p_name        TEXT,
  p_channel     TEXT  -- 'whatsapp' | 'messenger' | 'telegram' | 'sms'
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
AS $$
DECLARE
  v_norm TEXT := public.normalize_phone_fr(p_raw_phone);
  v_id   UUID;
BEGIN
  IF v_norm IS NULL THEN
    RAISE EXCEPTION 'identify_or_create_client: invalid phone "%"', p_raw_phone;
  END IF;

  -- 1. Lookup existant via phone_normalized
  SELECT c.id INTO v_id
  FROM public.clients c
  WHERE c.merchant_id = p_merchant_id
    AND c.phone_normalized = v_norm
  LIMIT 1;

  IF v_id IS NULL THEN
    -- 2a. INSERT: nouveau client, renseigne le channel_id correspondant
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
    -- 2b. UPDATE: fill seulement le channel_id manquant, ne TOUCHE PAS name/phone
    -- (évite de renommer mr X en "Alex" à cause du push name WhatsApp)
    UPDATE public.clients c
    SET
      whatsapp_id  = COALESCE(c.whatsapp_id,  CASE WHEN p_channel = 'whatsapp'  THEN p_raw_phone END),
      messenger_id = COALESCE(c.messenger_id, CASE WHEN p_channel = 'messenger' THEN p_raw_phone END),
      telegram_id  = COALESCE(c.telegram_id,  CASE WHEN p_channel = 'telegram'  THEN p_raw_phone END),
      updated_at   = NOW()
    WHERE c.id = v_id;
  END IF;

  -- 3. Return le client (inserted ou updated)
  RETURN QUERY
  SELECT
    c.id, c.name, c.phone, c.whatsapp_id, c.messenger_id, c.telegram_id,
    c.loyalty_points, c.preferred_service_id, c.preferred_practitioner_id, c.preferred_language
  FROM public.clients c
  WHERE c.id = v_id;
END;
$$;

COMMENT ON FUNCTION public.identify_or_create_client(UUID, TEXT, TEXT, TEXT) IS
  'Trouve ou crée un client pour un merchant en utilisant phone_normalized comme clef de dédup cross-canal. Si le client existe: ne touche jamais son name ni son phone original, fill uniquement le channel_id manquant. Si pas: INSERT avec le channel_id correspondant.';

-- SECURITY DEFINER → exécute avec les privilèges du owner (postgres).
-- Le workflow n8n appelle cette fonction avec la service_role key, pas de RLS à craindre.
GRANT EXECUTE ON FUNCTION public.identify_or_create_client(UUID, TEXT, TEXT, TEXT) TO service_role;
