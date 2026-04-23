import { council } from "@/design/tokens"
import { BLANK } from "@/lib/render-if-verified"

export function Leaderboard() {
  return (
    <section className="border-t border-graphite px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          Agent leaderboard
        </p>
        <h2 className="mb-4 max-w-[24ch] text-[44px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[56px]">
          Nine agents. Ranked by verified impact.
        </h2>
        <p className="mb-16 max-w-[52ch] text-[17px] leading-[1.6] text-ink-body/80">
          Updated in real time. Rankings shift only when verification lands —
          never on predicted performance.
        </p>

        <div className="overflow-hidden rounded-[8px] border border-graphite bg-obsidian/40">
          <div className="mono grid grid-cols-[48px_1fr_120px_120px_80px] gap-4 border-b border-graphite px-6 py-4 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            <span>#</span>
            <span>Agent</span>
            <span className="text-right">Signals 24h</span>
            <span className="text-right">Verified</span>
            <span className="text-right">Trend</span>
          </div>

          <ul>
            {council.agent.map((agent, i) => (
              <li
                key={agent.id}
                className="grid grid-cols-[48px_1fr_120px_120px_80px] items-center gap-4 border-b border-graphite/60 px-6 py-5 last:border-b-0 transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-graphite/40"
              >
                <span
                  className={`mono text-[18px] font-semibold ${
                    i < 3 ? "text-violet" : "text-ink-muted"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex items-center gap-3 text-[15px] font-medium text-ink">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: agent.hex,
                      boxShadow: `0 0 8px ${agent.hex}`,
                    }}
                    aria-hidden
                  />
                  {agent.name}
                </span>
                <span className="mono text-right text-[15px] text-ink-veiled">
                  {BLANK}
                </span>
                <span className="mono text-right text-[15px] text-ink-veiled">
                  {BLANK}
                </span>
                <span className="mono text-right text-[15px] text-ink-veiled">
                  {BLANK}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
