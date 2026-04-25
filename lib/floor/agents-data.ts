// Floor agent data — adapts v2's real ingestion-agent data into the
// v1 council-exchange "CouncilAgent" shape that the ported floor 3D
// components consume.
//
// v1's floor was built around 9 hardcoded agents with fake metrics
// (winRate=100%, totalSignals=11, etc.). v2 ports the same visual
// scene + FSM but populates it with the 11 real ingestion agents and
// real per-agent live data (lifetime signals, last signal body).
//
// Integrity contract: win rate stays at "—" until the 90-day broker-
// paper math gate earns it. v1's faked 100% is removed.

import type { FloorNickname } from "./nicknames"
import { allFloorNicknames } from "./nicknames"
import type { PublicAgentEntry } from "@/lib/public/types"
import { summarizeSignalBody, truncate } from "@/lib/public/signal-summary"

export type AgentStatus = "active" | "scanning" | "idle" | "signal"

export interface CouncilAgent {
  code: string // single-letter for badges / FSM personality lookup
  name: string // codename (PRIME, APEX, etc.)
  agent_id: string // real v2 ingestion agent id (insider-filing-agent, …)
  specialty: string // "Insider Clusters", "Crypto Momentum", etc.
  role: string
  version: string
  tier: 1 | 2 | 3
  // Real lifetime signal count from v2_signals.
  totalSignals: number
  // Parsed last-signal-body summary, or empty string if no signals yet.
  lastSignal: string
  status: AgentStatus
  deskPosition: [number, number, number]
  color: string
  isNova?: boolean
  dataSource: string
  schedule: string
  // Real lifetime trade-ticket counts from v2_trade_tickets.
  ordersSubmitted: number
  ordersFilled: number
  // Hours since last signal (for fresh-vs-stale display).
  hoursSinceLastSignal: number | null
  thesis: string
  citation: string
  detail: string
}

// ---- Desk grid for 11 agents --------------------------------------------
// Row 1 (back, z = -4): 6 desks
// Row 2 (front, z =  0): 5 desks
// Codes assigned to slots so that semantically related agents cluster:
//   Row 1: 13F (APEX), Etherscan (BOLT), Clinical (NOVA),
//          Fed Futures (FLUX), Jobs (PULSE), GDELT (CIPHER)
//   Row 2: Insider (PRIME), 13F-Diff (ECHO), Congress (HERALD),
//          Yield Curve (SAGE), Wiki (WAVE)
const DESK_POSITIONS: Record<string, [number, number, number]> = {
  // Back row
  APEX: [-7.5, 0, -4],
  BOLT: [-4.5, 0, -4],
  NOVA: [-1.5, 0, -4],
  FLUX: [1.5, 0, -4],
  PULSE: [4.5, 0, -4],
  CIPHER: [7.5, 0, -4],
  // Front row
  PRIME: [-6, 0, 0],
  ECHO: [-3, 0, 0],
  HERALD: [0, 0, 0],
  SAGE: [3, 0, 0],
  WAVE: [6, 0, 0],
}

// Single-letter codes for FSM personality lookup. Keep PRIME=P, NOVA=N, etc.
// New v2 agents (ECHO, PULSE) get unused single letters.
const CODE_LETTERS: Record<string, string> = {
  PRIME: "P",
  APEX: "A",
  ECHO: "E",
  HERALD: "H",
  SAGE: "S",
  PULSE: "U", // 'U' not 'P' — P taken by PRIME
  FLUX: "F",
  CIPHER: "C",
  WAVE: "W",
  BOLT: "B",
  NOVA: "N",
}

// Schedule strings — purely descriptive for the detail panel. Pulled from
// the agent's actual cron tick in vercel.ts.
const SCHEDULE: Record<string, string> = {
  "insider-filing-agent": "07:00 UTC daily",
  "thirteen-f-agent": "07:15 UTC daily",
  "thirteen-f-diff-agent": "07:45 UTC daily",
  "congress-agent": "07:30 UTC daily",
  "yield-curve-agent": "08:00 UTC daily",
  "jobs-data-agent": "08:15 UTC daily",
  "fed-futures-agent": "08:30 UTC daily",
  "gdelt-event-volume-agent": "10:00 UTC daily",
  "wiki-edit-surge-agent": "09:30 UTC daily",
  "etherscan-whale-agent": "11:00 UTC daily",
  "clinical-trial-outcomes-agent": "12:00 UTC daily",
}

