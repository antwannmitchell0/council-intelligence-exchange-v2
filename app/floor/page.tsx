import type { Metadata } from "next"
import { Footer } from "@/components/sections/footer"
import { IsoFloorScene } from "@/components/floor/iso-floor-scene"
import { SilhouetteAvatar } from "@/components/floor/silhouette-avatar"
import { NexusGlyph } from "@/components/nexus-glyph"
import { council } from "@/design/tokens"
import { cn } from "@/lib/utils"
import { getPublicServerClient } from "@/lib/supabase/server"
import type { AgentRow } from "@/lib/supabase/types"

export const metadata: Metadata = {
  title: "The Floor",
  description:
    "The Floor — isometric view of The Council's operational agents at work.",
}

async function fetchAgents(): Promise<AgentRow[]> {
  const supabase = getPublicServerClient()
  if (!supabase) return []
  const { data } = await supabase.from("v2_agents").select("*")
  return data ?? []
}

function fallbackAgent(staticAgent: (typeof council.agent)[number]): AgentRow {
  return {
    id: staticAgent.id,
    name: staticAgent.name,
    hex: staticAgent.hex,
    brief: null,
    bio_md: null,
    specialty: null,
    joined_at: new Date().toISOString(),
    status: "pending",
    price_monthly_cents: null,
    tier_label: null,
  }
}

const OPERATIONAL_IDS = new Set<string>(council.agent.map((a) => a.id))
const SPECIALIST_IDS = new Set<string>([
  "earnings-whisper-agent",
  "put-call-ratio-agent",
  "noaa-weather-agent",
  "insider-filing-agent",
  "tsa-throughput-agent",
  "ma-intelligence-agent",
  "jobs-data-agent",
  "port-flow-agent",
])
const ARCHETYPE_IDS = new Set<string>([
  "gdelt-geopolitical",
  "sec-language-shift",
  "fred-macro-regime",
  "wiki-edit-surge",
  "chain-whale",
  "fed-voice",
  "trial-outcomes",
])

export default async function FloorPage() {
  const dbAgents = await fetchAgents()
  const byId = new Map<string, AgentRow>()
  for (const a of dbAgents) byId.set(a.id, a)
  for (const staticAgent of council.agent) {
    if (!byId.has(staticAgent.id)) byId.set(staticAgent.id, fallbackAgent(staticAgent))
  }
  const allAgents = Array.from(byId.values())

  const operational = allAgents.filter((a) => OPERATIONAL_IDS.has(a.id))
  const specialists = allAgents.filter((a) => SPECIALIST_IDS.has(a.id))
  const archetypes = allAgents.filter((a) => ARCHETYPE_IDS.has(a.id))

  const verifiedCount = allAgents.filter((a) => a.status === "verified").length

  return (
    <main className="relative flex-1">
      <section className="relative border-b border-graphite px-6 pt-28 pb-12 sm:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute left-1/2 top-0 h-[520px] w-[1040px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.16),transparent_70%)]" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            The Floor
          </p>
          <h1 className="mb-8 max-w-[22ch] text-[48px] font-semibold leading-[1] tracking-[-0.03em] text-ink sm:text-[72px]">
            The Council, <span className="text-violet-glow">at work.</span>
          </h1>
          <p className="max-w-[56ch] text-[17px] leading-[1.6] text-ink-body/85">
            Each silhouette is a verified agent at its desk. When one crosses
            the floor to another, it's delivering a signal. The empty desks are
            the ones still in verification.
          </p>
        </div>
      </section>

      <section className="border-b border-graphite px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <IsoFloorScene agents={allAgents} />
          <p className="mono mt-4 text-center text-[11px] uppercase tracking-[0.14em] text-ink-veiled">
            {verifiedCount} of {allAgents.length} live · hover any desk to see
            the agent
          </p>
        </div>
      </section>

      <section className="border-b border-graphite px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <p className="mono mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
                Full roster
              </p>
              <h2 className="max-w-[24ch] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[40px]">
                Every agent. Every status.
              </h2>
            </div>
            <NexusGlyph size={72} />
          </div>

          <CategoryList
            title="Operational agents"
            eyebrow="Internal Council team"
            agents={operational}
          />
          <CategoryList
            title="Trading specialists"
            eyebrow="Backtested · paper-traded"
            agents={specialists}
          />
          <CategoryList
            title="Free-data archetypes"
            eyebrow="Research track"
            agents={archetypes}
          />
        </div>
      </section>

      <Footer />
    </main>
  )
}

function CategoryList({
  title,
  eyebrow,
  agents,
}: {
  title: string
  eyebrow: string
  agents: AgentRow[]
}) {
  if (agents.length === 0) return null
  const sorted = [...agents].sort((a, b) => {
    if (a.status === "verified" && b.status !== "verified") return -1
    if (a.status !== "verified" && b.status === "verified") return 1
    return a.name.localeCompare(b.name)
  })
  return (
    <div className="mb-12">
      <div className="mb-5 flex items-baseline justify-between">
        <h3 className="text-[20px] font-semibold tracking-[-0.015em] text-ink">
          {title}
        </h3>
        <span className="mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          {eyebrow}
        </span>
      </div>
      <ul className="overflow-hidden rounded-[8px] border border-graphite">
        {sorted.map((agent, i) => {
          const isVerified = agent.status === "verified"
          return (
            <li
              key={agent.id}
              className={cn(
                "grid grid-cols-[56px_1fr_auto_auto] items-center gap-4 px-5 py-3 transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-graphite/40",
                i !== sorted.length - 1 && "border-b border-graphite/60",
                isVerified ? "bg-obsidian/60" : "bg-obsidian/30"
              )}
            >
              <SilhouetteAvatar
                color={agent.hex}
                size={28}
                dimmed={!isVerified}
                label={agent.name}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-medium text-ink">
                  {agent.name}
                </span>
                {agent.brief ? (
                  <span className="line-clamp-1 text-[13px] text-ink-body/65">
                    {agent.brief}
                  </span>
                ) : null}
              </div>
              {agent.tier_label ? (
                <span className="mono hidden text-[10px] uppercase tracking-[0.14em] text-ink-muted sm:inline">
                  {agent.tier_label}
                </span>
              ) : (
                <span />
              )}
              <span
                className={cn(
                  "mono rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                  isVerified
                    ? "border border-cyan/40 bg-cyan/10 text-cyan"
                    : "border border-graphite bg-void/60 text-ink-muted"
                )}
              >
                {isVerified ? "Verified" : "In verification"}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
