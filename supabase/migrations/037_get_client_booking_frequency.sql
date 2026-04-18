CREATE OR REPLACE FUNCTION public.get_client_booking_frequency(
  p_merchant_id UUID,
  p_client_id   UUID
)
RETURNS TABLE (
  service_id          UUID,
  service_name        TEXT,
  booking_count       INTEGER,
  avg_interval_days   INTEGER,
  last_booking_date   DATE,
  suggested_next_date DATE
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $func$
BEGIN
  RETURN QUERY
  WITH completed AS (
    SELECT b.service_id, s.name AS svc_name, b.starts_at::DATE AS booking_date
    FROM bookings b
    JOIN services s ON s.id = b.service_id
    WHERE b.merchant_id = p_merchant_id
      AND b.client_id = p_client_id
      AND b.status = 'completed'
  ),
  with_intervals AS (
    SELECT c.*,
      c.booking_date - LAG(c.booking_date) OVER (PARTITION BY c.service_id ORDER BY c.booking_date) AS interval_days
    FROM completed c
  )
  SELECT
    wi.service_id,
    MAX(wi.svc_name)::TEXT AS service_name,
    COUNT(*)::INTEGER AS booking_count,
    AVG(wi.interval_days)::INTEGER AS avg_interval_days,
    MAX(wi.booking_date) AS last_booking_date,
    (MAX(wi.booking_date) + AVG(wi.interval_days)::INTEGER) AS suggested_next_date
  FROM with_intervals wi
  GROUP BY wi.service_id
  HAVING COUNT(*) >= 2 AND AVG(wi.interval_days) IS NOT NULL
  ORDER BY MAX(wi.booking_date) DESC;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_client_booking_frequency(UUID, UUID)
  TO service_role, authenticated;
