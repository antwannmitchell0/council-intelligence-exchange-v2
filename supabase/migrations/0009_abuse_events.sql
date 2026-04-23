-- ============================================================================
-- THE COUNCIL INTELLIGENCE EXCHANGE v2 — ABUSE EVENTS
-- ============================================================================
-- Append-only audit log of anti-abuse trips on public endpoints (currently
-- /api/marketplace/early-access). Written by the route handler after the
-- defense-in-depth stack blocks a request.
--
-- Privacy:
--   • ip_hash / ua_hash are sha256(ABUSE_HASH_SALT || value). Raw PII never
--     lands here. If the salt is missing, both columns are left null rather
--     than storing plaintext.
--   • Rotate ABUSE_HASH_SALT annually; old hashes become uncorrelatable by
--     design.
--
-- Access:
--   • Service role writes only (RLS enabled, no public policies).
--   • No public read — different from v2_integrity_events which is public.
--     Abuse events can leak defense internals, so keep them private.
-- ============================================================================

create table if not exists v2_abuse_events (
  id         bigserial primary key,
  route      text not null,
  ip_hash    text,                  -- sha256(salt || ip), null when salt unset
  ua_hash    text,                  -- sha256(salt || user-agent)
  reason     text not null,         -- 'honeypot'|'ratelimit'|'email-invalid'|'disposable'
  metadata   jsonb,
  blocked_at timestamptz not null default now()
);

create index if not exists v2_abuse_events_route_time_idx
  on v2_abuse_events (route, blocked_at desc);

alter table v2_abuse_events enable row level security;

-- Intentionally no policies: service_role bypasses RLS for inserts, and
-- public (anon/authenticated) roles have no access.
