-- Migration 011: index composite pour les requêtes agenda par merchant + date

CREATE INDEX idx_bookings_merchant_starts_at ON bookings(merchant_id, starts_at);
