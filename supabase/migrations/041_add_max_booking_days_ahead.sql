-- Migration 041: max_booking_days_ahead per merchant
-- Limite de réservation future (anti-spam + horizon planning).
-- Défaut 60j (compromis salon coiffure : Planity=90j, Treatwell=120j, Calendly=60j).
-- Borne 7..365 pour éviter à la fois "pas de RDV demain" et planning ouvert à l'infini.

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS max_booking_days_ahead INTEGER NOT NULL DEFAULT 60
    CHECK (max_booking_days_ahead BETWEEN 7 AND 365);
