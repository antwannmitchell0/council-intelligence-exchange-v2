// Floor nicknames — the public face of the Council's trading specialists.
//
// On the floor, agents wear codenames. Click a desk and the panel reveals
// the real-world data source + thesis + academic citation behind the name.
// Same agent, two layers of identity:
//
//   Public-facing  → mythology (PRIME, CIPHER, BOLT, etc.)
//   Reveal layer   → real specialty (SEC Insider Filing, GDELT Event Volume...)
//
// The codename → agent_id map is the single source of truth. /admin and the
// API routes still use real agent_ids; only the floor + click-detail surface
// uses the nickname overlay.

export type FloorNickname = {
  // Codename worn on the floor (uppercase, single word).
  nickname: string
  // The real ingestion agent_id this maps to (exists in lib/ingestion/registry.ts).
  agent_id: string
  // The real-world specialty surfaced when clicked.
  display_name: string
  // One-line thesis a curious visitor can absorb in 5 seconds.
  thesis: string
  // Two-sentence "what this agent actually does" for the click-detail panel.
  detail: string
  // Academic / regulatory anchor — the credibility line.
  citation: string
  // Single-letter avatar (matches v1's pattern).
  letter: string
  // Hex color for the avatar tint + 3D figure emissive.
  // Pulled from the v2 violet/dark palette + accent hues.
  hex: string
}

