-- Migration 015: Corrections critiques Postgres Best Practices
-- 1. RLS Performance: (SELECT auth.uid()) cache dans toutes les politiques
-- 2. FORCE ROW LEVEL SECURITY + WITH CHECK sur INSERT + service_role
-- 3. Index manquants sur FK

-- =============================================
-- 1. RLS PERFORMANCE — Recréer toutes les politiques avec (SELECT auth.uid())
-- =============================================

-- Helper: sous-requête tenant cachée (utilisée dans toutes les politiques)
-- Pattern: merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid()))

-- ----- merchants (001) -----
DROP POLICY IF EXISTS "merchants_tenant_isolation" ON merchants;

CREATE POLICY "merchants_select_own" ON merchants
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "merchants_insert_own" ON merchants
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "merchants_update_own" ON merchants
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "merchants_delete_own" ON merchants
  FOR DELETE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "merchants_service_role" ON merchants
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- practitioners (002) -----
DROP POLICY IF EXISTS "practitioners_tenant_isolation" ON practitioners;

CREATE POLICY "practitioners_select_own" ON practitioners
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioners_insert_own" ON practitioners
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioners_update_own" ON practitioners
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioners_delete_own" ON practitioners
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioners_service_role" ON practitioners
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- practitioner_availability (002) -----
DROP POLICY IF EXISTS "practitioner_availability_tenant_isolation" ON practitioner_availability;

CREATE POLICY "practitioner_availability_select_own" ON practitioner_availability
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioner_availability_insert_own" ON practitioner_availability
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioner_availability_update_own" ON practitioner_availability
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioner_availability_delete_own" ON practitioner_availability
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioner_availability_service_role" ON practitioner_availability
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- services (003) -----
DROP POLICY IF EXISTS "services_tenant_isolation" ON services;

CREATE POLICY "services_select_own" ON services
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "services_insert_own" ON services
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "services_update_own" ON services
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "services_delete_own" ON services
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "services_service_role" ON services
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- practitioner_services (003) -----
DROP POLICY IF EXISTS "practitioner_services_tenant_isolation" ON practitioner_services;

CREATE POLICY "practitioner_services_select_own" ON practitioner_services
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioner_services_insert_own" ON practitioner_services
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioner_services_update_own" ON practitioner_services
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioner_services_delete_own" ON practitioner_services
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "practitioner_services_service_role" ON practitioner_services
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- clients (004) -----
DROP POLICY IF EXISTS "clients_tenant_isolation" ON clients;

CREATE POLICY "clients_select_own" ON clients
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "clients_insert_own" ON clients
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "clients_update_own" ON clients
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "clients_delete_own" ON clients
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "clients_service_role" ON clients
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- bookings (005/013) — déjà séparées dans 013, on les remplace avec (SELECT) -----
DROP POLICY IF EXISTS "bookings_select_own" ON bookings;
DROP POLICY IF EXISTS "bookings_insert_own" ON bookings;
DROP POLICY IF EXISTS "bookings_update_own" ON bookings;
DROP POLICY IF EXISTS "bookings_delete_own" ON bookings;
DROP POLICY IF EXISTS "bookings_service_role" ON bookings;

CREATE POLICY "bookings_select_own" ON bookings
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "bookings_insert_own" ON bookings
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "bookings_update_own" ON bookings
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "bookings_delete_own" ON bookings
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "bookings_service_role" ON bookings
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- conversations (006) -----
DROP POLICY IF EXISTS "conversations_tenant_isolation" ON conversations;

CREATE POLICY "conversations_select_own" ON conversations
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "conversations_insert_own" ON conversations
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "conversations_update_own" ON conversations
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "conversations_delete_own" ON conversations
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "conversations_service_role" ON conversations
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- messages (006) -----
DROP POLICY IF EXISTS "messages_tenant_isolation" ON messages;

CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "messages_service_role" ON messages
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- notifications (007) -----
DROP POLICY IF EXISTS "notifications_tenant_isolation" ON notifications;

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "notifications_service_role" ON notifications
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- tips (008) -----
DROP POLICY IF EXISTS "tips_tenant_isolation" ON tips;

CREATE POLICY "tips_select_own" ON tips
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "tips_insert_own" ON tips
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "tips_update_own" ON tips
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "tips_delete_own" ON tips
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "tips_service_role" ON tips
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- packages (009) -----
DROP POLICY IF EXISTS "packages_tenant_isolation" ON packages;

