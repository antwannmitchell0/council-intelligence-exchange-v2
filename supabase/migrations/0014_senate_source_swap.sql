-- 2026-04-24 — congress-agent upstream swap.
--
-- senatestockwatcher.com (the community JSON mirror originally wired in
-- migration 0013) went permanently offline; domain no longer resolves.
-- Replacement is the official Senate eFDSearch system, which we now query
-- directly via its CSRF/cookie-driven JSON + HTML pipeline.
--
-- The source_id ('senate-stock-watcher') is intentionally preserved — the
-- *logical* source is "Senate STOCK Act disclosures", which is unchanged.
-- Only the upstream gateway swapped. Keeping the same source_id preserves
-- the FK relationship in v2_signals + dedup continuity for any historical
-- rows that came from the community mirror.

update v2_sources
set
  name        = 'Senate eFDSearch — STOCK Act disclosures',
  description = 'Official Senate Clerk eFDSearch system. Three-step fetch (TOS agreement, DataTables JSON, per-PTR HTML detail). Replaces the dead senatestockwatcher.com community mirror. Dedup hash of (senator, date, ticker, type, amount).',
  endpoint    = 'https://efdsearch.senate.gov/search/'
where id = 'senate-stock-watcher';
