// LiveOpsBanner — public-facing strip showing the system is operating.
//
// Used at the top of /hive, /trading, /exchange. Reflects: current day in
// the 90-day verification window, signals flowing, paper-trading orders
// submitted. Does NOT reveal symbols/sides — that's the paid tier.

import type { PublicOpsSnapshot } from "@/lib/public/operations"

export function LiveOpsBanner({ snapshot }: { snapshot: PublicOpsSnapshot }) {
  const tiles: { label: string; value: string; sub: string }[] = [
    {
      label: "Verification window",
      value: `Day ${snapshot.day_of_window} / ${snapshot.total_window_days}`,
      sub: `Earliest live-verified · ${snapshot.earliest_live_verified_iso}`,
    },
    {
      label: "Active agents · 24h",
      value: snapshot.active_agent_count.toString(),
      sub: "Agents that emitted signals in the last 24 hours",
    },
    {
      label: "Signals · 24h",
      value: snapshot.signals_24h.toLocaleString(),
      sub: `${snapshot.signals_lifetime.toLocaleString()} lifetime`,
    },
    {
      label: "Paper orders",
      value: snapshot.paper_orders_lifetime.toLocaleString(),
      sub: `${snapshot.paper_orders_filled_lifetime.toLocaleString()} filled · ${snapshot.paper_orders_24h.toLocaleString()} in last 24h`,
    },
  ]

  return (
    <div className="rounded-xl border border-graphite bg-void/60 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="relative inline-block h-2.5 w-2.5 rounded-full bg-emerald-400"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-50" />
        </span>
        <p className="mono text-[11px] uppercase tracking-[0.24em] text-emerald-300">
          Live · broker-paper verification in progress
        </p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-1 border-l-2 border-violet/30 pl-4"
          >
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-ink-veiled">
              {t.label}
            </p>
            <p className="text-[24px] font-semibold leading-none tracking-tight text-ink">
              {t.value}
            </p>
            <p className="mono text-[10px] uppercase tracking-[0.14em] text-ink-body/60">
              {t.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
