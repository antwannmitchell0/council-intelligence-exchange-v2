import type { Metadata } from "next"
import Link from "next/link"
import { Footer } from "@/components/sections/footer"
import { PageHero } from "@/components/page-hero"
import { council } from "@/design/tokens"
import { getPublicServerClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import type { AgentRow } from "@/lib/supabase/types"

export const metadata: Metadata = {
  title: "Agents",
  description:
    "The full Council roster — operational agents, backtested trading specialists, and free-data archetypes.",
}

async function fetchAgents(): Promise<AgentRow[]> {
  const supabase = getPublicServerClient()
  if (!supabase) return []
  const { data } = await supabase.from("v2_agents").select("*")
  return data ?? []
}

// Fallback for the 9 operational agents if they haven't been seeded yet
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

const OPERATIONAL_IDS: Set<string> = new Set(council.agent.map((a) => a.id))
const TRADING_SPECIALIST_IDS = new Set([
  "earnings-whisper-agent",
  "put-call-ratio-agent",
  "noaa-weather-agent",
  "insider-filing-agent",
  "tsa-throughput-agent",
  "ma-intelligence-agent",
  "jobs-data-agent",
  "port-flow-agent",
])
const ARCHETYPE_IDS = new Set([
  "gdelt-geopolitical",
  "sec-language-shift",
  "fred-macro-regime",
  "wiki-edit-surge",
  "chain-whale",
  "fed-voice",
  "trial-outcomes",
])

function categoryOf(id: string): "operational" | "specialist" | "archetype" | "other" {
  if (OPERATIONAL_IDS.has(id)) return "operational"
  if (TRADING_SPECIALIST_IDS.has(id)) return "specialist"
  if (ARCHETYPE_IDS.has(id)) return "archetype"
  return "other"
}

const CATEGORY_META: Record<
  "operational" | "specialist" | "archetype",
  { label: string; eyebrow: string; description: string }
> = {
  operational: {
    label: "Operational Agents",
    eyebrow: "Internal Council team",
    description:
      "The nine agents that run the Council itself — design, data fabric, integrity, cost discipline, phase delivery. Every agent is provable by what it has shipped.",
  },
  specialist: {
    label: "Trading Specialists",
    eyebrow: "Backtested on 2 years of real paper data",
    description:
      "Eight agents that passed statistical-significance testing (t-stat > 2, 95%+ confidence) across 1,648 real non-backfill paper signals. Bios document real IC, sample size, and methodology. Status: pending broker-paper validation.",
  },
  archetype: {
    label: "Free-Data Archetypes",
    eyebrow: "Research track",
    description:
      "Seven sophisticated agent concepts built on free, commercial-use data sources (SEC EDGAR, FRED, GDELT, etc.). Each has a documented thesis and academic evidence, but no live pipeline yet. Graduates to verified when ingestion ships and data accrues.",
  },
}

function AgentCard({ agent }: { agent: AgentRow }) {
  const isVerified = agent.status === "verified"
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="group relative flex flex-col gap-5 rounded-[8px] border border-graphite bg-obsidian/40 p-6 transition-colors duration-[240ms] [transition-timing-function:var(--ease-council)] hover:border-violet/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-glow focus-visible:ring-offset-2 focus-visible:ring-offset-void"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: agent.hex,
              boxShadow: isVerified ? `0 0 10px ${agent.hex}` : "none",
              opacity: isVerified ? 1 : 0.5,
            }}
            aria-hidden
          />
          <span
            className={cn(
              "mono rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
              isVerified
                ? "border border-cyan/40 bg-cyan/10 text-cyan"
                : "border border-graphite bg-void/60 text-ink-muted"
            )}
          >
            {isVerified ? "Verified" : "In verification"}
          </span>
        </div>
        <span className="mono text-[11px] uppercase tracking-[0.18em] text-ink-veiled transition-colors group-hover:text-ink-muted">
          View →
        </span>
      </div>
      <h3 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink">
        {agent.name}
      </h3>
      <p className="min-h-[60px] text-[14px] leading-[1.6] text-ink-body/75">
        {agent.brief ?? "Description forthcoming."}
      </p>
      {agent.tier_label ? (
        <p className="mono border-t border-graphite/60 pt-4 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          {agent.tier_label}
        </p>
      ) : null}
    </Link>
  )
}

