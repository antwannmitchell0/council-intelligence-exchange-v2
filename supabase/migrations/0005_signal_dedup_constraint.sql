-- Phase 2 — signal dedup constraint.
-- Adds the columns and the unique index that BaseIngestionAgent.run() upserts against.
--
-- Rationale:
--   * Every ingestion agent produces a stable `external_id` (hash of source-specific
--     fields) so retries and overlapping cron windows do not create duplicate rows.
--   * `source_id` ties a signal back to a row in `v2_sources` for provenance.
--   * Partial unique index (`where external_id is not null`) lets legacy rows without
--     an external id coexist without violating uniqueness.
--
-- Idempotent: safe to re-run. Add-column / create-index use IF NOT EXISTS.

alter table v2_signals
  add column if not exists external_id text;

alter table v2_signals
  add column if not exists source_id text;

create unique index if not exists v2_signals_source_external_idx
  on v2_signals (source_id, external_id)
  where external_id is not null;

-- Optional FK — kept loose (no action on delete) so a retired source never
-- cascades into signal history. Wrap in do-block so re-runs don't error.
do $$ begin
  alter table v2_signals
    add constraint v2_signals_source_id_fkey
    foreign key (source_id) references v2_sources(id)
    on delete set null;
exception
  when duplicate_object then null;
  when undefined_table then null;
end $$;
