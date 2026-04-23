import type { Metadata } from "next"
import { Footer } from "@/components/sections/footer"
import { Floor3DWrapper } from "@/components/floor/floor-3d-wrapper"
import { SilhouetteAvatar } from "@/components/floor/silhouette-avatar"
import { NexusGlyph } from "@/components/nexus-glyph"
import { council } from "@/design/tokens"
import { cn } from "@/lib/utils"
import { getPublicServerClient } from "@/lib/supabase/server"
import type {
  AgentRow,
  SignalRow,
  SourceRow,
} from "@/lib/supabase/types"

export const metadata: Metadata = {
  title: "The Floor",
  description:
    "The Council Trading Floor — rotate, zoom, click any agent to see their full profile.",
}

async function fetchFloor(): Promise<{
  agents: AgentRow[]
  sources: SourceRow[]
  signals: SignalRow[]
}> {
  const supabase = getPublicServerClient()
  if (!supabase) return { agents: [], sources: [], signals: [] }
  const [agentsRes, sourcesRes, signalsRes] = await Promise.all([
    supabase.from("v2_agents").select("*"),
    supabase.from("v2_sources").select("*"),
    supabase
      .from("v2_signals")
      .select("*")
      .eq("status", "verified")
      .order("created_at", { ascending: false })
      .limit(30),
  ])
  return {
    agents: agentsRes.data ?? [],
    sources: sourcesRes.data ?? [],
    signals: signalsRes.data ?? [],
  }
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
  const { agents: dbAgents, sources, signals } = await fetchFloor()
  const byId = new Map<string, AgentRow>()
  for (const a of dbAgents) byId.set(a.id, a)
  for (const staticAgent of council.agent) {
    if (!byId.has(staticAgent.id)) byId.set(staticAgent.id, fallbackAgent(staticAgent))
  }
  const allAgents = Array.from(byId.values())

  const verifiedCount = allAgents.filter((a) => a.status === "verified").length
  const pendingCount = allAgents.length - verifiedCount
  const operational = allAgents.filter((a) => OPERATIONAL_IDS.has(a.id))
  const specialists = allAgents.filter((a) => SPECIALIST_IDS.has(a.id))
  const archetypes = allAgents.filter((a) => ARCHETYPE_IDS.has(a.id))

  return (
    <main className="relative flex-1">
      <section className="relative border-b border-graphite px-6 pt-28 pb-10 sm:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute left-1/2 top-0 h-[520px] w-[1040px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.18),transparent_70%)]" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            The Council Trading Floor
          </p>
          <h1 className="mb-8 max-w-[22ch] text-[44px] font-semibold leading-[1.02] tracking-[-0.03em] text-ink sm:text-[72px]">
            {allAgents.length} agents.
            <br />
            <span className="text-violet-glow">
              {verifiedCount} live on the floor.
            </span>
          </h1>
          <p className="max-w-[56ch] text-[17px] leading-[1.6] text-ink-body/85">
            Rotate the floor. Click any desk to inspect the agent — bio,
            sources, real track record. The empty desks are for agents still in
            verification.
          </p>
        </div>
      </section>

      <section className="border-b border-graphite px-6 py-10">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_280px]">
          {/* 3D floor */}
          <Floor3DWrapper
            agents={allAgents}
            sources={sources}
            latestSignals={signals}
          />

          {/* Stats sidebar — REAL numbers, no fake 100% */}
          <aside className="flex flex-col gap-4">
            <div className="rounded-[12px] border border-graphite bg-obsidian/40 p-5">
              <p className="mono mb-3 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                Systems status
              </p>
              <div className="mb-4 flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full bg-success"
                  style={{ boxShadow: "0 0 8px var(--council-success)" }}
                />
                <span className="mono text-[11px] uppercase tracking-[0.14em] text-success">
                  All systems operational
                </span>
              </div>
              <dl className="flex flex-col gap-3">
                <StatRow label="Total agents" value={String(allAgents.length)} />
                <StatRow
                  label="Verified on floor"
                  value={String(verifiedCount)}
                  highlight
                />
                <StatRow
                  label="In verification"
                  value={String(pendingCount)}
                />
                <StatRow
                  label="Operational"
                  value={String(operational.length)}
                />
                <StatRow
                  label="Trading specialists"
                  value={String(specialists.length)}
                />
                <StatRow
                  label="Archetypes"
                  value={String(archetypes.length)}
                />
              </dl>
              <p className="mono mt-4 border-t border-graphite/60 pt-3 text-[10px] uppercase tracking-[0.14em] text-ink-veiled">
                Stage · paper-traded
              </p>
            </div>

            <div className="rounded-[12px] border border-dashed border-graphite bg-obsidian/20 p-5">
              <p className="mono mb-2 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                How to use the floor
              </p>
              <ul className="flex flex-col gap-2 text-[13px] leading-[1.55] text-ink-body/75">
                <li>• Drag to rotate</li>
                <li>• Scroll to zoom</li>
                <li>• Right-click-drag to pan</li>
                <li>• Click a desk — agent's full story opens</li>
              </ul>
            </div>
          </aside>
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

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[12px] text-ink-body/70">{label}</dt>
      <dd
        className={cn(
          "mono text-[14px] font-medium",
          highlight ? "council-verified" : "text-ink"
        )}
      >
        {value}
      </dd>
    </div>
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
                "grid grid-cols-[56px_1fr_auto] items-center gap-4 px-5 py-3 transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-graphite/40",
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