CREATE POLICY "packages_select_own" ON packages
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "packages_insert_own" ON packages
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "packages_update_own" ON packages
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "packages_delete_own" ON packages
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "packages_service_role" ON packages
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- client_packages (009) -----
DROP POLICY IF EXISTS "client_packages_tenant_isolation" ON client_packages;

CREATE POLICY "client_packages_select_own" ON client_packages
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "client_packages_insert_own" ON client_packages
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "client_packages_update_own" ON client_packages
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "client_packages_delete_own" ON client_packages
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "client_packages_service_role" ON client_packages
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- client_subscriptions (010) -----
DROP POLICY IF EXISTS "client_subscriptions_tenant_isolation" ON client_subscriptions;

CREATE POLICY "client_subscriptions_select_own" ON client_subscriptions
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "client_subscriptions_insert_own" ON client_subscriptions
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "client_subscriptions_update_own" ON client_subscriptions
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "client_subscriptions_delete_own" ON client_subscriptions
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "client_subscriptions_service_role" ON client_subscriptions
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- loyalty_programs (010) -----
DROP POLICY IF EXISTS "loyalty_programs_tenant_isolation" ON loyalty_programs;

CREATE POLICY "loyalty_programs_select_own" ON loyalty_programs
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "loyalty_programs_insert_own" ON loyalty_programs
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "loyalty_programs_update_own" ON loyalty_programs
  FOR UPDATE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "loyalty_programs_delete_own" ON loyalty_programs
  FOR DELETE USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "loyalty_programs_service_role" ON loyalty_programs
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- ----- stripe_events (012) — recréer avec (SELECT) -----
DROP POLICY IF EXISTS "stripe_events_service_role_only" ON stripe_events;

CREATE POLICY "stripe_events_service_role" ON stripe_events
  FOR ALL USING ((SELECT auth.role()) = 'service_role');


-- =============================================
-- 2. FORCE ROW LEVEL SECURITY — empêcher le table owner de bypass RLS
-- =============================================

ALTER TABLE merchants FORCE ROW LEVEL SECURITY;
ALTER TABLE practitioners FORCE ROW LEVEL SECURITY;
ALTER TABLE practitioner_availability FORCE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;
ALTER TABLE practitioner_services FORCE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE tips FORCE ROW LEVEL SECURITY;
ALTER TABLE packages FORCE ROW LEVEL SECURITY;
ALTER TABLE client_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE client_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs FORCE ROW LEVEL SECURITY;
ALTER TABLE stripe_events FORCE ROW LEVEL SECURITY;


-- =============================================
-- 3. INDEX MANQUANTS SUR FK — éviter les seq scans sur CASCADE/JOIN
-- =============================================

-- clients.preferred_practitioner_id (FK → practitioners, ON DELETE SET NULL)
CREATE INDEX IF NOT EXISTS idx_clients_preferred_practitioner
  ON clients(preferred_practitioner_id)
  WHERE preferred_practitioner_id IS NOT NULL;

-- clients.preferred_service_id (FK → services, ON DELETE SET NULL)
CREATE INDEX IF NOT EXISTS idx_clients_preferred_service
  ON clients(preferred_service_id)
  WHERE preferred_service_id IS NOT NULL;

-- tips.booking_id (FK → bookings, ON DELETE SET NULL)
CREATE INDEX IF NOT EXISTS idx_tips_booking_id
  ON tips(booking_id)
  WHERE booking_id IS NOT NULL;

-- client_packages.package_id (FK → packages, ON DELETE RESTRICT)
CREATE INDEX IF NOT EXISTS idx_client_packages_package_id
  ON client_packages(package_id);

-- client_subscriptions.service_id (FK → services, ON DELETE RESTRICT)
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_service_id
  ON client_subscriptions(service_id);

-- practitioner_services: lookup par practitioner seul et par service seul
-- (la PK composite merchant_id,practitioner_id,service_id ne couvre pas ces cas)
CREATE INDEX IF NOT EXISTS idx_practitioner_services_practitioner
  ON practitioner_services(practitioner_id);

CREATE INDEX IF NOT EXISTS idx_practitioner_services_service
  ON practitioner_services(service_id);
