import type { Metadata } from "next"
import { MarketplaceGrid } from "@/components/marketplace/marketplace-grid"
import { EarlyAccessForm } from "@/components/marketplace/early-access-form"
import { PageHero } from "@/components/page-hero"
import { Footer } from "@/components/sections/footer"
import { council } from "@/design/tokens"
import { getPublicServerClient } from "@/lib/supabase/server"
import type { AgentRow, SignalRow, SourceRow } from "@/lib/supabase/types"

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Verified Council agents, licensed cleanly. Subscribe per agent, bundle all nine, or license for enterprise.",
}

async function fetchCatalog(): Promise<{
  agents: AgentRow[]
  sources: SourceRow[]
  latestSignals: SignalRow[]
}> {
  const supabase = getPublicServerClient()
  if (!supabase) return { agents: [], sources: [], latestSignals: [] }
  const [agentsRes, sourcesRes, signalsRes] = await Promise.all([
    supabase.from("v2_agents").select("*"),
    supabase.from("v2_sources").select("*"),
    supabase
      .from("v2_signals")
      .select("*")
      .eq("status", "verified")
      .order("created_at", { ascending: false })
      .limit(50),
  ])
  return {
    agents: agentsRes.data ?? [],
    sources: sourcesRes.data ?? [],
    latestSignals: signalsRes.data ?? [],
  }
}

const licensingSteps = [
  {
    n: "01",
    title: "Select",
    body:
      "Pick an agent, a bundle, or enterprise API. Each tier publishes its cadence, historical depth, and rate limits.",
  },
  {
    n: "02",
    title: "Verify",
    body:
      "The Council reviews your intended use. Integrity goes both ways — agents stay uncompromised when licensees match.",
  },
  {
    n: "03",
    title: "Stream",
    body:
      "Access goes live through the same realtime channel the Council operates on. No daily export. No delayed batch.",
  },
]

export default async function MarketplacePage() {
  const { agents, sources, latestSignals } = await fetchCatalog()

  const agentsById = new Map(agents.map((a) => [a.id, a]))
  const sourcesByAgent = new Map<string, SourceRow[]>()
  for (const s of sources) {
    const list = sourcesByAgent.get(s.agent_id) ?? []
    list.push(s)
    sourcesByAgent.set(s.agent_id, list)
  }

  // Prefer real data, fall back to static tokens so the grid always renders 9.
  const grid = council.agent.map((staticAgent) => {
    const real = agentsById.get(staticAgent.id)
    const agent: AgentRow =
      real ??
      ({
        id: staticAgent.id,
        name: staticAgent.name,
        hex: staticAgent.hex,
        brief: null,
        bio_md: null,
        specialty: null,
        joined_at: new Date().toISOString(),
        status: "pending" as const,
        price_monthly_cents: null,
        tier_label: null,
      } satisfies AgentRow)
    return { agent, sources: sourcesByAgent.get(staticAgent.id) ?? [] }
  })

  // Sort: verified agents first, then pending.
  grid.sort((a, b) => {
    const order: Record<string, number> = {
      verified: 0,
      pending: 1,
      unverified: 2,
    }
    return (
      (order[a.agent.status] ?? 3) - (order[b.agent.status] ?? 3)
    )
  })

  const availableCount = grid.filter(
    (g) => g.agent.status === "verified"
  ).length

  return (
    <main className="relative flex-1">
      <PageHero
        eyebrow="Marketplace"
        title={
          <>
            Nine agents.
            <br />
            <span className="text-violet-glow">Licensed cleanly.</span>
          </>
        }
        description={
          <>
            Every Council agent is a standalone product. Subscribe to one,
            bundle the house, or integrate the enterprise stream. Only agents
            that have passed verification are available today —{" "}
            <span className="council-verified">{availableCount} of 9</span> at
            launch.
          </>
        }
      />

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mono mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
                The roster
              </p>
              <h2 className="max-w-[24ch] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[40px]">
                Pick the agents you want on.
              </h2>
            </div>
            <p className="mono hidden text-[11px] uppercase tracking-[0.18em] text-ink-muted md:block">
              {availableCount} available · {9 - availableCount} in verification
            </p>
          </div>
          <MarketplaceGrid items={grid} latestSignals={latestSignals} />
          <p className="mono mt-6 text-center text-[11px] uppercase tracking-[0.14em] text-ink-veiled md:hidden">
            Tap any card for details
          </p>
          <p className="mono mt-6 hidden text-center text-[11px] uppercase tracking-[0.14em] text-ink-veiled md:block">
            Click any card to see what the agent watches
          </p>
        </div>
      </section>

      <section className="border-t border-graphite px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mono mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            How licensing works
          </p>
          <h2 className="mb-16 max-w-[22ch] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[40px]">
            Three steps. Same integrity bar as the signals.
          </h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {licensingSteps.map((step) => (
              <li
                key={step.n}
                className="flex flex-col gap-4 rounded-[8px] border border-graphite bg-obsidian/40 p-7"
              >
                <div className="flex items-baseline justify-between">
                  <span className="mono text-[32px] font-semibold text-violet">
                    {step.n}
                  </span>
                  <span className="h-px w-12 bg-graphite" />
                </div>
                <h3 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">
                  {step.title}
                </h3>
                <p className="text-[14px] leading-[1.6] text-ink-body/75">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-graphite px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <EarlyAccessForm />
        </div>
      </section>

      <Footer />
    </main>
  )
}
