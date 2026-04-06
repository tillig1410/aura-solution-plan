-- Add break_start and break_end to practitioner_availability
-- Stores the lunch break per practitioner per day
ALTER TABLE practitioner_availability
  ADD COLUMN IF NOT EXISTS break_start time DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS break_end time DEFAULT NULL;