function CategorySection({
  title,
  eyebrow,
  description,
  agents,
}: {
  title: string
  eyebrow: string
  description: string
  agents: AgentRow[]
}) {
  if (agents.length === 0) return null
  return (
    <section className="border-t border-graphite px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="mono mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          {eyebrow}
        </p>
        <h2 className="mb-4 max-w-[22ch] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[40px]">
          {title}
        </h2>
        <p className="mb-12 max-w-[56ch] text-[15px] leading-[1.6] text-ink-body/75">
          {description}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents
            .sort((a, b) => {
              if (a.status === "verified" && b.status !== "verified") return -1
              if (a.status !== "verified" && b.status === "verified") return 1
              return a.name.localeCompare(b.name)
            })
            .map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
        </div>
      </div>
    </section>
  )
}

export default async function AgentsPage() {
  const dbAgents = await fetchAgents()

  const byId = new Map<string, AgentRow>()
  for (const a of dbAgents) byId.set(a.id, a)
  for (const staticAgent of council.agent) {
    if (!byId.has(staticAgent.id)) byId.set(staticAgent.id, fallbackAgent(staticAgent))
  }
  const allAgents = Array.from(byId.values())

  const operational = allAgents.filter((a) => categoryOf(a.id) === "operational")
  const specialists = allAgents.filter((a) => categoryOf(a.id) === "specialist")
  const archetypes = allAgents.filter((a) => categoryOf(a.id) === "archetype")
  const other = allAgents.filter((a) => categoryOf(a.id) === "other")

  const verifiedCount = allAgents.filter((a) => a.status === "verified").length

  return (
    <main className="relative flex-1">
      <PageHero
        eyebrow="The Council roster"
        title={
          <>
            {allAgents.length} agents.
            <br />
            <span className="text-violet-glow">One standard.</span>
          </>
        }
        description={
          <>
            Operational team + trading specialists + free-data archetypes.{" "}
            <span className="council-verified">
              {verifiedCount} verified
            </span>{" "}
            — the others are in verification, with real methodology documented
            in each bio.
          </>
        }
      />

      <CategorySection
        title={CATEGORY_META.operational.label}
        eyebrow={CATEGORY_META.operational.eyebrow}
        description={CATEGORY_META.operational.description}
        agents={operational}
      />

      <CategorySection
        title={CATEGORY_META.specialist.label}
        eyebrow={CATEGORY_META.specialist.eyebrow}
        description={CATEGORY_META.specialist.description}
        agents={specialists}
      />

      <CategorySection
        title={CATEGORY_META.archetype.label}
        eyebrow={CATEGORY_META.archetype.eyebrow}
        description={CATEGORY_META.archetype.description}
        agents={archetypes}
      />

      {other.length > 0 ? (
        <CategorySection
          title="Other"
          eyebrow="Additional agents"
          description="Agents not yet categorized."
          agents={other}
        />
      ) : null}

      <section className="border-t border-graphite px-6 py-24">
        <div className="mx-auto max-w-6xl rounded-[12px] border border-graphite bg-obsidian/30 p-10">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h3 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink">
                Register an agent.
              </h3>
              <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.6] text-ink-body/75">
                The Council accepts candidates that meet the integrity bar.
                Submissions are reviewed by The Hive.
              </p>
            </div>
            <a
              href="/marketplace#early-access"
              className="inline-flex items-center gap-2 rounded-[8px] bg-violet px-6 py-3.5 text-[15px] font-medium text-ink transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-violet-glow"
            >
              Submit candidate →
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
