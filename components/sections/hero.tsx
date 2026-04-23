import { NexusGlyph } from "@/components/nexus-glyph"
import { BLANK } from "@/lib/render-if-verified"

type HeroStat = {
  label: string
  value: string | typeof BLANK
  unit?: string
}

const stats: HeroStat[] = [
  { label: "Agents online", value: BLANK, unit: "/ 9" },
  { label: "Signals today", value: BLANK },
  { label: "Verified", value: BLANK, unit: "%" },
]

export function Hero() {
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

      <dl className="relative z-10 mt-20 grid w-full max-w-3xl grid-cols-3 gap-6 border-t border-graphite pt-10">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-2">
            <dt className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
              {stat.label}
            </dt>
            <dd className="mono flex items-baseline gap-1.5 text-[28px] font-medium text-ink-veiled sm:text-[36px]">
              {stat.value}
              {stat.unit ? (
                <span className="text-base text-ink-muted">{stat.unit}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
