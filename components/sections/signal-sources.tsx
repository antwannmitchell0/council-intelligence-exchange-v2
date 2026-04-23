import { council } from "@/design/tokens"
import { BLANK } from "@/lib/render-if-verified"

const categories = [
  "Markets",
  "Regulatory",
  "Infrastructure",
  "Geopolitics",
  "Science",
  "Private capital",
  "On-chain",
  "Language",
] as const

export function SignalSources() {
  return (
    <section className="border-t border-graphite px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          Signal sources
        </p>
        <h2 className="mb-4 max-w-[24ch] text-[44px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[56px]">
          The roster is earned, not listed.
        </h2>
        <p className="mb-16 max-w-[52ch] text-[17px] leading-[1.6] text-ink-body/80">
          Sources must meet the integrity bar before they appear. Until a
          source is confirmed, its slot reads blank.
        </p>

        <div className="mb-10 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat}
              className="mono rounded-full border border-graphite bg-obsidian/60 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-muted"
            >
              {cat}
            </span>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {council.agent.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between rounded-[8px] border border-graphite bg-obsidian/40 p-5"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: agent.hex,
                    boxShadow: `0 0 10px ${agent.hex}`,
                  }}
                  aria-hidden
                />
                <span className="text-[15px] font-medium text-ink">
                  {agent.name}
                </span>
              </div>
              <span className="mono text-[12px] uppercase tracking-[0.14em] text-ink-veiled">
                {BLANK}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
