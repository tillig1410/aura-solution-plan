-- Migration 040: fix convention day_of_week (dashboard vs RPC)
--
-- Bug : le dashboard sauve day_of_week avec convention 0=Lundi, 6=Dimanche
-- (cf. src/app/api/v1/practitioners/[id]/availability/route.ts:22)
-- alors que la RPC get_available_slots (migration 035) utilise
-- EXTRACT(DOW FROM date) qui donne 0=Dimanche, 6=Samedi.
--
-- Conséquence : décalage d'un jour sur tous les créneaux. Aujourd'hui
-- dimanche (EXTRACT DOW = 0) → RPC cherche la config dashboard Lundi.
--
-- Fix : utiliser EXTRACT(ISODOW FROM date) - 1 qui donne
-- 0=Lundi, 6=Dimanche. Match parfait avec le dashboard.

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_merchant_id       UUID,
  p_date              DATE,
  p_duration_minutes  INTEGER,
  p_scan_days         INTEGER DEFAULT 1,
  p_practitioner_name TEXT    DEFAULT NULL
)
RETURNS TABLE (
  slot_start          TIMESTAMPTZ,
  slot_end            TIMESTAMPTZ,
  slot_start_local    TEXT,
  slot_date_local     TEXT,
  practitioner_id     UUID,
  practitioner_name   TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $func$
DECLARE
  v_tz              TEXT;
  v_scan_count      INTEGER;
  v_day_offset      INTEGER;
  v_current_date    DATE;
  v_dow_num         INTEGER;
BEGIN
  IF p_merchant_id IS NULL OR p_date IS NULL OR p_duration_minutes IS NULL THEN
    RETURN;
  END IF;
  IF p_duration_minutes <= 0 THEN
    RETURN;
  END IF;

  v_scan_count := GREATEST(1, LEAST(COALESCE(p_scan_days, 1), 14));

  SELECT COALESCE(m.timezone, 'Europe/Paris')
  INTO v_tz
  FROM merchants m WHERE m.id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_day_offset IN 0..(v_scan_count - 1) LOOP
    v_current_date := p_date + v_day_offset;
    -- ISODOW: 1=Lundi ... 7=Dimanche; -1 pour match convention dashboard (0=Lundi, 6=Dimanche)
    v_dow_num := (EXTRACT(ISODOW FROM v_current_date)::INTEGER - 1);

    RETURN QUERY
    WITH
      practitioner_schedules AS (
        SELECT DISTINCT ON (p.id)
          p.id AS prac_id, p.name AS prac_name,
          av.start_time AS prac_start, av.end_time AS prac_end,
          av.break_start AS prac_break_start, av.break_end AS prac_break_end
        FROM practitioners p
        JOIN practitioner_availability av
          ON av.practitioner_id = p.id
          AND av.is_available = true
          AND (av.exception_date = v_current_date
               OR (av.exception_date IS NULL AND av.day_of_week = v_dow_num))
        WHERE p.merchant_id = p_merchant_id
          AND p.is_active = true
          AND (p_practitioner_name IS NULL OR lower(p.name) LIKE '%' || lower(p_practitioner_name) || '%')
        ORDER BY p.id, (av.exception_date IS NOT NULL) DESC
      ),
      slot_candidates AS (
        SELECT ps.prac_id, ps.prac_name,
          gs.ts::TIMESTAMP AS slot_ts_local,
          (gs.ts + make_interval(mins => p_duration_minutes))::TIMESTAMP AS slot_end_local,
          ps.prac_break_start, ps.prac_break_end
        FROM practitioner_schedules ps
        CROSS JOIN LATERAL generate_series(
          (v_current_date + ps.prac_start)::TIMESTAMP,
          (v_current_date + ps.prac_end - make_interval(mins => p_duration_minutes))::TIMESTAMP,
          make_interval(mins => p_duration_minutes)
        ) AS gs(ts)
        WHERE ps.prac_start < ps.prac_end
      )
    SELECT
      (sc.slot_ts_local AT TIME ZONE v_tz)  AS slot_start,
      (sc.slot_end_local AT TIME ZONE v_tz) AS slot_end,
      to_char(sc.slot_ts_local, 'HH24:MI')  AS slot_start_local,
      to_char(sc.slot_ts_local, 'YYYY-MM-DD') AS slot_date_local,
      sc.prac_id  AS practitioner_id,
      sc.prac_name AS practitioner_name
    FROM slot_candidates sc
    WHERE
      NOT (sc.prac_break_start IS NOT NULL AND sc.prac_break_end IS NOT NULL
           AND sc.slot_ts_local::TIME < sc.prac_break_end
           AND sc.slot_end_local::TIME > sc.prac_break_start)
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.practitioner_id = sc.prac_id
          AND b.status NOT IN ('cancelled', 'no_show')
          AND b.starts_at < (sc.slot_end_local AT TIME ZONE v_tz)
          AND b.ends_at > (sc.slot_ts_local AT TIME ZONE v_tz)
      )
    ORDER BY slot_start, practitioner_id;
  END LOOP;

  RETURN;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE, INTEGER, INTEGER, TEXT)
  TO service_role, authenticated;
