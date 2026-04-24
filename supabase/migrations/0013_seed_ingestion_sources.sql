-- ============================================================================
-- SEED: v2_agents + v2_sources for the 10 ingestion agents
-- ============================================================================
-- Phase 2-6a shipped 10 ingestion agents in lib/ingestion/agents/, each with
-- a canonical agent_id (e.g. 'insider-filing-agent') and source_id
-- (e.g. 'sec-edgar-form4'). Neither set of identifiers was seeded — the
-- v2_agents seed 0003/0004 used a different slate of agent IDs from an
-- earlier planning round.
--
-- Symptoms caught in sequence during Phase 4:
--   1. v2_signals FK → v2_sources(source_id) failed ('sec-edgar-form4'
--      not in v2_sources)
--   2. v2_sources FK → v2_agents(agent_id) failed ('thirteen-f-agent'
--      not in v2_agents) once we tried to seed sources first
--
-- Fix: seed v2_agents first (10 placeholder rows for the ingestion set),
-- then seed v2_sources (one row per agent). Both use ON CONFLICT DO UPDATE
-- so re-running is idempotent and safe.
--
-- Agents land at status='pending' per the integrity contract — they will
-- graduate to verified through the broker-paper → live-verified pipeline,
-- not through manual seed promotion.
-- ============================================================================

-- ---- 1. Agent rows -------------------------------------------------------

insert into v2_agents (id, name, hex, brief, status)
values
  ('insider-filing-agent',          'SEC Insider Filing',      '#7dd3fc', 'SEC EDGAR Form 4 cluster-buy detector (Lakonishok & Lee 2001; Cohen, Malloy & Pomorski 2012).', 'pending'),
  ('thirteen-f-agent',              'SEC 13F',                 '#60a5fa', 'Institutional-investor 13F quarterly filings (Griffin & Xu 2009; Ali, Wei & Zhou 2011).', 'pending'),
  ('congress-agent',                'Congress Stock Watch',    '#a78bfa', 'STOCK Act disclosures from House + Senate (Ziobrowski et al. 2004, 2011).', 'pending'),
  ('yield-curve-agent',             'Yield Curve',             '#4ade80', 'FRED Treasury yield-curve inversion signal.', 'pending'),
  ('jobs-data-agent',               'Jobs Data',               '#fb923c', 'BLS monthly employment situation macro signal.', 'pending'),
  ('fed-futures-agent',             'Fed Futures',             '#f87171', 'FRED DFEDTARU / DFF as Fed-funds futures proxy.', 'pending'),
  ('gdelt-event-volume-agent',      'GDELT Event Volume',      '#facc15', 'GDELT 2.0 global-news event-volume anomaly detector.', 'pending'),
  ('wiki-edit-surge-agent',         'Wikipedia Edit Surge',    '#94a3b8', 'Wikimedia edit-velocity leading indicator.', 'pending'),
  ('etherscan-whale-agent',         'Etherscan Whale',         '#818cf8', 'On-chain ERC-20 + ETH whale transaction detector.', 'pending'),
  ('clinical-trial-outcomes-agent', 'Clinical Trial Outcomes', '#c084fc', 'ClinicalTrials.gov status-transition biotech catalyst signal.', 'pending')
on conflict (id) do update set
  name    = excluded.name,
  hex     = excluded.hex,
  brief   = excluded.brief,
  status  = v2_agents.status;   -- never downgrade a verified status via re-seed

-- ---- 2. Source rows (FK v2_sources.agent_id → v2_agents.id) --------------

insert into v2_sources (id, agent_id, name, kind, category, description, cadence, endpoint_public, endpoint, status, verified_at)
values
  ('sec-edgar-form4',            'insider-filing-agent',          'SEC EDGAR — Form 4 (insider transactions)',           'filing',   'regulatory',  'SEC full-text filing search index for Form 4 (officers/directors trading their own company stock). Dedup by accession.', '6h',      true, 'https://efts.sec.gov/LATEST/search-index',                  'verified', now()),
  ('sec-edgar-13fhr',            'thirteen-f-agent',              'SEC EDGAR — 13F-HR (institutional long positions)',   'filing',   'regulatory',  'SEC 13F quarterly institutional filings via EDGAR. 45-day post-period lag.',                                            '6h',      true, 'https://efts.sec.gov/LATEST/search-index',                  'verified', now()),
  ('senate-stock-watcher',       'congress-agent',                'Senate Stock Watcher — STOCK Act disclosures',        'api',      'regulatory',  'Community JSON mirror of Senate eFD disclosures. Dedup hash of (senator, date, ticker, type, amount).',                  'daily',   true, 'https://senatestockwatcher.com/api/v1/transactions',        'verified', now()),
  ('fred-yield-curve',           'yield-curve-agent',             'FRED — Treasury yield curve',                          'api',      'markets',     'FRED yield-curve observations (DGS2, DGS10) for 2s/10s inversion.',                                                    'daily',   true, 'https://api.stlouisfed.org/fred/series/observations',       'verified', now()),
  ('fred-fedfunds-proxy',        'fed-futures-agent',             'FRED — Fed funds futures proxy (DFEDTARU/DFF)',        'api',      'markets',     'FRED Fed Funds target ceiling + effective rate as Fed-futures proxy.',                                                 'daily',   true, 'https://api.stlouisfed.org/fred/series/observations',       'verified', now()),
  ('bls-jobs-report',            'jobs-data-agent',               'BLS — Monthly employment situation',                   'api',      'markets',     'Bureau of Labor Statistics public data API. Non-farm payrolls + unemployment rate.',                                   'monthly', true, 'https://api.bls.gov/publicAPI/v2/timeseries/data',          'verified', now()),
  ('gdelt-doc-timelinevolraw',   'gdelt-event-volume-agent',      'GDELT DOC 2.0 — timeline volume raw',                 'api',      'geopolitics', 'GDELT 2.0 global news-event volume time-series. Geopolitical risk anomaly detector.',                                  'daily',   true, 'https://api.gdeltproject.org/api/v2/doc/doc',                'verified', now()),
  ('wikimedia-pageviews',        'wiki-edit-surge-agent',         'Wikimedia — page edit velocity',                      'api',      'language',    'Wikimedia REST API for edit velocity on watchlist entities.',                                                          'daily',   true, 'https://wikimedia.org/api/rest_v1',                          'verified', now()),
  ('etherscan-txlist',           'etherscan-whale-agent',         'Etherscan — whale transaction list',                  'on-chain', 'on-chain',    'Etherscan free-tier ERC-20 + ETH transfers above a USD threshold. 3 req/s rate limit.',                                'daily',   true, 'https://api.etherscan.io/api',                               'verified', now()),
  ('clinicaltrials-gov-studies', 'clinical-trial-outcomes-agent', 'ClinicalTrials.gov — study registry',                 'api',      'science',     'ClinicalTrials.gov REST v2. Study status transitions as biotech catalysts.',                                           'daily',   true, 'https://clinicaltrials.gov/api/v2/studies',                  'verified', now())
on conflict (id) do update set
  agent_id        = excluded.agent_id,
  name            = excluded.name,
  kind            = excluded.kind,
  category        = excluded.category,
  description     = excluded.description,
  cadence         = excluded.cadence,
  endpoint_public = excluded.endpoint_public,
  endpoint        = excluded.endpoint,
  status          = excluded.status,
  verified_at     = excluded.verified_at;

-- Tell PostgREST to pick up fresh schema/data.
notify pgrst, 'reload schema';
