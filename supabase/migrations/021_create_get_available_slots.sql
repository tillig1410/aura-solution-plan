-- Migration 021: create public.get_available_slots() RPC
--
-- Retourne les créneaux libres pour un merchant, une date et une durée donnée.
-- Utilisé par le workflow n8n "Booking Conversation" node "Check Availability"
-- pour fournir la liste des slots dispo au prompt LLM.
--
-- Logique :
--   1. Vérifie que le merchant est ouvert ce jour (merchants.opening_hours JSONB par day name)
--   2. Pour chaque praticien actif, détermine son planning effectif :
--      - Exception datée (practitioner_availability.exception_date = p_date) a priorité
--      - Sinon récurrent (day_of_week = EXTRACT(DOW FROM p_date))
--      - Si is_available = false (congé/off day), praticien exclu
--   3. Fenêtre effective = INTERSECTION(horaires merchant, horaires praticien)
--   4. Génère les slots par pas de p_duration_minutes dans cette fenêtre
--   5. Filtre les slots qui chevauchent break_times (pause déjeuner)
--   6. Filtre les slots qui chevauchent un booking non-cancelled/no_show du praticien
--   7. Retourne les slots libres ordonnés par heure puis praticien
--
-- Timezone-aware : combinaison DATE + TIME → TIMESTAMP local, converti en
-- TIMESTAMPTZ via (AT TIME ZONE merchants.timezone). Gère automatiquement DST.
--
-- Appelé par n8n avec service_role (bypass RLS). SECURITY INVOKER est donc OK.

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_merchant_id       UUID,
  p_date              DATE,
  p_duration_minutes  INTEGER
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
  v_dow_num         INTEGER;
  v_dow_name        TEXT;
  v_merchant_open   TIME;
  v_merchant_close  TIME;
  v_opening_hours   JSONB;
BEGIN
  -- Garde-fous sur les paramètres
  IF p_merchant_id IS NULL OR p_date IS NULL OR p_duration_minutes IS NULL THEN
    RETURN;
  END IF;
  IF p_duration_minutes <= 0 THEN
    RETURN;
  END IF;

  -- 1. Load merchant (timezone + opening_hours)
  SELECT
    COALESCE(m.timezone, 'Europe/Paris'),
    m.opening_hours
  INTO v_tz, v_opening_hours
  FROM merchants m
  WHERE m.id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- 2. Compute day of week (PG: 0=Sunday .. 6=Saturday)
  v_dow_num := EXTRACT(DOW FROM p_date)::INTEGER;
  v_dow_name := CASE v_dow_num
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END;

  -- 3. Fast-exit si le salon est fermé ce jour (JSONB null ou absent)
  IF v_opening_hours IS NULL
     OR v_opening_hours->v_dow_name IS NULL
     OR v_opening_hours->v_dow_name = 'null'::jsonb THEN
    RETURN;
  END IF;

  v_merchant_open  := (v_opening_hours->v_dow_name->>'open')::TIME;
  v_merchant_close := (v_opening_hours->v_dow_name->>'close')::TIME;

  IF v_merchant_open IS NULL OR v_merchant_close IS NULL OR v_merchant_open >= v_merchant_close THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
    -- Pour chaque praticien actif, trouve la row d'availability qui "gagne"
    -- (priorité aux exceptions datées sur le recurring).
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
          av.exception_date = p_date
          OR (av.exception_date IS NULL AND av.day_of_week = v_dow_num)
        )
      WHERE p.merchant_id = p_merchant_id
        AND p.is_active   = true
      -- Priorité aux exceptions datées
      ORDER BY p.id, (av.exception_date IS NOT NULL) DESC
    ),

    -- Fenêtre effective = intersection des horaires merchant et praticien.
    -- Filtre les praticiens indisponibles (congés, off days).
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

    -- Génération des slots candidats par pas de p_duration_minutes
    -- dans la fenêtre effective.
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
        (p_date + ew.window_start)::TIMESTAMP,
        (p_date + ew.window_end - make_interval(mins => p_duration_minutes))::TIMESTAMP,
        make_interval(mins => p_duration_minutes)
      ) AS gs(ts)
      WHERE ew.window_start < ew.window_end
    )

  -- Résultat final : filtre les slots pendant le break et ceux qui chevauchent
  -- une réservation existante.
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
END;
$$;

-- Commentaire sur la fonction (visible dans Supabase Studio)
COMMENT ON FUNCTION public.get_available_slots(UUID, DATE, INTEGER) IS
  'Retourne les créneaux libres pour un merchant/date/durée. '
  'Intersection merchant opening_hours ∩ practitioner_availability, '
  'moins les breaks et les bookings non-cancelled/no_show. '
  'Timezone-aware. Utilisé par n8n Booking Conversation.';

-- Grant execute explicite (service_role bypass RLS par défaut sur les tables,
-- mais pour les fonctions il est plus propre d'être explicite)
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, DATE, INTEGER) TO authenticated;
