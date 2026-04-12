-- Migration 030: Add optional practitioner_name filter to get_available_slots
-- Date: 2026-04-12
--
-- Allows Gemini to filter slots by practitioner when the client asks for
-- someone specific ("je veux Sophie"). Default NULL = all practitioners.

DROP FUNCTION IF EXISTS public.get_available_slots(UUID, DATE, INTEGER, INTEGER);

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
  practitioner_id     UUID,
  practitioner_name   TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_tz              TEXT;
  v_opening_hours   JSONB;
  v_scan_count      INTEGER;
  v_day_offset      INTEGER;
  v_current_date    DATE;
  v_dow_num         INTEGER;
  v_dow_name        TEXT;
  v_merchant_open   TIME;
  v_merchant_close  TIME;
BEGIN
  IF p_merchant_id IS NULL OR p_date IS NULL OR p_duration_minutes IS NULL THEN
    RETURN;
  END IF;
  IF p_duration_minutes <= 0 THEN
    RETURN;
  END IF;

  v_scan_count := GREATEST(1, LEAST(COALESCE(p_scan_days, 1), 14));

  SELECT COALESCE(m.timezone, 'Europe/Paris'), m.opening_hours
  INTO v_tz, v_opening_hours
  FROM merchants m WHERE m.id = p_merchant_id;

  IF NOT FOUND OR v_opening_hours IS NULL THEN
    RETURN;
  END IF;

  FOR v_day_offset IN 0..(v_scan_count - 1) LOOP
    v_current_date := p_date + v_day_offset;
    v_dow_num := EXTRACT(DOW FROM v_current_date)::INTEGER;
    v_dow_name := CASE v_dow_num
      WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday'
      WHEN 5 THEN 'friday' WHEN 6 THEN 'saturday'
    END;

    IF v_opening_hours->v_dow_name IS NULL OR v_opening_hours->v_dow_name = 'null'::jsonb THEN
      CONTINUE;
    END IF;

    v_merchant_open  := (v_opening_hours->v_dow_name->>'open')::TIME;
    v_merchant_close := (v_opening_hours->v_dow_name->>'close')::TIME;

    IF v_merchant_open IS NULL OR v_merchant_close IS NULL OR v_merchant_open >= v_merchant_close THEN
      CONTINUE;
    END IF;

    RETURN QUERY
    WITH
      practitioner_schedules AS (
        SELECT DISTINCT ON (p.id)
          p.id AS prac_id, p.name AS prac_name,
          av.is_available AS prac_available,
          av.start_time AS prac_start, av.end_time AS prac_end,
          av.break_start AS prac_break_start, av.break_end AS prac_break_end
        FROM practitioners p
        JOIN practitioner_availability av
          ON av.practitioner_id = p.id
          AND (av.exception_date = v_current_date
               OR (av.exception_date IS NULL AND av.day_of_week = v_dow_num))
        WHERE p.merchant_id = p_merchant_id
          AND p.is_active = true
          -- Filtre optionnel par nom de praticien (case-insensitive)
          AND (p_practitioner_name IS NULL OR lower(p.name) LIKE '%' || lower(p_practitioner_name) || '%')
        ORDER BY p.id, (av.exception_date IS NOT NULL) DESC
      ),
      effective_windows AS (
        SELECT ps.prac_id, ps.prac_name,
          GREATEST(ps.prac_start, v_merchant_open)  AS window_start,
          LEAST(ps.prac_end, v_merchant_close) AS window_end,
          ps.prac_break_start, ps.prac_break_end
        FROM practitioner_schedules ps
        WHERE ps.prac_available = true AND ps.prac_start IS NOT NULL AND ps.prac_end IS NOT NULL
      ),
      slot_candidates AS (
        SELECT ew.prac_id, ew.prac_name,
          gs.ts::TIMESTAMP AS slot_ts_local,
          (gs.ts + make_interval(mins => p_duration_minutes))::TIMESTAMP AS slot_end_local,
          ew.prac_break_start, ew.prac_break_end
        FROM effective_windows ew
        CROSS JOIN LATERAL generate_series(
          (v_current_date + ew.window_start)::TIMESTAMP,
          (v_current_date + ew.window_end - make_interval(mins => p_duration_minutes))::TIMESTAMP,
          make_interval(mins => p_duration_minutes)
        ) AS gs(ts)
        WHERE ew.window_start < ew.window_end
      )
    SELECT
      (sc.slot_ts_local AT TIME ZONE v_tz) AS slot_start,
      (sc.slot_end_local AT TIME ZONE v_tz) AS slot_end,
      sc.prac_id AS practitioner_id,
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
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE, INTEGER, INTEGER, TEXT)
  TO service_role, authenticated;
