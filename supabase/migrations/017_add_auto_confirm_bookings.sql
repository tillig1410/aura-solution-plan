-- Add auto_confirm_bookings flag to merchants
-- When true, bookings from AI channels are automatically confirmed
-- When false (default), they remain pending until manually confirmed
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS auto_confirm_bookings boolean NOT NULL DEFAULT false;
