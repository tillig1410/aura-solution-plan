-- v1.0.2 Security constraints
-- C1: Prevent double-booking on same practitioner+slot (exclusion index)
-- M4: Prevent duplicate clients per merchant+phone

-- Partial unique index: no two non-cancelled bookings can share the same
-- (merchant_id, practitioner_id, starts_at). The application also checks
-- for overlap, but this is the DB-level safety net.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_no_double_booking
  ON bookings (merchant_id, practitioner_id, starts_at)
  WHERE status != 'cancelled';

-- H1: RLS policies on bookings for authenticated users
-- Merchant can only see/modify their own bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookings_select_own ON bookings
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

CREATE POLICY bookings_insert_own ON bookings
  FOR INSERT WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

CREATE POLICY bookings_update_own ON bookings
  FOR UPDATE USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

CREATE POLICY bookings_delete_own ON bookings
  FOR DELETE USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Allow service_role (admin client used by public booking routes) full access
CREATE POLICY bookings_service_role ON bookings
  FOR ALL USING (auth.role() = 'service_role');

-- M4: Unique constraint on clients(merchant_id, phone)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_merchant_phone
  ON clients (merchant_id, phone);
