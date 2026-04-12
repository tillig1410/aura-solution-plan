-- Migration 031: RPC get_client_upcoming_bookings for cancellation flow
-- Date: 2026-04-12
--
-- Returns upcoming (future) bookings for a given client + merchant.
-- Used by Gemini via function calling to list bookings before cancelling.

CREATE OR REPLACE FUNCTION public.get_client_upcoming_bookings(
  p_merchant_id UUID,
  p_client_id   UUID
)
RETURNS TABLE (
  booking_id        UUID,
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  status            TEXT,
  service_name      TEXT,
  practitioner_name TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS booking_id,
    b.starts_at,
    b.ends_at,
    b.status::TEXT,
    s.name AS service_name,
    p.name AS practitioner_name
  FROM bookings b
  LEFT JOIN services s ON s.id = b.service_id
  LEFT JOIN practitioners p ON p.id = b.practitioner_id
  WHERE b.merchant_id = p_merchant_id
    AND b.client_id = p_client_id
    AND b.status IN ('confirmed', 'pending')
    AND b.starts_at > now()
  ORDER BY b.starts_at ASC
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_upcoming_bookings(UUID, UUID)
  TO service_role, authenticated;
