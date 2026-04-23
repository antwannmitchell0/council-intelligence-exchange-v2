import type { Metadata } from "next"
import { Footer } from "@/components/sections/footer"
import { PageHero } from "@/components/page-hero"
import { council } from "@/design/tokens"
import { BLANK } from "@/lib/render-if-verified"

export const metadata: Metadata = {
  title: "Agents",
  description:
    "The nine autonomous agents of The Council Intelligence Exchange.",
}

const briefs: Record<string, string> = {
  aether: "Visual intelligence, interaction, and experience architecture.",
  telemetry: "Real-time signal ingestion and live-feed orchestration.",
  "cost-sentinel": "Predictive cost discipline across every pipeline.",
  oracle: "Opportunity detection — grants, partnerships, capital.",
  "cyber-sentinels": "Integrity boundary. No unauthorized writes. Ever.",
  nexus: "Inter-agent wiring. The data fabric of The Hive.",
  chronos: "Sequencing, timeline discipline, phase orchestration.",
  momentum: "Outreach, activation, targeted amplification.",
  evolutionary: "Future-proofing. Modular upgrade paths.",
}

export default function AgentsPage() {
  return (
    <main className="relative flex-1">
      <PageHero
        eyebrow="The Agents"
        title={
          <>
            Nine agents.
            <br />
            <span className="text-violet-glow">One standard.</span>
          </>
        }
        description="Each agent is a specialist. Each is measured. Together they form The Hive — the Council's living operational core."
      />

      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {council.agent.map((agent) => (
            <article
              key={agent.id}
              className="group relative flex flex-col gap-5 rounded-[8px] border border-graphite bg-obsidian/40 p-6 transition-colors duration-[240ms] [transition-timing-function:var(--ease-council)] hover:border-violet/40"
            >
              <div className="flex items-center justify-between">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: agent.hex,
                    boxShadow: `0 0 12px ${agent.hex}`,
                  }}
                  aria-hidden
                />
                <span className="mono text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
                  {BLANK}
                </span>
              </div>
              <h2 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink">
                {agent.name}
              </h2>
              <p className="text-[14px] leading-[1.6] text-ink-body/75">
                {briefs[agent.id] ?? ""}
              </p>
              <div className="mono flex items-center justify-between border-t border-graphite/60 pt-4 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                <span>Signals 24h</span>
                <span className="text-ink-veiled">{BLANK}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-6xl rounded-[8px] border border-graphite bg-obsidian/30 p-10">
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
              href="mailto:join@thecouncil.exchange"
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
