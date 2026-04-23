import type { Metadata } from "next"
import { Footer } from "@/components/sections/footer"
import { FloorTelemetryClient } from "@/components/live/floor-telemetry-client"
import { FloorWithDrawer } from "@/components/floor/floor-with-drawer"
import { NexusGlyph } from "@/components/nexus-glyph"
import { getPublicServerClient } from "@/lib/supabase/server"
import type {
  AgentRow,
  HeartbeatRow,
  HiveEventRow,
  SignalRow,
  SourceRow,
} from "@/lib/supabase/types"

export const metadata: Metadata = {
  title: "The Floor",
  description: "The Floor — live operational view of the nine-agent Hive.",
}

async function fetchFloor(): Promise<{
  agents: AgentRow[]
  heartbeats: HeartbeatRow[]
  events: HiveEventRow[]
  signals: SignalRow[]
  sources: SourceRow[]
}> {
  const supabase = getPublicServerClient()
  if (!supabase)
    return {
      agents: [],
      heartbeats: [],
      events: [],
      signals: [],
      sources: [],
    }
  const [agentsRes, hbRes, evRes, sigRes, srcRes] = await Promise.all([
    supabase.from("v2_agents").select("*"),
    supabase.from("v2_agent_heartbeats").select("*"),
    supabase
      .from("v2_hive_events")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(40),
    supabase
      .from("v2_signals")
      .select("*")
      .eq("status", "verified")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("v2_sources").select("*"),
  ])
  return {
    agents: agentsRes.data ?? [],
    heartbeats: hbRes.data ?? [],
    events: evRes.data ?? [],
    signals: sigRes.data ?? [],
    sources: srcRes.data ?? [],
  }
}

export default async function FloorPage() {
  const { agents, heartbeats, events, signals, sources } = await fetchFloor()

  return (
    <main className="relative flex-1">
      <section className="relative border-b border-graphite px-6 pt-28 pb-12 sm:pt-32 sm:pb-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute left-1/2 top-0 h-[720px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.18),transparent_70%)]" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            The Floor
          </p>
          <h1 className="mb-8 max-w-[22ch] text-[48px] font-semibold leading-[1] tracking-[-0.03em] text-ink sm:text-[80px]">
            Nine agents. <span className="text-violet-glow">Live.</span>
          </h1>
          <p className="max-w-[56ch] text-[16px] leading-[1.6] text-ink-body/80 sm:text-[17px]">
            Each line is a verified signal moving between agents in real time.
            Hover to focus one. Click to open its detail.
          </p>
        </div>
      </section>

      <section className="border-b border-graphite px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <FloorWithDrawer
            agents={agents}
            heartbeats={heartbeats}
            events={events}
            signals={signals}
            sources={sources}
          />
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <p className="mono mb-4 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
                Floor telemetry
              </p>
              <h2 className="max-w-[22ch] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[40px]">
                Agent status — now.
              </h2>
            </div>
            <NexusGlyph size={96} />
          </div>
          <FloorTelemetryClient initialHeartbeats={heartbeats} />
        </div>
      </section>
      <Footer />
    </main>
  )
}
