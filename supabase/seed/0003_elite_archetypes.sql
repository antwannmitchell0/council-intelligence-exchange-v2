-- Seed the 7 free-data-source elite archetypes into the v2_agents catalog.
-- All ship as status='pending' (no back data yet). Bios document the thesis,
-- data source, methodology, and academic evidence. No performance claims.
-- When each one accrues real back data, it graduates to status='verified'.

insert into v2_agents (id, name, hex, brief, bio_md, status) values
  (
    'gdelt-geopolitical',
    'Geopolitical Event Scanner',
    '#FDE047',
    'Detects geopolitical tensions via global event database. Edge in defense, energy, semiconductor sectors before mainstream headlines.',
    $$**Thesis:** Geopolitical tensions leak into global news coverage 24–72 hours before equity markets price the risk.
**Data source:** GDELT Project (gdeltproject.org) — 100% free, 15-minute updates, CAMEO-coded events from 50,000+ news outlets.
**Methodology:** Event-volume anomaly detection on CAMEO codes for military, diplomatic, and economic-pressure events, filtered to countries with >$10B trade exposure to US sectors.
**Academic evidence:** Leetaru & Schrodt (2013), *GDELT: Global Data on Events, Language, and Tone*. Used in macro/FX research at multiple institutional shops.
**Status:** Pending. Ingestion pipeline not yet wired. Verification begins after 90 days of broker-paper tracking.$$,
    'pending'
  ),
  (
    'sec-language-shift',
    'SEC Language Shift',
    '#818CF8',
    'NLP detection of management tone changes in 10-K and 10-Q filings. Catches guidance shifts before earnings surprises.',
    $$**Thesis:** When management quietly increases mentions of "supply chain," "regulatory," or "uncertainty" quarter-over-quarter, guidance revisions often follow within 1–2 quarters.
**Data source:** SEC EDGAR (data.sec.gov) — free, 10 req/sec unregistered (higher with User-Agent), full-text 10-K/10-Q archive.
**Methodology:** Loughran-McDonald financial sentiment dictionary applied to year-over-year quarterly filings. Flag filings with >2σ shift in risk-factor language density.
**Academic evidence:** Loughran & McDonald (2011), *When Is a Liability Not a Liability? Textual Analysis, Dictionaries, and 10-Ks.* Journal of Finance. Foundational paper, cited thousands of times.
**Status:** Pending. Pipeline and model not yet deployed.$$,
    'pending'
  ),
  (
    'fred-macro-regime',
    'Macro Regime Compass',
    '#14B8A6',
    'Composite macro regime detector via yield curve, VIX, dollar, and credit spreads. Routes other agents based on risk-on vs risk-off.',
    $$**Thesis:** Most equity signals work in one regime and fail in another. A live regime classifier turns brittle signals into regime-conditional signals.
**Data source:** FRED (fred.stlouisfed.org) — free with API key, ~120,000 macroeconomic series.
**Methodology:** Composite index from 10Y-2Y yield spread, VIX, DXY, BAML HY OAS credit spread. Hidden Markov Model (Hamilton 1989) classifies current regime as Risk-On / Risk-Off / Transitional.
**Academic evidence:** Hamilton (1989), *A New Approach to the Economic Analysis of Nonstationary Time Series and the Business Cycle.* Chen/Roll/Ross (1986) on macro factors. Used across institutional quant shops for regime-gating.
**Status:** Pending. HMM not yet trained on data.$$,
    'pending'
  ),
  (
    'wiki-edit-surge',
    'Wiki Edit Surge',
    '#F472B6',
    'Surge detection in Wikipedia edit frequency on company pages. Often precedes M&A, scandals, or product announcements by 24–72h.',
    $$**Thesis:** Edits spike on a company's Wikipedia page when insiders, journalists, or informed parties update narrative details ahead of public announcements.
**Data source:** Wikipedia API + Pageviews API (wikimedia.org) — free, open license (CC-BY-SA for content; edit metadata is public fact).
**Methodology:** Time-series anomaly detection on edit counts per S&P 500 article page, controlled for baseline activity and category. Flag when edit rate exceeds 4σ over 30-day baseline.
**Academic evidence:** Moat et al. (2013), *Quantifying Wikipedia Usage Patterns Before Stock Market Moves,* Scientific Reports. Significant predictive power documented for pageviews; edit anomalies less studied but mechanistically plausible.
**Status:** Pending. Exploratory — requires validation before promotion.$$,
    'pending'
  ),
  (
    'chain-whale',
    'On-Chain Whale Tracker',
    '#22D3EE',
    'Tracks large wallet movements on public blockchains. Primary edge for crypto; secondary edge for crypto-adjacent equities (COIN, MSTR, miners).',
    $$**Thesis:** Large wallet moves on-chain often precede crypto-price moves by hours, and by extension affect COIN, MSTR, mining stocks, and stablecoin issuers.
**Data source:** Etherscan API + blockchain.com API — free tiers available (3 calls/sec, 100K/day on Etherscan), attribution required.
**Methodology:** Monitor wallets holding >$10M of ETH or BTC for outbound movements. Classify destination as exchange (likely sell) vs cold storage (likely hold). Flag concentrated movements in 60-min windows.
**Academic evidence:** Griffin & Shams (2020), *Is Bitcoin Really Untethered?* Journal of Finance. Widely used in crypto quant; less academic but highly practical.
**Status:** Pending. Ingestion not yet live.$$,
    'pending'
  ),
  (
    'fed-voice',
    'Fed Voice Analyst',
    '#A855F7',
    'NLP on FOMC statements and Fed governor speeches. Detects hawkish/dovish shifts via language delta vs prior cadence.',
    $$**Thesis:** Subtle word-choice shifts in Fed communications signal policy-stance changes weeks before they're reflected in dot plots or action.
**Data source:** federalreserve.gov — FOMC statements, minutes, speeches all free and downloadable as HTML/PDF.
**Methodology:** Hawkish/dovish scoring via FOMC-specific lexicon (trained on historical statements). Compute delta vs rolling 12-meeting mean. Statistically significant deltas signal policy drift.
**Academic evidence:** Hansen & McMahon (2016), *Shocking Language: Understanding the Macroeconomic Effects of Central Bank Communication,* Journal of International Economics. Shapiro & Wilson (2019), *Taking the Fed at its Word: A New Approach to Estimating Central Bank Objectives,* SF Fed Working Paper.
**Status:** Pending. Lexicon and pipeline not yet built.$$,
    'pending'
  ),
  (
    'trial-outcomes',
    'Clinical Trial Outcome Predictor',
    '#10B981',
    'Predicts Phase III trial success probability from trial design + historical analogs. Biotech catalyst trading edge.',
    $$**Thesis:** Phase III success rates vary predictably by indication, trial design, sample size, primary endpoint, and sponsor history. Many retail biotech traders treat all trials as coin-flips; a proper prior does not.
**Data source:** ClinicalTrials.gov v2 API + FDA.gov — both free, structured, commercially usable (US government works).
**Methodology:** Bayesian success-rate model conditioned on therapeutic area, trial-design features, endpoint type, and sponsor track record. Calibrated on historical approvals/failures from 2010 onward.
**Academic evidence:** DiMasi et al. (2003, 2016), *Clinical Approval Success Rates for Investigational Drugs.* Well-documented base rates by phase and indication. Biotech-focused hedge funds use variants of this approach.
**Status:** Pending. Model not yet trained.$$,
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
  status
from v2_agents
where id in (
  'gdelt-geopolitical',
  'sec-language-shift',
  'fred-macro-regime',
  'wiki-edit-surge',
  'chain-whale',
  'fed-voice',
  'trial-outcomes'
)
order by id;
