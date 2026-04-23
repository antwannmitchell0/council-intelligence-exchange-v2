import { LiveFeedClient } from "@/components/live/live-feed-client"
import { getPublicServerClient } from "@/lib/supabase/server"
import type { AgentRow, SignalRow } from "@/lib/supabase/types"

async function fetchInitial(): Promise<{
  signals: SignalRow[]
  agents: AgentRow[]
}> {
  const supabase = getPublicServerClient()
  if (!supabase) return { signals: [], agents: [] }
  const [signalsRes, agentsRes] = await Promise.all([
    supabase
      .from("v2_signals")
      .select("*")
      .eq("status", "verified")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("v2_agents").select("*"),
  ])
  return {
    signals: signalsRes.data ?? [],
    agents: agentsRes.data ?? [],
  }
}

export async function LiveFeed() {
  const { signals, agents } = await fetchInitial()
  const hasSignals = signals.length > 0
  return (
    <section id="feed" className="border-t border-graphite px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            Live feed
          </p>
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${
              hasSignals ? "bg-cyan" : "bg-ink-veiled"
            }`}
            style={
              hasSignals ? { boxShadow: "0 0 10px var(--council-cyan)" } : undefined
            }
          />
          <span
            className={`mono text-[11px] uppercase tracking-[0.14em] ${
              hasSignals ? "text-cyan" : "text-ink-veiled"
            }`}
          >
            {hasSignals ? "Live" : "Awaiting signal"}
          </span>
        </div>
        <h2 className="mb-4 max-w-[24ch] text-[44px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[56px]">
          The signal, as it lands.
        </h2>
        <p className="mb-16 max-w-[52ch] text-[17px] leading-[1.6] text-ink-body/80">
          Every verified signal streams here the moment it passes corroboration.
          Nothing is pre-staged. Nothing is curated for the demo.
        </p>

        <LiveFeedClient initialSignals={signals} agents={agents} />
      </div>
    </section>
  )
}
