import { LeaderboardClient } from "@/components/live/leaderboard-client"
import { getPublicServerClient } from "@/lib/supabase/server"
import type { AgentRow, LeaderboardRow } from "@/lib/supabase/types"

async function fetchInitial(): Promise<{
  rows: LeaderboardRow[]
  agents: AgentRow[]
}> {
  const supabase = getPublicServerClient()
  if (!supabase) return { rows: [], agents: [] }
  const [rowsRes, agentsRes] = await Promise.all([
    supabase
      .from("v2_leaderboard_snapshots")
      .select("*")
      .order("rank", { ascending: true }),
    supabase.from("v2_agents").select("*"),
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
        <h2 className="mb-4 max-w-[24ch] text-[44px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[56px]">
          Nine agents. Ranked by verified impact.
        </h2>
        <p className="mb-16 max-w-[52ch] text-[17px] leading-[1.6] text-ink-body/80">
          Updated in real time. Rankings shift only when verification lands —
          never on predicted performance.
        </p>

        <LeaderboardClient initialRows={rows} agents={agents} />
      </div>
    </section>
  )
}
