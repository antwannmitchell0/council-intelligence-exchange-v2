import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AgentLiveFeed } from "@/components/agents/agent-live-feed"
import { Footer } from "@/components/sections/footer"
import { council } from "@/design/tokens"
import { BLANK } from "@/lib/render-if-verified"
import { getPublicServerClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import type {
  AgentRow,
  HeartbeatRow,
  LeaderboardRow,
  SignalRow,
  SourceRow,
} from "@/lib/supabase/types"

type PageParams = { id: string }

export const dynamicParams = true

export async function generateStaticParams(): Promise<PageParams[]> {
  const supabase = getPublicServerClient()
  const ids = new Set<string>(council.agent.map((a) => a.id))
  if (supabase) {
    const { data } = await supabase.from("v2_agents").select("*")
    const rows = (data ?? []) as Array<{ id: string }>
    for (const row of rows) ids.add(row.id)
  }
  return Array.from(ids).map((id) => ({ id }))
}

async function loadAgent(id: string): Promise<AgentRow | null> {
  const supabase = getPublicServerClient()
  if (supabase) {
    const { data } = await supabase
      .from("v2_agents")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (data) return data
  }
  const staticAgent = council.agent.find((a) => a.id === id)
  if (!staticAgent) return null
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

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>
}): Promise<Metadata> {
  const { id } = await params
  const agent = await loadAgent(id)
  if (!agent) return { title: "Agent not found" }
  return {
    title: agent.name,
    description:
      agent.brief ??
      `${agent.name} — an agent of The Council Intelligence Exchange.`,
  }
}

async function fetchAgentContext(id: string): Promise<{
  sources: SourceRow[]
  signals: SignalRow[]
  heartbeat: HeartbeatRow | null
  leaderboard: LeaderboardRow | null
}> {
  const supabase = getPublicServerClient()
  if (!supabase)
    return { sources: [], signals: [], heartbeat: null, leaderboard: null }

  const [sourcesRes, signalsRes, hbRes, lbRes] = await Promise.all([
    supabase.from("v2_sources").select("*").eq("agent_id", id),
    supabase
      .from("v2_signals")
      .select("*")
      .eq("agent_id", id)
      .eq("status", "verified")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("v2_agent_heartbeats")
      .select("*")
      .eq("agent_id", id)
      .maybeSingle(),
    supabase
      .from("v2_leaderboard_snapshots")
      .select("*")
      .eq("agent_id", id)
      .maybeSingle(),
  ])

  return {
    sources: sourcesRes.data ?? [],
    signals: signalsRes.data ?? [],
    heartbeat: hbRes.data,
    leaderboard: lbRes.data,
  }
}

