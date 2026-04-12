-- Migration 028: Add missing foreign key indexes (Performance Advisor)
-- Date: 2026-04-12

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_conversation_id
  ON ai_token_usage(conversation_id);

CREATE INDEX IF NOT EXISTS idx_bookings_service_id
  ON bookings(service_id);

CREATE INDEX IF NOT EXISTS idx_message_rate_log_merchant_id
  ON message_rate_log(merchant_id);

CREATE INDEX IF NOT EXISTS idx_packages_service_id
  ON packages(service_id);