// Color palette mirrors v1 council-exchange.vercel.app/floor exactly:
// PRIME=gold, CIPHER=purple, BOLT=blue, APEX=orange, SAGE=green,
// NOVA=pink (with 👑), FLUX=emerald, WAVE=indigo, HERALD=orange-bright.
// Plus ECHO=violet (variant of APEX) and PULSE=amber (cycle-pulse) for
// the v2-only agents that don't have v1 codenames.
export const FLOOR_NICKNAMES: FloorNickname[] = [
  {
    nickname: "PRIME",
    agent_id: "insider-filing-agent",
    display_name: "SEC Insider Filing",
    thesis: "Cluster-buy detection on Form 4 filings.",
    detail:
      "Watches every Form 4 the SEC publishes. When two or more insiders independently buy the same stock within 30 days, PRIME fires a cluster-buy signal — historically the most reliable insider tell.",
    citation: "Lakonishok & Lee 2001 · Cohen, Malloy & Pomorski 2012",
    letter: "P",
    hex: "#c9a84c", // gold (v1 PRIME)
  },
  {
    nickname: "APEX",
    agent_id: "thirteen-f-agent",
    display_name: "SEC 13F · Snapshots",
    thesis: "Institutional positioning, every quarter.",
    detail:
      "Pulls every 13F-HR information table from SEC EDGAR within 24 hours of filing, resolves CUSIPs to tickers via OpenFIGI, and emits one signal per (filer × holding). The full mosaic of who owns what.",
    citation: "Griffin & Xu 2009 · Ali, Wei & Zhou 2011",
    letter: "A",
    hex: "#f59e0b", // amber-orange (v1 APEX)
  },
  {
    nickname: "ECHO",
    agent_id: "thirteen-f-diff-agent",
    display_name: "SEC 13F · Diffs",
    thesis: "What changed between this quarter and last.",
    detail:
      "Reads APEX's snapshot output, groups by filer × period, and emits a signal whenever a position is added (NEW_ENTRY), exited (EXIT), grown >25% (GROW), or shrunk >25% (SHRINK). The alpha that snapshots can't surface alone.",
    citation: "Ziobrowski 2004 derivative methodology",
    letter: "E",
    hex: "#7c3aed", // violet (variant of APEX)
  },
  {
    nickname: "HERALD",
    agent_id: "congress-agent",
    display_name: "Congress · Senate eFDSearch",
    thesis: "STOCK Act disclosures, direct from the Clerk.",
    detail:
      "Scrapes the official Senate Clerk eFDSearch system every 24 hours for new Periodic Transaction Reports. Senator name, ticker, transaction type, amount range — surfaced before mainstream aggregators see it.",
    citation: "Ziobrowski et al. 2004, 2011",
    letter: "H",
    hex: "#fb923c", // orange-bright (v1 HERALD)
  },
  {
    nickname: "SAGE",
    agent_id: "yield-curve-agent",
    display_name: "Yield Curve",
    thesis: "The recession indicator nobody can argue with.",
    detail:
      "Pulls FRED 2Y / 10Y / 10Y-2Y spread daily. Flags inversions, regime shifts, and sign flips across the spread. The single most-watched macro recession signal.",
    citation: "Estrella & Mishkin 1998 · Engstrom & Sharpe 2018",
    letter: "S",
    hex: "#4ade80", // green (v1 SAGE)
  },
  {
    nickname: "PULSE",
    agent_id: "jobs-data-agent",
    display_name: "Jobs Data",
    thesis: "BLS employment situation, the day it lands.",
    detail:
      "Captures nonfarm payrolls + unemployment rate the moment BLS publishes the monthly employment-situation report. Surprises against forecast are the strongest macro reaction trigger of the month.",
    citation: "BLS Public Data API v2",
    letter: "U",
    hex: "#fbbf24", // amber (cycle-pulse)
  },
  {
    nickname: "FLUX",
    agent_id: "fed-futures-agent",
    display_name: "Fed Futures",
    thesis: "Rate expectations in real time.",
    detail:
      "Pulls FRED FEDFUNDS / DFEDTARU / DFEDTARL daily. Tracks the Fed-funds futures proxy for monetary policy expectations — the single most market-moving macro variable.",
    citation: "Federal Reserve Economic Data",
    letter: "F",
    hex: "#34d399", // emerald (v1 FLUX)
  },
  {
    nickname: "CIPHER",
    agent_id: "gdelt-event-volume-agent",
    display_name: "GDELT Event Volume",
    thesis: "Decoding the global news firehose.",
    detail:
      "Watches GDELT 2.0 — every news event from 100,000+ sources worldwide. Detects entity-level event-volume anomalies (sudden surge of mentions for a company, country, or topic) before headlines hit aggregators.",
    citation: "Leetaru & Schrodt — GDELT Project",
    letter: "C",
    hex: "#a78bfa", // purple (v1 CIPHER)
  },
  {
    nickname: "WAVE",
    agent_id: "wiki-edit-surge-agent",
    display_name: "Wikipedia Edit Surge",
    thesis: "Attention as a leading indicator.",
    detail:
      "Monitors Wikipedia edit velocity per article. Sudden surges on a company's page often precede M&A, scandals, or product announcements by 24–72 hours. The early warning system inside the public encyclopedia.",
    citation: "Moat et al. 2013 · Preis et al. 2013",
    letter: "W",
    hex: "#818cf8", // indigo (v1 WAVE)
  },
  {
    nickname: "BOLT",
    agent_id: "etherscan-whale-agent",
    display_name: "Etherscan Whale",
    thesis: "On-chain whale moves before they hit the tape.",
    detail:
      "Watches every ERC-20 + ETH transaction over a configurable threshold. Tracks whale wallets, exchange inflows/outflows, and large holder behavior — the on-chain equivalent of insider buying.",
    citation: "Etherscan API · public Ethereum mainnet",
    letter: "B",
    hex: "#60a5fa", // blue (v1 BOLT)
  },
  {
    nickname: "NOVA 👑",
    agent_id: "clinical-trial-outcomes-agent",
    display_name: "Clinical Trials",
    thesis: "Phase 3 readouts, the moment they publish.",
    detail:
      "Polls ClinicalTrials.gov v2 API for status transitions on Phase 3 trials. Phase 3 readouts are the dominant binary catalyst in biotech equities — capturing them at publication, before mainstream aggregators, is a direct mechanical edge.",
    citation: "DiMasi, Grabowski, Hansen 2016",
    letter: "N",
    hex: "#f472b6", // pink (v1 NOVA)
  },
]

// Lookup helpers ------------------------------------------------------------

const BY_AGENT_ID = new Map<string, FloorNickname>(
  FLOOR_NICKNAMES.map((n) => [n.agent_id, n])
)

const BY_NICKNAME = new Map<string, FloorNickname>(
  FLOOR_NICKNAMES.map((n) => [n.nickname, n])
)

export function nicknameForAgent(agent_id: string): FloorNickname | null {
  return BY_AGENT_ID.get(agent_id) ?? null
}

export function agentForNickname(nickname: string): FloorNickname | null {
  return BY_NICKNAME.get(nickname.toUpperCase()) ?? null
}

/** All nicknames, in the canonical floor render order. */
export function allFloorNicknames(): FloorNickname[] {
  return FLOOR_NICKNAMES
}
