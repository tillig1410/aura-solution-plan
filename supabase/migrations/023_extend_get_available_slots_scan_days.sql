-- Migration 023: extend get_available_slots() with p_scan_days parameter
--
-- Ajoute p_scan_days INTEGER DEFAULT 1 pour permettre à n8n Booking
-- Conversation de scanner jusqu'à 14 jours consécutifs en un seul appel RPC.
-- Utilisé pour « le plus tôt possible » / « dès que possible » : Gemini
-- appelle avec scan_days=7, la fonction boucle sur 7 dates et agrège tous
-- les slots dans l'ordre chronologique.
--
-- Backward compat : default=1 → comportement identique à la v1 pour les
-- appels 3-args existants (une fois qu'on a dropé l'ancienne signature).
--
-- Logique inchangée par rapport à migration 021 : intersection opening_hours
-- et practitioner_availability, filtre break_times, filtre bookings actifs.
-- La seule différence est le FOR loop sur v_day_offset.
--
-- Appliquée manuellement via Supabase Studio (pattern établi).

DROP FUNCTION IF EXISTS public.get_available_slots(UUID, DATE, INTEGER);

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_merchant_id       UUID,
  p_date              DATE,
  p_duration_minutes  INTEGER,
  p_scan_days         INTEGER DEFAULT 1
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
  -- Garde-fous
  IF p_merchant_id IS NULL OR p_date IS NULL OR p_duration_minutes IS NULL THEN
    RETURN;
  END IF;
  IF p_duration_minutes <= 0 THEN
    RETURN;
  END IF;

  -- Clamp scan_days entre 1 et 14
  v_scan_count := GREATEST(1, LEAST(COALESCE(p_scan_days, 1), 14));

  -- Load merchant (timezone + opening_hours) — une seule fois pour la durée du scan
  SELECT
    COALESCE(m.timezone, 'Europe/Paris'),
    m.opening_hours
  INTO v_tz, v_opening_hours
  FROM merchants m
  WHERE m.id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_opening_hours IS NULL THEN
    RETURN;
  END IF;

  -- Boucle sur N jours à partir de p_date
  FOR v_day_offset IN 0..(v_scan_count - 1) LOOP
    v_current_date := p_date + v_day_offset;

    -- Day of week de la date courante
    v_dow_num := EXTRACT(DOW FROM v_current_date)::INTEGER;
    v_dow_name := CASE v_dow_num
      WHEN 0 THEN 'sunday'
      WHEN 1 THEN 'monday'
      WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday'
      WHEN 4 THEN 'thursday'
      WHEN 5 THEN 'friday'
      WHEN 6 THEN 'saturday'
    END;

    -- Skip si salon fermé ce jour
    IF v_opening_hours->v_dow_name IS NULL
       OR v_opening_hours->v_dow_name = 'null'::jsonb THEN
      CONTINUE;
    END IF;

    v_merchant_open  := (v_opening_hours->v_dow_name->>'open')::TIME;
    v_merchant_close := (v_opening_hours->v_dow_name->>'close')::TIME;

    IF v_merchant_open IS NULL
       OR v_merchant_close IS NULL
       OR v_merchant_open >= v_merchant_close THEN
      CONTINUE;
    END IF;

    -- Requête principale pour ce jour : accumule les slots dans le RETURN QUERY
    RETURN QUERY
    WITH
      practitioner_schedules AS (
        SELECT DISTINCT ON (p.id)
          p.id             AS prac_id,
          p.name           AS prac_name,
          av.is_available  AS prac_available,
          av.start_time    AS prac_start,
          av.end_time      AS prac_end,
          av.break_start   AS prac_break_start,
          av.break_end     AS prac_break_end
        FROM practitioners p
        JOIN practitioner_availability av
          ON av.practitioner_id = p.id
          AND (
            av.exception_date = v_current_date
            OR (av.exception_date IS NULL AND av.day_of_week = v_dow_num)
          )
        WHERE p.merchant_id = p_merchant_id
          AND p.is_active   = true
        ORDER BY p.id, (av.exception_date IS NOT NULL) DESC
      ),
      effective_windows AS (
        SELECT
          ps.prac_id,
          ps.prac_name,
          GREATEST(ps.prac_start, v_merchant_open)  AS window_start,
          LEAST(ps.prac_end,      v_merchant_close) AS window_end,
          ps.prac_break_start,
          ps.prac_break_end
        FROM practitioner_schedules ps
        WHERE ps.prac_available = true
          AND ps.prac_start IS NOT NULL
          AND ps.prac_end   IS NOT NULL
      ),
      slot_candidates AS (
        SELECT
          ew.prac_id,
          ew.prac_name,
          gs.ts::TIMESTAMP                                               AS slot_ts_local,
          (gs.ts + make_interval(mins => p_duration_minutes))::TIMESTAMP AS slot_end_local,
          ew.prac_break_start,
          ew.prac_break_end
        FROM effective_windows ew
        CROSS JOIN LATERAL generate_series(
          (v_current_date + ew.window_start)::TIMESTAMP,
          (v_current_date + ew.window_end - make_interval(mins => p_duration_minutes))::TIMESTAMP,
          make_interval(mins => p_duration_minutes)
        ) AS gs(ts)
        WHERE ew.window_start < ew.window_end
      )
    SELECT
      (sc.slot_ts_local  AT TIME ZONE v_tz) AS slot_start,
      (sc.slot_end_local AT TIME ZONE v_tz) AS slot_end,
      sc.prac_id                            AS practitioner_id,
      sc.prac_name                          AS practitioner_name
    FROM slot_candidates sc
    WHERE
      -- Pas dans la pause déjeuner
      NOT (
        sc.prac_break_start IS NOT NULL
        AND sc.prac_break_end IS NOT NULL
        AND sc.slot_ts_local::TIME  < sc.prac_break_end
        AND sc.slot_end_local::TIME > sc.prac_break_start
      )
      -- Pas de chevauchement avec une réservation active
      AND NOT EXISTS (
        SELECT 1
        FROM bookings b
        WHERE b.practitioner_id = sc.prac_id
          AND b.status NOT IN ('cancelled', 'no_show')
          AND b.starts_at < (sc.slot_end_local AT TIME ZONE v_tz)
          AND b.ends_at   > (sc.slot_ts_local  AT TIME ZONE v_tz)
      )
    ORDER BY slot_start, practitioner_id;
  END LOOP;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_available_slots(UUID, DATE, INTEGER, INTEGER) IS
  'Retourne les créneaux libres pour un merchant/date/durée, sur N jours '
  '(p_scan_days, default 1, max 14). Utilisé par n8n Booking Conversation : '
  'scan_days=1 pour une date précise, scan_days=7 pour « le plus tôt possible ». '
  'Intersection merchant opening_hours ∩ practitioner_availability, '
  'moins les breaks et les bookings non-cancelled/no_show. Timezone-aware.';

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE, INTEGER, INTEGER)
  TO service_role, authenticated;
