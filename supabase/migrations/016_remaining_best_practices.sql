-- Migration 016: Corrections restantes Postgres Best Practices
--
-- 1. Suppression index redondants/dupliqués
-- 2. Autovacuum agressif (tables haute mutation)
-- 3. Vues matérialisées (booking_stats, tips_by_practitioner)
-- 4. NOT NULL sur created_at / updated_at
-- 5. CHECK end_time > start_time (practitioner_availability)
-- 6. Validation email au niveau BDD
-- 7. pg_stat_statements
--
-- NOTE: UUID v7 reporté — pg_uuidv7 non disponible sur cette instance Supabase (PG 17).
-- Sera possible nativement avec PG 18 (uuidv7()).


-- =============================================
-- 1. Suppression index redondants / dupliqués
-- =============================================

-- idx_bookings_merchant_id est couvert par le composite idx_bookings_merchant_starts_at
-- (leftmost prefix rule)
DROP INDEX IF EXISTS idx_bookings_merchant_id;

-- idx_bookings_no_double_booking (013) a une sémantique contradictoire avec idx_bookings_slot_unique (005)
-- slot_unique : WHERE status NOT IN ('cancelled','no_show') → permet de rebooker un créneau no_show ✓
-- no_double_booking : WHERE status != 'cancelled' → bloque le rebooking d'un no_show ✗
-- On garde uniquement slot_unique
DROP INDEX IF EXISTS idx_bookings_no_double_booking;


-- =============================================
-- 3. Autovacuum agressif sur tables à forte mutation
-- =============================================
-- Par défaut : vacuum à 20% dead tuples. Trop lent pour les tables très actives.

ALTER TABLE bookings SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE messages SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE notifications SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);


-- =============================================
-- 4. Vues matérialisées — éviter les agrégations à chaque requête
-- =============================================
-- Les vues simples recalculent le JOIN + GROUP BY à chaque accès.
-- Les vues matérialisées stockent le résultat et se rafraîchissent à la demande.
-- Rafraîchir avec : REFRESH MATERIALIZED VIEW CONCURRENTLY <nom>;

DROP VIEW IF EXISTS booking_stats;
CREATE MATERIALIZED VIEW booking_stats AS
  SELECT
    b.merchant_id,
    COUNT(*)::BIGINT AS total_bookings,
    COUNT(*) FILTER (WHERE b.status = 'completed')::BIGINT AS completed,
    COUNT(*) FILTER (WHERE b.status = 'no_show')::BIGINT AS no_shows,
    COUNT(*) FILTER (WHERE b.status = 'cancelled')::BIGINT AS cancelled,
    SUM(s.price_cents) FILTER (WHERE b.status = 'completed') AS revenue_cents
  FROM bookings b
  JOIN services s ON s.id = b.service_id
  GROUP BY b.merchant_id;

CREATE UNIQUE INDEX idx_booking_stats_merchant ON booking_stats(merchant_id);

DROP VIEW IF EXISTS tips_by_practitioner;
CREATE MATERIALIZED VIEW tips_by_practitioner AS
  SELECT
    practitioner_id,
    merchant_id,
    COALESCE(SUM(amount_cents), 0)::BIGINT AS total_cents,
    COUNT(*)::BIGINT AS tip_count
  FROM tips
  GROUP BY practitioner_id, merchant_id;

CREATE UNIQUE INDEX idx_tips_by_practitioner ON tips_by_practitioner(merchant_id, practitioner_id);


-- =============================================
-- 5. NOT NULL sur created_at / updated_at
-- =============================================
-- Pattern NOT VALID + VALIDATE = verrou court (pas de ACCESS EXCLUSIVE pendant la validation)

-- merchants
ALTER TABLE merchants ADD CONSTRAINT chk_merchants_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE merchants VALIDATE CONSTRAINT chk_merchants_created_nn;
ALTER TABLE merchants ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE merchants DROP CONSTRAINT chk_merchants_created_nn;

ALTER TABLE merchants ADD CONSTRAINT chk_merchants_updated_nn CHECK (updated_at IS NOT NULL) NOT VALID;
ALTER TABLE merchants VALIDATE CONSTRAINT chk_merchants_updated_nn;
ALTER TABLE merchants ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE merchants DROP CONSTRAINT chk_merchants_updated_nn;

