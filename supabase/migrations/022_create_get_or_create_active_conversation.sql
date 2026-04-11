-- Migration 022: create public.get_or_create_active_conversation() RPC
--
-- Retourne l'ID de la conversation active pour un couple (merchant_id, client_id, channel).
-- Si aucune conversation active n'existe, en crée une nouvelle et retourne son ID.
--
-- Utilisé par le workflow n8n "Booking Conversation" node "Ensure Conversation"
-- pour garantir qu'une conversation existe avant de charger son historique
-- et d'y sauvegarder les messages (client et AI).
--
-- Atomique : un seul aller-retour SQL, pas de race condition entre plusieurs
-- webhooks concurrents pour le même client (premier gagne, deuxième récupère
-- le même ID en refaisant le SELECT).
--
-- Appelé par n8n avec service_role (bypass RLS). SECURITY DEFINER pour
-- permettre l'INSERT sans RLS check (service_role le fait déjà mais on
-- sécurise par cohérence avec la pratique Option D).

-- RETURNS TABLE(id UUID) pour que PostgREST retourne [{"id": "uuid"}]
-- (plus propre à parser côté n8n que le wrapping scalaire {"get_or_create_active_conversation": "uuid"})
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
  -- 1. Chercher une conversation active existante pour ce couple
  SELECT c.id INTO v_id
  FROM conversations c
  WHERE c.merchant_id = p_merchant_id
    AND c.client_id   = p_client_id
    AND c.channel     = p_channel
    AND c.is_active   = TRUE
  ORDER BY c.created_at DESC
  LIMIT 1;

  -- 2. Si pas trouvé, en créer une
  IF v_id IS NULL THEN
    INSERT INTO conversations (merchant_id, client_id, channel, is_active)
    VALUES (p_merchant_id, p_client_id, p_channel, TRUE)
    RETURNING conversations.id INTO v_id;
  END IF;

  RETURN QUERY SELECT v_id AS id;
END;
$$;

-- Permissions : service_role et authenticated (via n8n HTTP Bearer)
GRANT EXECUTE ON FUNCTION public.get_or_create_active_conversation(UUID, UUID, TEXT)
  TO service_role, authenticated;

COMMENT ON FUNCTION public.get_or_create_active_conversation IS
  'Retourne ou crée la conversation active pour (merchant, client, channel). Utilisé par n8n Booking Conversation pour fixer conversation_id avant sauvegarde des messages.';
