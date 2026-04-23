import { council } from "@/design/tokens"
import { getPublicServerClient } from "@/lib/supabase/server"
import type { AgentRow, SourceRow } from "@/lib/supabase/types"

const CATEGORY_LABELS: Record<string, string> = {
  markets: "Markets",
  regulatory: "Regulatory",
  infrastructure: "Infrastructure",
  geopolitics: "Geopolitics",
  science: "Science",
  "private-capital": "Private Capital",
  "on-chain": "On-chain",
  language: "Language",
  internal: "Internal",
}

const KIND_LABELS: Record<string, string> = {
  realtime: "Realtime",
  api: "API",
  feed: "Feed",
  scrape: "Scrape",
  filing: "Filing",
  "on-chain": "On-chain",
  webhook: "Webhook",
  database: "Database",
}

async function fetchSources(): Promise<{
  sources: SourceRow[]
  agents: AgentRow[]
}> {
  const supabase = getPublicServerClient()
  if (!supabase) return { sources: [], agents: [] }
  const [sourcesRes, agentsRes] = await Promise.all([
    supabase.from("v2_sources").select("*").order("agent_id"),
    supabase.from("v2_agents").select("*"),
  ])
  return {
    sources: sourcesRes.data ?? [],
    agents: agentsRes.data ?? [],
  }
}

export async function SignalSources() {
  const { sources, agents } = await fetchSources()

  const agentById = new Map(agents.map((a) => [a.id, a]))

  const uniqueCategories = Array.from(
    new Set(sources.map((s) => s.category))
  ).sort()

  const agentsWithoutVerifiedSources = council.agent.filter(
    (a) => !sources.some((s) => s.agent_id === a.id)
  )

  return (
    <section className="border-t border-graphite px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          Signal sources
        </p>
        <h2 className="mb-4 max-w-[24ch] text-[44px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[56px]">
          The roster is earned, not listed.
        </h2>
        <p className="mb-16 max-w-[56ch] text-[17px] leading-[1.6] text-ink-body/80">
          Every published source passed verification. Endpoints marked{" "}
          <span className="mono text-ink">public</span> are audit-ready. Agents
          with no verified source render blank — not "coming soon," not a
          promise. Blank.
        </p>

        {uniqueCategories.length > 0 && (
          <div className="mb-10 flex flex-wrap gap-2">
            {uniqueCategories.map((cat) => (
              <span
                key={cat}
                className="mono rounded-full border border-graphite bg-obsidian/60 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-muted"
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </span>
            ))}
          </div>
        )}

        {sources.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-graphite bg-obsidian/20 p-10 text-center">
            <p className="mono mb-2 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
              No verified sources yet
            </p>
            <p className="text-[15px] text-ink-body/70">
              Sources appear here as agents complete verification.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {sources.map((src) => {
              const agent = agentById.get(src.agent_id)
              const color =
                agent?.hex ??
                council.agent.find((a) => a.id === src.agent_id)?.hex ??
                "#4F5260"
              return (
                <li
                  key={src.id}
                  className="group relative flex flex-col gap-4 rounded-[8px] border border-graphite bg-obsidian/40 p-6 transition-colors duration-[240ms] [transition-timing-function:var(--ease-council)] hover:border-violet/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 0 10px ${color}`,
                        }}
                        aria-hidden
                      />
                      <span className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                        {agent?.name ?? src.agent_id}
                      </span>
                    </div>
                    <span className="mono rounded-full border border-graphite bg-void/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-ink-body/80">
                      {KIND_LABELS[src.kind] ?? src.kind}
                    </span>
                  </div>

                  <h3 className="text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">
                    {src.name}
                  </h3>

                  {src.description && (
                    <p className="text-[14px] leading-[1.6] text-ink-body/75">
                      {src.description}
                    </p>
                  )}

                  <div className="mono flex items-center justify-between border-t border-graphite/60 pt-4 text-[11px] uppercase tracking-[0.14em]">
                    <span className="text-ink-muted">
                      {CATEGORY_LABELS[src.category] ?? src.category}
                      {src.cadence ? ` · ${src.cadence}` : ""}
                    </span>
                    <span className="council-verified">verified</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {agentsWithoutVerifiedSources.length > 0 && (
          <div className="mt-10">
            <p className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
              Awaiting source verification
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {agentsWithoutVerifiedSources.map((agent) => (
                <li
                  key={agent.id}
                  className="flex items-center justify-between rounded-[8px] border border-graphite/60 bg-obsidian/20 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: agent.hex,
                        opacity: 0.35,
                      }}
                      aria-hidden
                    />
                    <span className="text-[13px] text-ink-body/75">
                      {agent.name}
                    </span>
                  </div>
                  <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-veiled">
                    —
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