const DATA_SOURCE: Record<string, string> = {
  "insider-filing-agent": "SEC EDGAR Form 4",
  "thirteen-f-agent": "SEC EDGAR 13F-HR + OpenFIGI",
  "thirteen-f-diff-agent": "v2_signals (derived)",
  "congress-agent": "Senate eFDSearch",
  "yield-curve-agent": "FRED (DGS2/DGS10/T10Y2Y)",
  "jobs-data-agent": "BLS Public Data API",
  "fed-futures-agent": "FRED (FEDFUNDS/DFEDTARU/DFEDTARL)",
  "gdelt-event-volume-agent": "GDELT 2.0",
  "wiki-edit-surge-agent": "Wikimedia Edit Stream",
  "etherscan-whale-agent": "Etherscan API",
  "clinical-trial-outcomes-agent": "ClinicalTrials.gov v2",
}

// Translate live freshness into the v1 status taxonomy. The FSM further
// drives DESK/MOVING/TALKING — this status is the *initial* one shown
// before the FSM picks up.
function deriveStatus(entry: PublicAgentEntry | undefined): AgentStatus {
  if (!entry) return "idle"
  const hb = entry.hours_since_heartbeat
  if (hb == null || hb > 72) return "idle"
  // Recent signal in last 36h → "signal" — visually amber, hot.
  if (
    entry.hours_since_last_signal != null &&
    entry.hours_since_last_signal < 36
  ) {
    return "signal"
  }
  // Recent heartbeat but no fresh signal → scanning (working, no firing).
  if (hb < 36) return "scanning"
  return "active"
}

/**
 * buildCouncilAgents — main adapter. Takes the v2 PublicAgentEntry list
 * (from getPublicAgentRoster) and returns v1-shape CouncilAgent[] with
 * the visual metadata + real per-agent live data merged.
 */
export function buildCouncilAgents(
  roster: PublicAgentEntry[]
): CouncilAgent[] {
  const nicknames = allFloorNicknames()
  const byAgentId = new Map<string, PublicAgentEntry>()
  for (const r of roster) byAgentId.set(r.agent_id, r)

  const out: CouncilAgent[] = []
  for (const n of nicknames) {
    // Strip the 👑 emoji from the nickname (NOVA is "NOVA 👑" in nicknames.ts).
    const codename = n.nickname.replace(/\s*👑\s*/, "").trim()
    const isNova = n.nickname.includes("👑")
    const code = CODE_LETTERS[codename] ?? codename[0]
    const desk = DESK_POSITIONS[codename] ?? [0, 0, 0]
    const live = byAgentId.get(n.agent_id)
    const lastSignalSummary = truncate(
      summarizeSignalBody(n.agent_id, live?.last_signal_body ?? null),
      120
    )

    out.push({
      code,
      name: codename,
      agent_id: n.agent_id,
      specialty: n.display_name.replace(/^SEC /, "").replace(/^Council · /, ""),
      role: n.display_name,
      version: "v2.0",
      tier: 1,
      totalSignals: live?.signals_lifetime ?? 0,
      lastSignal:
        lastSignalSummary ??
        "No signals yet — first publication will appear here.",
      status: deriveStatus(live),
      deskPosition: desk,
      color: n.hex,
      isNova,
      dataSource: DATA_SOURCE[n.agent_id] ?? "—",
      schedule: SCHEDULE[n.agent_id] ?? "—",
      ordersSubmitted: live?.orders_submitted_lifetime ?? 0,
      ordersFilled: live?.orders_filled_lifetime ?? 0,
      hoursSinceLastSignal: live?.hours_since_last_signal ?? null,
      thesis: n.thesis,
      citation: n.citation,
      detail: n.detail,
    })
  }
  return out
}