-- practitioners
ALTER TABLE practitioners ADD CONSTRAINT chk_practitioners_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE practitioners VALIDATE CONSTRAINT chk_practitioners_created_nn;
ALTER TABLE practitioners ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE practitioners DROP CONSTRAINT chk_practitioners_created_nn;

ALTER TABLE practitioners ADD CONSTRAINT chk_practitioners_updated_nn CHECK (updated_at IS NOT NULL) NOT VALID;
ALTER TABLE practitioners VALIDATE CONSTRAINT chk_practitioners_updated_nn;
ALTER TABLE practitioners ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE practitioners DROP CONSTRAINT chk_practitioners_updated_nn;

-- practitioner_availability (created_at seulement)
ALTER TABLE practitioner_availability ADD CONSTRAINT chk_pa_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE practitioner_availability VALIDATE CONSTRAINT chk_pa_created_nn;
ALTER TABLE practitioner_availability ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE practitioner_availability DROP CONSTRAINT chk_pa_created_nn;

-- services
ALTER TABLE services ADD CONSTRAINT chk_services_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE services VALIDATE CONSTRAINT chk_services_created_nn;
ALTER TABLE services ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE services DROP CONSTRAINT chk_services_created_nn;

ALTER TABLE services ADD CONSTRAINT chk_services_updated_nn CHECK (updated_at IS NOT NULL) NOT VALID;
ALTER TABLE services VALIDATE CONSTRAINT chk_services_updated_nn;
ALTER TABLE services ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE services DROP CONSTRAINT chk_services_updated_nn;

-- clients
ALTER TABLE clients ADD CONSTRAINT chk_clients_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE clients VALIDATE CONSTRAINT chk_clients_created_nn;
ALTER TABLE clients ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE clients DROP CONSTRAINT chk_clients_created_nn;

ALTER TABLE clients ADD CONSTRAINT chk_clients_updated_nn CHECK (updated_at IS NOT NULL) NOT VALID;
ALTER TABLE clients VALIDATE CONSTRAINT chk_clients_updated_nn;
ALTER TABLE clients ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE clients DROP CONSTRAINT chk_clients_updated_nn;

-- bookings
ALTER TABLE bookings ADD CONSTRAINT chk_bookings_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE bookings VALIDATE CONSTRAINT chk_bookings_created_nn;
ALTER TABLE bookings ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE bookings DROP CONSTRAINT chk_bookings_created_nn;

ALTER TABLE bookings ADD CONSTRAINT chk_bookings_updated_nn CHECK (updated_at IS NOT NULL) NOT VALID;
ALTER TABLE bookings VALIDATE CONSTRAINT chk_bookings_updated_nn;
ALTER TABLE bookings ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE bookings DROP CONSTRAINT chk_bookings_updated_nn;

-- conversations
ALTER TABLE conversations ADD CONSTRAINT chk_conv_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE conversations VALIDATE CONSTRAINT chk_conv_created_nn;
ALTER TABLE conversations ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE conversations DROP CONSTRAINT chk_conv_created_nn;

ALTER TABLE conversations ADD CONSTRAINT chk_conv_updated_nn CHECK (updated_at IS NOT NULL) NOT VALID;
ALTER TABLE conversations VALIDATE CONSTRAINT chk_conv_updated_nn;
ALTER TABLE conversations ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE conversations DROP CONSTRAINT chk_conv_updated_nn;

-- messages (created_at seulement)
ALTER TABLE messages ADD CONSTRAINT chk_messages_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE messages VALIDATE CONSTRAINT chk_messages_created_nn;
ALTER TABLE messages ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE messages DROP CONSTRAINT chk_messages_created_nn;

-- notifications (created_at seulement)
ALTER TABLE notifications ADD CONSTRAINT chk_notif_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE notifications VALIDATE CONSTRAINT chk_notif_created_nn;
ALTER TABLE notifications ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE notifications DROP CONSTRAINT chk_notif_created_nn;