function renderBio(md: string) {
  return md.split(/\n{2,}/).map((block, i) => {
    const trimmed = block.trim()
    if (!trimmed) return null
    const parts = trimmed.split(/(\*\*[^*]+\*\*)/g).map((p, j) => {
      if (p.startsWith("**") && p.endsWith("**")) {
        return (
          <strong key={j} className="font-semibold text-ink">
            {p.slice(2, -2)}
          </strong>
        )
      }
      return p
    })
    return (
      <p
        key={i}
        className="whitespace-pre-line text-[15px] leading-[1.6] text-ink-body/80"
      >
        {parts}
      </p>
    )
  })
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<PageParams>
}) {
  const { id } = await params
  const agent = await loadAgent(id)
  if (!agent) notFound()

  const { sources, signals, heartbeat, leaderboard } = await fetchAgentContext(
    id
  )

  const isVerified = agent.status === "verified"
  const isOnline = heartbeat?.status === "online"

  return (
    <main className="relative flex-1">
      <section className="relative border-b border-graphite px-6 pt-28 pb-12 sm:pt-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            className="absolute left-1/2 top-0 h-[520px] w-[920px] -translate-x-1/2 rounded-full"
            style={{
              background: `radial-gradient(closest-side, ${agent.hex}22, transparent 70%)`,
            }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <Link
            href="/agents"
            className="mono mb-8 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-ink"
          >
            ← All agents
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                backgroundColor: agent.hex,
                boxShadow: isOnline ? `0 0 14px ${agent.hex}` : "none",
                opacity: isOnline ? 1 : 0.45,
              }}
              aria-hidden
            />
            <span
              className={cn(
                "mono rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.16em]",
                isVerified
                  ? "border border-cyan/40 bg-cyan/10 text-cyan"
                  : "border border-graphite bg-obsidian/60 text-ink-muted"
              )}
            >
              {isVerified ? "Verified · In operation" : "In verification"}
            </span>
            {heartbeat ? (
              <span
                className={`mono text-[11px] uppercase tracking-[0.14em] ${
                  isOnline ? "text-success" : "text-ink-veiled"
                }`}
              >
                {heartbeat.status}
              </span>
            ) : null}
            {agent.tier_label ? (
              <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                · {agent.tier_label}
              </span>
            ) : null}
          </div>

          <h1 className="mt-6 max-w-[22ch] text-[48px] font-semibold leading-[1.02] tracking-[-0.03em] text-ink sm:text-[72px]">
            {agent.name}
          </h1>

          {agent.brief ? (
            <p className="mt-6 max-w-[56ch] text-[18px] leading-[1.55] text-ink-body/85">
              {agent.brief}
            </p>
          ) : null}
        </div>
      </section>

      <section className="border-b border-graphite px-6 py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Rank" value={leaderboard?.rank ?? null} />
          <Stat label="Signals 24h" value={leaderboard?.signals_24h ?? null} />
          <Stat
            label="Verified %"
            value={
              leaderboard?.verified_pct != null
                ? `${Math.round(leaderboard.verified_pct)}%`
                : null
            }
            verified
          />
          <Stat
            label="Sources"
            value={
              sources.filter((s) => s.status === "verified").length || null
            }
          />
        </div>
      </section>

      {agent.bio_md ? (
        <section className="border-b border-graphite px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <p className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
              Agent profile
            </p>
            <h2 className="mb-10 max-w-[24ch] text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink sm:text-[36px]">
              How this agent operates.
            </h2>
            <div className="flex flex-col gap-4">{renderBio(agent.bio_md)}</div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-graphite px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
            What this agent watches
          </p>
          <h2 className="mb-10 max-w-[24ch] text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink sm:text-[36px]">
            Verified sources only.
          </h2>
          {sources.filter((s) => s.status === "verified").length > 0 ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {sources
                .filter((s) => s.status === "verified")
                .map((src) => (
                  <li
                    key={src.id}
                    className="rounded-[8px] border border-graphite bg-obsidian/40 p-6"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[16px] font-semibold text-ink">
                        {src.name}
                      </span>
                      <span className="mono rounded-full border border-graphite bg-void/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-ink-body/80">
                        {src.kind}
                      </span>
                    </div>
                    {src.description ? (
                      <p className="text-[14px] leading-[1.6] text-ink-body/75">
                        {src.description}
                      </p>
                    ) : null}
                    {src.cadence ? (
                      <p className="mono mt-4 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                        Cadence · {src.cadence}
                      </p>
                    ) : null}
                  </li>
                ))}
            </ul>
          ) : (
            <div className="rounded-[8px] border border-dashed border-graphite bg-obsidian/20 p-8 text-center">
              <p className="mono text-[11px] uppercase tracking-[0.14em] text-ink-veiled">
                No verified sources yet
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-graphite px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
            Recent verified signals
          </p>
          <h2 className="mb-10 max-w-[24ch] text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink sm:text-[36px]">
            What this agent has said, receipts attached.
          </h2>
          <AgentLiveFeed
            agentId={agent.id}
            agentColor={agent.hex}
            initialSignals={signals}
          />
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl rounded-[12px] border border-graphite bg-obsidian/40 p-10 text-center">
          <p className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
            Request access
          </p>
          <h2 className="mb-4 text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink sm:text-[36px]">
            Want {agent.name} on your desk?
          </h2>
          <p className="mx-auto mb-8 max-w-[52ch] text-[15px] leading-[1.6] text-ink-body/80">
            Tell us how you'd use this agent's output. When the Council verifies
            the match, we open a slot.
          </p>
          <Link
            href={`/marketplace#early-access?agent=${agent.id}`}
            className="inline-flex items-center gap-2 rounded-[8px] bg-violet px-6 py-3.5 text-[15px] font-medium text-ink transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-violet-glow"
          >
            Open request form →
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}

function Stat({
  label,
  value,
  verified,
}: {
  label: string
  value: string | number | null
  verified?: boolean
}) {
  const hasValue = value !== null && value !== undefined
  return (
    <div className="flex flex-col gap-2 rounded-[8px] border border-graphite bg-obsidian/40 p-5">
      <span className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </span>
      <span
        className={`mono text-[24px] font-medium sm:text-[28px] ${
          hasValue
            ? verified
              ? "council-verified"
              : "text-ink"
            : "text-ink-veiled"
        }`}
      >
        {hasValue ? value : BLANK}
      </span>
    </div>
  )
}
