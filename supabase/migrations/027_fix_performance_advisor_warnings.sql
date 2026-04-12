-- Migration 027: Fix Supabase Performance Advisor warnings
-- Date: 2026-04-12
--
-- 1. Fix auth_rls_initplan: wrap auth.uid() in (select ...) for performance
-- 2. Fix multiple_permissive_policies: drop redundant *_service_role policies
--    (service_role bypasses RLS anyway, so these policies are dead weight)

-- =============================================================================
-- 1. Fix RLS initplan — replace auth.uid() with (select auth.uid())
-- =============================================================================

-- ai_token_usage
DROP POLICY IF EXISTS ai_token_usage_tenant_isolation ON ai_token_usage;
CREATE POLICY ai_token_usage_tenant_isolation ON ai_token_usage
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

-- system_notifications
DROP POLICY IF EXISTS system_notifications_tenant_isolation ON system_notifications;
CREATE POLICY system_notifications_tenant_isolation ON system_notifications
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())));

-- =============================================================================
-- 2. Drop redundant *_service_role policies (service_role bypasses RLS)
-- =============================================================================

-- bookings
DROP POLICY IF EXISTS bookings_service_role ON bookings;

-- client_packages
DROP POLICY IF EXISTS client_packages_service_role ON client_packages;

-- client_subscriptions
DROP POLICY IF EXISTS client_subscriptions_service_role ON client_subscriptions;

-- clients
DROP POLICY IF EXISTS clients_service_role ON clients;

-- conversations
DROP POLICY IF EXISTS conversations_service_role ON conversations;

-- loyalty_programs
DROP POLICY IF EXISTS loyalty_programs_service_role ON loyalty_programs;

-- merchants
DROP POLICY IF EXISTS merchants_service_role ON merchants;

-- messages
DROP POLICY IF EXISTS messages_service_role ON messages;

-- notifications
DROP POLICY IF EXISTS notifications_service_role ON notifications;

-- packages
DROP POLICY IF EXISTS packages_service_role ON packages;

-- practitioner_availability
DROP POLICY IF EXISTS practitioner_availability_service_role ON practitioner_availability;

-- practitioner_services
DROP POLICY IF EXISTS practitioner_services_service_role ON practitioner_services;

-- practitioners
DROP POLICY IF EXISTS practitioners_service_role ON practitioners;

-- services
DROP POLICY IF EXISTS services_service_role ON services;

-- tips
DROP POLICY IF EXISTS tips_service_role ON tips;
