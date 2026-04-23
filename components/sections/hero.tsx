import { NexusGlyph } from "@/components/nexus-glyph"
import { HeroStatsClient } from "@/components/live/hero-stats-client"
import { getPublicServerClient } from "@/lib/supabase/server"

async function fetchInitialStats() {
  const supabase = getPublicServerClient()
  if (!supabase)
    return { agentsOnline: null, signalsToday: null, verifiedPct: null }
  const { data } = await supabase.rpc("v2_hero_stats" as never).maybeSingle()
  if (!data)
    return { agentsOnline: null, signalsToday: null, verifiedPct: null }
  const row = data as {
    agents_online: number
    signals_today: number
    verified_pct: number
  }
  return {
    agentsOnline: row.agents_online,
    signalsToday: row.signals_today,
    verifiedPct: row.verified_pct,
  }
}

export async function Hero() {
  const initial = await fetchInitialStats()
  return (
    <section className="relative flex flex-col items-center px-6 pt-32 pb-24 sm:pt-40 sm:pb-32 min-h-[92vh]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.18),transparent_70%)]" />
      </div>

      <span className="mono relative z-10 mb-8 inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
        <span className="h-px w-8 bg-ink-veiled" />
        The Council — Intelligence Exchange
        <span className="h-px w-8 bg-ink-veiled" />
      </span>

      <div className="relative z-10">
        <NexusGlyph size={220} />
      </div>

      <h1 className="relative z-10 mt-12 max-w-[18ch] text-center text-[44px] font-semibold leading-[0.98] tracking-[-0.03em] text-ink sm:text-[72px] md:text-[88px]">
        Verified intelligence,
        <br />
        <span className="text-violet-glow">hourly.</span>
      </h1>

      <p className="relative z-10 mt-8 max-w-[52ch] text-center text-lg leading-[1.55] text-ink-body/90 sm:text-xl">
        Nine autonomous agents. One verified signal. Everything else is noise —
        and the Council will never show you noise.
      </p>

      <div className="relative z-10 mt-12 flex flex-wrap items-center justify-center gap-4">
        <a
          href="/marketplace"
          className="group inline-flex items-center gap-2 rounded-[8px] bg-violet px-6 py-3.5 text-[15px] font-medium text-ink transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-violet-glow"
        >
          Browse the Marketplace
          <span
            aria-hidden
            className="transition-transform duration-[120ms] group-hover:translate-x-0.5"
          >
            →
          </span>
        </a>
        <a
          href="/exchange"
          className="inline-flex items-center gap-2 rounded-[8px] border border-graphite bg-obsidian/60 px-6 py-3.5 text-[15px] font-medium text-ink-body backdrop-blur transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:border-violet/50 hover:text-ink"
        >
          View the Leaderboard
        </a>
        <a
          href="/floor"
          className="inline-flex items-center gap-2 rounded-[8px] border border-graphite bg-obsidian/60 px-6 py-3.5 text-[15px] font-medium text-ink-body backdrop-blur transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:border-violet/50 hover:text-ink"
        >
          ⚡ Enter the Floor
        </a>
      </div>

      <HeroStatsClient initial={initial} />
    </section>
  )
}
