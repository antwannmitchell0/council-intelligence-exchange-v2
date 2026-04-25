// /trading — broker-paper operations + verification framing.
//
// Replaces the "awaiting launch" placeholder. We're paper-trading via
// Alpaca starting Day 0 (2026-04-24). The two-year audited public record
// stays gated until the first agent earns live-verified — but the Day-1+
// paper-trading activity IS shown publicly, because hiding "we're running"
// looks like vaporware.

import type { Metadata } from "next"
import Link from "next/link"
import { LiveOpsBanner } from "@/components/public/live-ops-banner"
import { getPublicOpsSnapshot } from "@/lib/public/operations"
import { getServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Trading · Broker-paper verification",
  description:
    "Day 1 of the 90-day broker-paper window. Every signal is paper-traded via Alpaca and logged here. The two-year audited record begins after the first agent earns live-verified.",
}

type TicketRow = {
  id: string
  symbol: string
  side: "buy" | "sell"
  agent_id: string
  order_status: string
  filled_at: string | null
  submitted_at: string | null
  created_at: string
}

type AgentRollup = {
  agent_id: string
  display_name: string
  orders_lifetime: number
  orders_filled: number
  last_activity: string | null
}

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "insider-filing-agent": "SEC Insider Filing",
  "thirteen-f-agent": "SEC 13F (snapshots)",
  "thirteen-f-diff-agent": "SEC 13F (diffs)",
  "congress-agent": "Congress (eFDSearch)",
  "yield-curve-agent": "Yield Curve",
  "jobs-data-agent": "Jobs Data",
  "fed-futures-agent": "Fed Futures",
  "gdelt-event-volume-agent": "GDELT Event Volume",
  "wiki-edit-surge-agent": "Wikipedia Edit Surge",
  "etherscan-whale-agent": "Etherscan Whale",
  "clinical-trial-outcomes-agent": "Clinical Trials",
}

