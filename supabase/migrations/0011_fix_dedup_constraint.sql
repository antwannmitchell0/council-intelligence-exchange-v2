-- ============================================================================
-- FIX: dedup constraint recognized by PostgREST as an ON CONFLICT target
-- ============================================================================
-- Migration 0005 created v2_signals_source_external_idx as a partial unique
-- index (WHERE external_id IS NOT NULL). Partial indexes ARE unique, but
-- PostgREST's upsert resolver refuses to treat them as valid ON CONFLICT
-- targets — it requires a full unique constraint or full unique index.
--
-- Symptom: Phase 4's first insider-filing cron fire returned
--   upsert_failed: No suitable key or wrong key type
-- from BaseIngestionAgent.run() at the v2_signals upsert step. This broke
-- every ingestion agent's write path and, by extension, the order router.
--
-- Fix: drop the partial, recreate as a full unique index on the same
-- columns. PostgreSQL treats NULL values in unique indexes as distinct
-- by default, so any legacy rows with (NULL, NULL) or (source_id, NULL)
-- continue to coexist without violation.
--
-- Idempotent: safe to re-run. DROP IF EXISTS handles first-run path;
-- CREATE UNIQUE INDEX IF NOT EXISTS handles re-run path.
-- ============================================================================

drop index if exists v2_signals_source_external_idx;

create unique index if not exists v2_signals_source_external_idx
  on v2_signals (source_id, external_id);
