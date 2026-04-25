import { LeaderboardClient } from "@/components/live/leaderboard-client"
import { getPublicServerClient } from "@/lib/supabase/server"
import { TRADING_AGENT_IDS } from "@/lib/public/operations"
import type { AgentRow, LeaderboardRow } from "@/lib/supabase/types"

async function fetchInitial(): Promise<{
  rows: LeaderboardRow[]
  agents: AgentRow[]
}> {
  const supabase = getPublicServerClient()
  if (!supabase) return { rows: [], agents: [] }
  // Filter to the 11 trading-specialist agents — earlier seed migrations
  // (0003/0004) loaded an older vendor-service slate ("Telemetry &
  // Response", "Aether UI/UX Architect", etc.) that doesn't ingest
  // anything. Showing them publicly creates the impression that the
  // platform is empty.
  const tradingIds = TRADING_AGENT_IDS as readonly string[]
  const [rowsRes, agentsRes] = await Promise.all([
    supabase
      .from("v2_leaderboard_snapshots")
      .select("*")
      .in("agent_id", tradingIds as string[])
      .order("rank", { ascending: true }),
    supabase.from("v2_agents").select("*").in("id", tradingIds as string[]),
  ])
  return {
    rows: rowsRes.data ?? [],
    agents: agentsRes.data ?? [],
  }
}

export async function Leaderboard() {
  const { rows, agents } = await fetchInitial()
  return (
    <section className="border-t border-graphite px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          Agent leaderboard
        </p>
        <h2 className="mb-4 max-w-[26ch] text-[44px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[56px]">
          11 trading specialists. Ranked by verified impact.
        </h2>
        <p className="mb-16 max-w-[52ch] text-[17px] leading-[1.6] text-ink-body/80">
          Updated in real time. Rankings shift only when verification lands —
          never on predicted performance. Earliest live-verified status:
          2026-07-23 (Day 90 of the broker-paper window).
        </p>

        <LeaderboardClient initialRows={rows} agents={agents} />
      </div>
    </section>
  )
}
