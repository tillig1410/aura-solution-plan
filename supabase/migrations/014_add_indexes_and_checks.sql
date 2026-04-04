-- Migration 014: Missing indexes and CHECK constraints (review fixes)

-- =============================================
-- INDEXES
-- =============================================

-- notifications.client_id — FK sans index, requêtes lentes par client
CREATE INDEX IF NOT EXISTS idx_notifications_client_id
  ON notifications(client_id);

-- messages(conversation_id, created_at DESC) — pagination par date dans les conversations
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
  ON messages(conversation_id, created_at DESC);

-- clients(merchant_id, created_at DESC) — listing clients triés par date
CREATE INDEX IF NOT EXISTS idx_clients_merchant_created_at
  ON clients(merchant_id, created_at DESC);

-- =============================================
-- CHECK CONSTRAINTS
-- =============================================

-- services.duration_minutes > 0 — empêcher durée nulle ou négative
ALTER TABLE services
  ADD CONSTRAINT chk_services_duration_positive
  CHECK (duration_minutes > 0);

-- services.price_cents >= 0 — empêcher prix négatif
ALTER TABLE services
  ADD CONSTRAINT chk_services_price_non_negative
  CHECK (price_cents >= 0);

-- merchants.seat_count > 0 — empêcher 0 sièges (casse la facturation)
ALTER TABLE merchants
  ADD CONSTRAINT chk_merchants_seat_count_positive
  CHECK (seat_count > 0);

-- bookings.ends_at > starts_at — empêcher durée nulle ou inversée
ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_ends_after_starts
  CHECK (ends_at > starts_at);

-- client_packages.expires_at >= purchased_at — cohérence temporelle
ALTER TABLE client_packages
  ADD CONSTRAINT chk_client_packages_expiry_after_purchase
  CHECK (expires_at IS NULL OR expires_at >= purchased_at);