-- tips (created_at seulement)
ALTER TABLE tips ADD CONSTRAINT chk_tips_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE tips VALIDATE CONSTRAINT chk_tips_created_nn;
ALTER TABLE tips ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE tips DROP CONSTRAINT chk_tips_created_nn;

-- packages
ALTER TABLE packages ADD CONSTRAINT chk_packages_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE packages VALIDATE CONSTRAINT chk_packages_created_nn;
ALTER TABLE packages ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE packages DROP CONSTRAINT chk_packages_created_nn;

ALTER TABLE packages ADD CONSTRAINT chk_packages_updated_nn CHECK (updated_at IS NOT NULL) NOT VALID;
ALTER TABLE packages VALIDATE CONSTRAINT chk_packages_updated_nn;
ALTER TABLE packages ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE packages DROP CONSTRAINT chk_packages_updated_nn;

-- client_packages (created_at seulement)
ALTER TABLE client_packages ADD CONSTRAINT chk_cp_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE client_packages VALIDATE CONSTRAINT chk_cp_created_nn;
ALTER TABLE client_packages ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE client_packages DROP CONSTRAINT chk_cp_created_nn;

-- client_subscriptions
ALTER TABLE client_subscriptions ADD CONSTRAINT chk_cs_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE client_subscriptions VALIDATE CONSTRAINT chk_cs_created_nn;
ALTER TABLE client_subscriptions ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE client_subscriptions DROP CONSTRAINT chk_cs_created_nn;

ALTER TABLE client_subscriptions ADD CONSTRAINT chk_cs_updated_nn CHECK (updated_at IS NOT NULL) NOT VALID;
ALTER TABLE client_subscriptions VALIDATE CONSTRAINT chk_cs_updated_nn;
ALTER TABLE client_subscriptions ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE client_subscriptions DROP CONSTRAINT chk_cs_updated_nn;

-- loyalty_programs
ALTER TABLE loyalty_programs ADD CONSTRAINT chk_lp_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE loyalty_programs VALIDATE CONSTRAINT chk_lp_created_nn;
ALTER TABLE loyalty_programs ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE loyalty_programs DROP CONSTRAINT chk_lp_created_nn;

ALTER TABLE loyalty_programs ADD CONSTRAINT chk_lp_updated_nn CHECK (updated_at IS NOT NULL) NOT VALID;
ALTER TABLE loyalty_programs VALIDATE CONSTRAINT chk_lp_updated_nn;
ALTER TABLE loyalty_programs ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE loyalty_programs DROP CONSTRAINT chk_lp_updated_nn;

-- stripe_events
ALTER TABLE stripe_events ADD CONSTRAINT chk_se_created_nn CHECK (created_at IS NOT NULL) NOT VALID;
ALTER TABLE stripe_events VALIDATE CONSTRAINT chk_se_created_nn;
ALTER TABLE stripe_events ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE stripe_events DROP CONSTRAINT chk_se_created_nn;


-- =============================================
-- 6. CHECK end_time > start_time (practitioner_availability)
-- =============================================

ALTER TABLE practitioner_availability
  ADD CONSTRAINT chk_availability_end_after_start
  CHECK (end_time > start_time) NOT VALID;

ALTER TABLE practitioner_availability
  VALIDATE CONSTRAINT chk_availability_end_after_start;


-- =============================================
-- 7. Validation email au niveau BDD
-- =============================================

-- merchants.email (NOT NULL, donc pas de check IS NULL)
ALTER TABLE merchants
  ADD CONSTRAINT chk_merchants_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$') NOT VALID;

ALTER TABLE merchants VALIDATE CONSTRAINT chk_merchants_email_format;

-- practitioners.email (nullable)
ALTER TABLE practitioners
  ADD CONSTRAINT chk_practitioners_email_format
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$') NOT VALID;

ALTER TABLE practitioners VALIDATE CONSTRAINT chk_practitioners_email_format;

-- clients.email (nullable)
ALTER TABLE clients
  ADD CONSTRAINT chk_clients_email_format
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$') NOT VALID;

ALTER TABLE clients VALIDATE CONSTRAINT chk_clients_email_format;


-- =============================================
-- 8. pg_stat_statements — monitoring des requêtes lentes
-- =============================================

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
