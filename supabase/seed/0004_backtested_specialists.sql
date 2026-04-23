-- Seed the 8 statistically-significant v1 backtested trading specialists into v2_agents.
-- These are the agents whose back-data showed IC > 0.15 with t-stat > 2 (95%+ significance)
-- across 36–120 real (non-backfill) paper-traded signals over 2 years.
--
-- Status is 'pending' because:
--   1. All metrics are paper-traded (not broker-attested, not live)
--   2. After realistic 30bps transaction costs, none are individually profitable
--   3. The edge is expected to emerge from Tier-2 ensemble combination + broker-paper validation
--
-- When broker-paper-trading for 90+ days confirms IC persistence, status graduates to 'verified'.

insert into v2_agents (id, name, hex, brief, bio_md, status) values
  (
    'earnings-whisper-agent',
    'Earnings Whisper Specialist',
    '#EAB308',
    'Earnings surprise divergence — whisper numbers vs consensus. Real IC 0.39 on 76 paper signals (t-stat 3.65).',
    $$**Specialty:** Classifies earnings announcements by whisper-vs-consensus divergence.
**Thesis:** When informed traders' whisper numbers diverge materially from sell-side consensus, post-earnings drift captures the gap (PEAD anomaly, Bernard & Thomas 1989).
**Data source:** Earnings whisper aggregation + SEC EDGAR filings (free).
**Paper-trade record:** 76 real (non-backfill) signals, Dec 2023 – Mar 2026. IC +0.39, t-stat 3.65 (statistically significant at >99%).
**After 30bps cost:** individually NOT profitable. Edge surfaces in ensemble combination (see Confidential Agent Playbook).
**Status: pending** — paper-traded, not broker-attested. Graduates to verified after 90 days of broker-paper tracking.$$,
    'pending'
  ),
  (
    'put-call-ratio-agent',
    'Put/Call Ratio Specialist',
    '#DC2626',
    'Options positioning anomaly detector. IC 0.39 on 72 paper signals (t-stat 3.53).',
    $$**Specialty:** Detects extreme put/call ratio readings that historically precede directional moves.
**Thesis:** Unusual options flow reveals informed positioning ahead of catalysts (Cremers & Weinbaum 2010 on skewness).
**Data source:** CBOE delayed options data (free, 15-min delay).
**Paper-trade record:** 72 real signals, Dec 2023 – Mar 2026. IC +0.39, t-stat 3.53 (>99% significance).
**After 30bps cost:** individually NOT profitable. Strong ensemble candidate.
**Status: pending** — paper-traded. Requires broker-paper validation before graduation.$$,
    'pending'
  ),
  (
    'noaa-weather-agent',
    'NOAA Weather Specialist',
    '#34D399',
    'Weather anomaly impact on commodity-exposed sectors. IC 0.38 on 38 paper signals (t-stat 2.45).',
    $$**Specialty:** Predicts sector impact from regional weather anomalies (agricultural, energy, insurance).
**Thesis:** Major weather events create supply-side disruptions that markets price with delay, especially in ag commodities, natural gas, and insurance.
**Data source:** NOAA.gov (free, US government, unrestricted commercial use).
**Paper-trade record:** 38 real signals. IC +0.38, t-stat 2.45 (95%+ significance). Small sample — confidence interval wide.
**After 30bps cost:** individually NOT profitable.
**Status: pending** — small sample size + paper-traded. Extended tracking recommended before graduation.$$,
    'pending'
  ),
  (
    'insider-filing-agent',
    'Insider Filing Specialist',
    '#1E40AF',
    'Multi-executive cluster buying detection. IC 0.36 on 50 paper signals (t-stat 2.71).',
    $$**Specialty:** Detects clusters of insider purchases by multiple executives (not single-exec, which is noisy).
**Thesis:** When 2+ executives buy in close succession, conviction is structurally higher (Lakonishok & Lee 2001; Cohen, Malloy, Pomorski 2012).
**Data source:** SEC EDGAR Form 4 (free, US government, unrestricted commercial use).
**Paper-trade record:** 50 real signals, Dec 2023 – Mar 2026. IC +0.36, t-stat 2.71 (95%+).
**After 30bps cost:** individually NOT profitable. Academically robust underlying strategy.
**Status: pending** — paper-traded. Natural pairing with Earnings Whisper (shared 8 tickers in historical data).$$,
    'pending'
  ),
  (
    'tsa-throughput-agent',
    'TSA Throughput Specialist',
    '#64748B',
    'Air travel demand leading indicator. Inversely calibrated — IC -0.45 on 52 paper signals (t-stat -3.53).',
    $$**Specialty:** Air travel volume anomalies as leading indicator for airlines, hotels, travel-adjacent retail.
**Thesis:** TSA throughput shifts precede earnings for travel-exposed companies by 2–6 weeks.
**Data source:** TSA.gov daily throughput data (free, US government, unrestricted).
**Paper-trade record:** 52 real signals. IC -0.45, t-stat -3.53 (>99% significance).
**Important — conviction inverted:** the agent's high-conviction signals systematically underperformed. The *information content is real* but the calibration is inverted. Recommended use: invert the signal direction for ensemble inclusion.
**After 30bps cost + sign flip:** individually NOT profitable, but contributes to ensemble variance.
**Status: pending** — requires direction-flip logic before activation.$$,
    'pending'
  ),
  (
    'ma-intelligence-agent',
    'M&A Intelligence Specialist',
    '#E11D48',
    'Pre-announcement M&A pattern detection. Inversely calibrated — IC -0.42 on 42 signals (t-stat -2.90).',
    $$**Specialty:** Detects M&A-relevant patterns across press wire, insider activity, 13D filings.
**Thesis:** M&A leaks create information asymmetry — some signals front-run announcements, others are misreads.
**Data source:** Public press releases + SEC filings (free).
**Paper-trade record:** 42 real signals. IC -0.42, t-stat -2.90 (>99%).
**Conviction inverted:** same calibration issue as TSA agent. Information is real, but conviction maps inversely to outcome.
**After 30bps cost + sign flip:** still not individually profitable.
**Status: pending** — requires calibration fix. Small sample.$$,
    'pending'
  ),
  (
    'jobs-data-agent',
    'Jobs Data Specialist',
    '#F59E0B',
    'Labor market leading indicator. Inversely calibrated — IC -0.32 on 120 signals (t-stat -3.70).',
    $$**Specialty:** Interprets BLS jobs reports for sector impact (retail, REITs, regional banks).
**Thesis:** Nonfarm payrolls and wage data precede sector earnings via consumer-spending and rate-path channels.
**Data source:** BLS.gov monthly jobs reports (free, US government, unrestricted).
**Paper-trade record:** 120 real signals — largest sample in the roster. IC -0.32, t-stat -3.70 (>99.9%).
**Conviction inverted:** high conviction maps to worse outcomes. Strong statistical signal, needs direction flip.
**After 30bps cost + sign flip:** still marginal individually but statistical power is high due to large N.
**Status: pending** — best candidate for calibration fix given large sample.$$,
    'pending'
  ),
  (
    'port-flow-agent',
    'Port Flow Specialist',
    '#0891B2',
    'Shipping & port volume anomaly detector. Inversely calibrated — IC -0.29 on 66 signals (t-stat -2.47).',
    $$**Specialty:** Anomalies in port throughput signal inventory, supply-chain, and retail impacts.
**Thesis:** Container and port-volume anomalies lead retail and industrial earnings by 30–60 days.
**Data source:** Public US port authority data (free, scattered across agencies).
**Paper-trade record:** 66 real signals. IC -0.29, t-stat -2.47 (95%+).
**Conviction inverted:** same calibration pattern as other negative-IC agents.
**After 30bps cost + sign flip:** individually marginal.
**Status: pending** — requires calibration + data pipeline consolidation (free but fragmented sources).$$,
    'pending'
  )
on conflict (id) do update set
  name = excluded.name,
  hex = excluded.hex,
  brief = excluded.brief,
  bio_md = excluded.bio_md;

select
  id,
  name,
  status,
  substring(brief from 1 for 60) as brief_preview
from v2_agents
where id in (
  'earnings-whisper-agent','put-call-ratio-agent','noaa-weather-agent','insider-filing-agent',
  'tsa-throughput-agent','ma-intelligence-agent','jobs-data-agent','port-flow-agent'
)
order by id;