async function getTicketRollup(): Promise<{
  rollup: AgentRollup[]
  total: number
}> {
  const supabase = getServerClient()
  if (!supabase) return { rollup: [], total: 0 }

  const { data } = await supabase
    .from("v2_trade_tickets")
    .select("id, symbol, side, agent_id, order_status, filled_at, created_at")
    .order("created_at", { ascending: false })
    .limit(5000)

  const rows = (data ?? []) as Array<{
    id: string
    symbol: string
    side: string
    agent_id: string
    order_status: string
    filled_at: string | null
    created_at: string
  }>

  const buckets = new Map<string, AgentRollup>()
  for (const r of rows) {
    let b = buckets.get(r.agent_id)
    if (!b) {
      b = {
        agent_id: r.agent_id,
        display_name: AGENT_DISPLAY_NAMES[r.agent_id] ?? r.agent_id,
        orders_lifetime: 0,
        orders_filled: 0,
        last_activity: null,
      }
      buckets.set(r.agent_id, b)
    }
    b.orders_lifetime += 1
    if (r.order_status === "filled") b.orders_filled += 1
    if (!b.last_activity || r.created_at > b.last_activity) {
      b.last_activity = r.created_at
    }
  }

  return {
    rollup: Array.from(buckets.values()).sort(
      (a, b) => b.orders_lifetime - a.orders_lifetime
    ),
    total: rows.length,
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return "—"
  const hours = (Date.now() - ms) / (60 * 60 * 1000)
  if (hours < 1) return "moments ago"
  if (hours < 36) return `${Math.round(hours)}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default async function TradingPage() {
  const [snapshot, tickets] = await Promise.all([
    getPublicOpsSnapshot(),
    getTicketRollup(),
  ])

  return (
    <main className="relative flex-1 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <span className="mono inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          <span className="h-px w-8 bg-ink-veiled" />
          Track record · broker-paper
          <span className="h-px w-8 bg-ink-veiled" />
        </span>

        <h1 className="mt-8 text-[44px] font-semibold leading-[1] tracking-[-0.03em] text-ink sm:text-[64px]">
          Outcomes,
          <br />
          <span className="text-violet-glow">receipts attached.</span>
        </h1>

        <p className="mt-8 max-w-[58ch] text-[16px] leading-[1.65] text-ink-body/85">
          Every directional signal is paper-traded via Alpaca. Every fill is
          logged. Every miss is logged. Wins and losses publish at the same
          cadence. Below: the live broker-paper operations log. Above the
          fold: only what is true today.
        </p>

        <div className="mt-12">
          <LiveOpsBanner snapshot={snapshot} />
        </div>

        {/* Per-agent paper-trading rollup */}
        <section className="mt-16">
          <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            Paper-trading by agent
          </p>
          <p className="mt-2 max-w-[58ch] text-[13px] leading-[1.6] text-ink-body/60">
            Lifetime paper orders submitted to Alpaca, grouped by the
            originating agent. Symbols and sides are reserved for
            subscribers — Early Access ($49/mo) reveals the full ticket
            stream.
          </p>

          {tickets.rollup.length === 0 ? (
            <div className="mt-8 rounded-md border border-graphite bg-void/40 px-6 py-10 text-center">
              <p className="mono text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
                No paper orders yet
              </p>
              <p className="mt-3 text-[13px] leading-[1.6] text-ink-body/70">
                Day 1 just started. Orders begin flowing as agents emit
                signals with a tradable symbol + side. First fills typically
                land within 24 hours of an agent going live.
              </p>
            </div>
          ) : (
            <ul className="mt-8 flex flex-col gap-3">
              {tickets.rollup.map((agent) => (
                <li
                  key={agent.agent_id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-2 rounded-md border border-graphite bg-void/40 px-5 py-4"
                >
                  <p className="text-[15px] text-ink">{agent.display_name}</p>
                  <p className="mono text-right text-[12px] uppercase tracking-[0.14em] text-ink-body/70">
                    {agent.orders_lifetime.toLocaleString()} orders ·{" "}
                    {agent.orders_filled.toLocaleString()} filled
                  </p>
                  <p className="mono text-right text-[11px] uppercase tracking-[0.14em] text-ink-veiled">
                    {relativeTime(agent.last_activity)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Integrity note */}
        <section className="mt-20 rounded-xl border border-graphite bg-obsidian/40 p-8 sm:p-10">
          <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            What you see vs. what you don&apos;t
          </p>
          <h2 className="mt-4 text-[28px] font-semibold tracking-tight text-ink">
            Half a record is worse than none.
          </h2>
          <ul className="mt-8 flex flex-col gap-6">
            <li className="flex flex-col gap-1">
              <p className="mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                Public today
              </p>
              <p className="text-[14px] leading-[1.6] text-ink-body/85">
                Live broker-paper operations: order counts, fill counts,
                agent attribution, timestamps. Proof the system is
                executing.
              </p>
            </li>
            <li className="flex flex-col gap-1">
              <p className="mono text-[10px] uppercase tracking-[0.18em] text-violet-glow">
                Subscribers · Early Access
              </p>
              <p className="text-[14px] leading-[1.6] text-ink-body/85">
                Real-time symbols + sides + signal context. Daily 9 AM ET
                digest of yesterday&apos;s activity. Discord access.
              </p>
            </li>
            <li className="flex flex-col gap-1">
              <p className="mono text-[10px] uppercase tracking-[0.18em] text-amber-300">
                Public · earliest 2026-07-23
              </p>
              <p className="text-[14px] leading-[1.6] text-ink-body/85">
                Per-agent IC, Sharpe, t-stat — published only after an agent
                clears the 90-day math gate. Agents that miss retire
                publicly. The audited two-year record begins from there.
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
              See every ticket as it fires.
            </h2>
            <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.6] text-ink-body/80">
              The public view shows the system is alive. Subscribers see the
              real-time signal stream — every symbol, every side, every
              filing reference — plus the daily digest and Discord access.
              First 100 subscribers locked at $49/mo for the lifetime of
              their subscription.
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
