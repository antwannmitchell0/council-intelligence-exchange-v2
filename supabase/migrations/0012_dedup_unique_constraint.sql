-- ============================================================================
-- FIX: promote unique index to named unique constraint for PostgREST upsert
-- ============================================================================
-- Migration 0011 replaced the partial unique index with a full unique index.
-- Symptom after that fix: the same 'No suitable key or wrong key type' error
-- kept firing on upsert, even after a `notify pgrst, 'reload schema'`.
--
-- Root cause: PostgREST's `on_conflict` resolver (used by supabase-js's
-- `.upsert({ onConflict: "..." })`) looks up a UNIQUE or PRIMARY KEY
-- *constraint* in information_schema.table_constraints. A bare unique
-- *index* (as created by CREATE UNIQUE INDEX) is not visible there —
-- only constraints are. PostgreSQL itself is fine with either for ON
-- CONFLICT, but PostgREST is stricter.
--
-- Fix: drop the unique index and replace with a named UNIQUE constraint.
-- This creates an underlying unique index automatically, plus a row in
-- information_schema.table_constraints that PostgREST can resolve.
--
-- Idempotent: safe to re-run.
-- ============================================================================

drop index if exists v2_signals_source_external_idx;

do $$ begin
  alter table v2_signals
    add constraint v2_signals_source_external_key
    unique (source_id, external_id);
exception when duplicate_object then null; end $$;

-- Make PostgREST pick up the new constraint without a server restart.
notify pgrst, 'reload schema';
