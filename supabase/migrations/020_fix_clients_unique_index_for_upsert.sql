-- Migration 020: convert clients (merchant_id, phone) partial unique index to full
--
-- Problem: PostgREST's `on_conflict=merchant_id,phone` query parameter cannot
-- infer PARTIAL unique indexes (those with a WHERE predicate). This causes
-- PostgreSQL error 42P10 "no unique or exclusion constraint matching the
-- ON CONFLICT specification" when n8n workflows upsert into clients.
--
-- Original index (from 004_create_clients.sql):
--   CREATE UNIQUE INDEX idx_clients_merchant_phone
--     ON clients(merchant_id, phone) WHERE phone IS NOT NULL;
--
-- Fix: drop the partial predicate. Semantics are preserved because PostgreSQL
-- NULLS DISTINCT default (PG 15+) still allows multiple NULL phones per
-- merchant in a non-partial unique index.
--
-- Verified safe against current data: no duplicate (merchant_id, phone) rows
-- exist as of 2026-04-11.

DROP INDEX IF EXISTS idx_clients_merchant_phone;

CREATE UNIQUE INDEX idx_clients_merchant_phone
  ON clients(merchant_id, phone);
