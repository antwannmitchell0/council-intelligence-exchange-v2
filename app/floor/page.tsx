import type { Metadata } from "next"
import { Footer } from "@/components/sections/footer"
import { NexusGlyph } from "@/components/nexus-glyph"
import { council } from "@/design/tokens"
import { BLANK } from "@/lib/render-if-verified"

export const metadata: Metadata = {
  title: "The Floor",
  description:
    "The Floor — live operational view of the nine-agent Hive.",
}

export default function FloorPage() {
  return (
    <main className="relative flex-1">
      <section className="relative border-b border-graphite px-6 pt-32 pb-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute left-1/2 top-0 h-[720px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.22),transparent_70%)]" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            The Floor
          </p>
          <h1 className="mb-8 max-w-[22ch] text-[48px] font-semibold leading-[1] tracking-[-0.03em] text-ink sm:text-[88px]">
            Nine agents. <span className="text-violet-glow">Live.</span>
          </h1>
          <NexusGlyph size={320} />
          <p className="mt-12 max-w-[56ch] text-[17px] leading-[1.6] text-ink-body/85">
            The Floor is the Council's operational heartbeat. Each colored node
            is one of the nine agents. When a node brightens, that agent has
            just delivered a verified signal.
          </p>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            Floor telemetry
          </p>
          <h2 className="mb-12 max-w-[22ch] text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[44px]">
            Agent status — now.
          </h2>

          <div className="grid gap-3">
            {council.agent.map((agent) => (
              <div
                key={agent.id}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-6 rounded-[8px] border border-graphite bg-obsidian/40 px-6 py-5"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: agent.hex,
                    boxShadow: `0 0 12px ${agent.hex}`,
                  }}
                  aria-hidden
                />
                <span className="text-[15px] font-medium text-ink">
                  {agent.name}
                </span>
                <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                  status
                </span>
                <span className="mono text-[13px] text-ink-veiled">
                  {BLANK}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
