// /hive — public operations surface.
//
// Replaces the old "awaiting launch" placeholder. The 90-day verification
// window has started; agents are emitting signals; paper orders are flowing.
// This page proves the system is operating — without revealing the paid
// signal contents.

import type { Metadata } from "next"
import Link from "next/link"
import { LiveOpsBanner } from "@/components/public/live-ops-banner"
import {
  formatRelativePublic,
  getPublicAgentRoster,
  getPublicOpsSnapshot,
  type PublicAgentEntry,
} from "@/lib/public/operations"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "The Hive · Live operations",
  description:
    "Day 1 of the 90-day verification window. The Hive coordinates the agents in real time — every signal, every paper order, every heartbeat is on this page.",
}

const TIER_META: Record<
  PublicAgentEntry["tier"],
  { dot: string; ring: string; pill: string; label: string }
> = {
  live: {
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/20",
    pill: "border-emerald-400/30 text-emerald-300 bg-emerald-400/[0.06]",
    label: "Live",
  },
  wiring: {
    dot: "bg-amber-400",
    ring: "ring-amber-400/20",
    pill: "border-amber-400/30 text-amber-300 bg-amber-400/[0.06]",
    label: "Wiring",
  },
  roadmap: {
    dot: "bg-graphite",
    ring: "ring-graphite",
    pill: "border-graphite text-ink-veiled",
    label: "Roadmap",
  },
}

export default async function HivePage() {
  const [snapshot, roster] = await Promise.all([
    getPublicOpsSnapshot(),
    getPublicAgentRoster(),
  ])

  return (
    <main className="relative flex-1 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <span className="mono inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          <span className="h-px w-8 bg-ink-veiled" />
          The Hive · operations
          <span className="h-px w-8 bg-ink-veiled" />
        </span>

        <h1 className="mt-8 text-[44px] font-semibold leading-[1] tracking-[-0.03em] text-ink sm:text-[64px]">
          The agents are
          <br />
          <span className="text-violet-glow">in motion.</span>
        </h1>

        <p className="mt-8 max-w-[58ch] text-[16px] leading-[1.65] text-ink-body/85">
          The Hive is where the integrity contract runs. Every agent broadcasts
          a heartbeat. Every signal is timestamped, hashed, and published.
          Every paper-trading order is logged. The 90-day broker-paper
          verification window started 2026-04-24 — until an agent earns its
          math gate, no claim is made about what it can do. The numbers below
          are the only truth.
        </p>

        <div className="mt-12">
          <LiveOpsBanner snapshot={snapshot} />
        </div>

        {/* Agent roster */}
        <section className="mt-16">
          <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            Agent roster · 11 trading specialists
          </p>
          <p className="mt-2 max-w-[58ch] text-[13px] leading-[1.6] text-ink-body/60">
            Each agent has a single, defensible thesis backed by published
            academic literature. Six are producing signals tonight; five are
            wired and awaiting bootstrap data. None are verified yet — that
            requires 90 days of broker-paper performance hitting the math
            gate (IC ≥ 0.05, Sharpe ≥ 1, t-stat &gt; 2).
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {roster.map((entry) => {
              const meta = TIER_META[entry.tier]
              return (
                <li
                  key={entry.agent_id}
                  className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 rounded-md border border-graphite bg-void/40 px-5 py-4 sm:grid-cols-[auto_1fr_auto_auto]"
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 inline-block h-2.5 w-2.5 rounded-full ${meta.dot} ring-2 ${meta.ring}`}
                  />
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-3">
                      <p className="text-[15px] text-ink">
                        {entry.display_name}
                      </p>
                      <span
                        className={`mono rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] ${meta.pill}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[12px] leading-[1.55] text-ink-body/65">
                      {entry.description}
                    </p>
                  </div>
                  <p className="mono col-start-2 text-[11px] uppercase tracking-[0.14em] text-ink-body/70 sm:col-start-3 sm:text-right">
                    {formatRelativePublic(entry.hours_since_seen)}
                  </p>
                  <p className="mono col-start-2 text-[11px] uppercase tracking-[0.14em] text-ink-body/70 sm:col-start-4 sm:text-right">
                    {entry.signals_24h.toLocaleString()} sig/24h
                  </p>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Verification schedule */}
        <section className="mt-20 rounded-xl border border-graphite bg-obsidian/40 p-8 sm:p-10">
          <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            Verification schedule
          </p>
          <h2 className="mt-4 text-[28px] font-semibold tracking-tight text-ink">
            The math gate, in plain English.
          </h2>
          <ul className="mt-8 flex flex-col gap-6">
            <li className="flex flex-col gap-1">
              <p className="mono text-[10px] uppercase tracking-[0.18em] text-violet-glow">
                Day 0 · 2026-04-24
              </p>
              <p className="text-[14px] leading-[1.6] text-ink-body/85">
                The clock started. Every signal from every agent gets logged
                + paper-traded against Alpaca&apos;s live market data.
              </p>
            </li>
            <li className="flex flex-col gap-1">
              <p className="mono text-[10px] uppercase tracking-[0.18em] text-violet-glow">
                Day 1–89 · ongoing
              </p>
              <p className="text-[14px] leading-[1.6] text-ink-body/85">
                Each agent accumulates broker-paper outcomes. We compute
                rolling IC, Sharpe, and t-stat. Performance is logged
                publicly — you can audit every fill on the Hive.
              </p>
            </li>
            <li className="flex flex-col gap-1">
              <p className="mono text-[10px] uppercase tracking-[0.18em] text-violet-glow">
                Day 90 · 2026-07-23 (earliest)
              </p>
              <p className="text-[14px] leading-[1.6] text-ink-body/85">
                Math gate auto-evaluates. Agents that hit IC ≥ 0.05, Sharpe
                ≥ 1, t-stat &gt; 2 over the window earn the{" "}
                <span className="text-ink">live-verified</span> badge.
                Agents that don&apos;t — retire publicly. No appeals.
              </p>
            </li>
          </ul>
        </section>

        {/* CTA */}
        <section className="mt-20">
          <div className="rounded-xl border border-violet/30 bg-violet/[0.06] p-8 sm:p-10">
            <p className="mono text-[11px] uppercase tracking-[0.24em] text-violet-glow">
              Subscribe · Early Access
            </p>
            <h2 className="mt-4 text-[28px] font-semibold tracking-tight text-ink">
              Watch the gate from the inside.
            </h2>
            <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.6] text-ink-body/80">
              The Hive shows the system is running. Subscribers see the
              actual signals as they fire — symbols, sides, every
              filing-detail an agent surfaces — plus a daily 9 AM ET digest
              and Discord access.
            </p>
            <Link
              href="/pricing"
              className="group mt-8 inline-flex items-center gap-2 rounded-[8px] bg-violet px-6 py-3.5 text-[15px] font-medium text-ink transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-violet-glow"
            >
              Get Early Access — $49/mo
              <span
                aria-hidden
                className="transition-transform duration-[120ms] group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
