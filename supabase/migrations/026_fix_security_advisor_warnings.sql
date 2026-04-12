-- Migration 026: Fix Supabase Security Advisor warnings
-- Date: 2026-04-12

-- =============================================================================
-- 1. Fix search_path on all RPC functions (prevents search_path hijacking)
-- =============================================================================

ALTER FUNCTION public.get_available_slots SET search_path = public;
ALTER FUNCTION public.normalize_phone_fr SET search_path = public;
ALTER FUNCTION public.identify_or_create_client SET search_path = public;
ALTER FUNCTION public.check_message_security SET search_path = public;
ALTER FUNCTION public.update_updated_at SET search_path = public;
-- Also fix get_or_create_active_conversation if it exists
DO $$ BEGIN
  ALTER FUNCTION public.get_or_create_active_conversation SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- =============================================================================
-- 2. Revoke API access on materialized views (not meant for direct client access)
-- =============================================================================

REVOKE SELECT ON public.booking_stats FROM anon, authenticated;
REVOKE SELECT ON public.tips_by_practitioner FROM anon, authenticated;

-- Grant back to service_role only (n8n + server-side)
GRANT SELECT ON public.booking_stats TO service_role;
GRANT SELECT ON public.tips_by_practitioner TO service_role;
