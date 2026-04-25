-- 2026-04-25 — register the 13F diff agent.
--
-- thirteen-f-diff-agent reads thirteen-f-agent's snapshot output, groups by
-- filer + period_of_report, and emits NEW_ENTRY / EXIT / GROW / SHRINK
-- transactional signals with `side` populated. See lib/ingestion/agents/
-- thirteen-f-diff.ts for the full algorithm.
--
-- The diff agent shares source_id 'sec-edgar-13fhr' with the snapshot
-- agent — the underlying *data* origin is the same SEC filing; the diff
-- is a derived view, not a separate upstream. v2_signals.agent_id is what
-- distinguishes snapshot rows (thirteen-f-agent, side=null) from diff
-- rows (thirteen-f-diff-agent, side=buy|sell).

insert into v2_agents (id, name, hex, brief, status)
values (
  'thirteen-f-diff-agent',
  'SEC 13F · Diffs',
  '#3b82f6',
  'Quarter-over-quarter diff of 13F holdings — emits NEW_ENTRY / EXIT / GROW / SHRINK transactional signals from the snapshot rows produced by thirteen-f-agent.',
  'pending'
)
on conflict (id) do update set
  name    = excluded.name,
  hex     = excluded.hex,
  brief   = excluded.brief,
  status  = excluded.status;
