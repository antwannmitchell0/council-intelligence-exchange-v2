"use client"

import { useEffect, useRef } from "react"
import { BLANK } from "@/lib/render-if-verified"
import type { AgentRow, SignalRow, SourceRow } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type Props = {
  agent: AgentRow | null
  sources: SourceRow[]
  latestSignal: SignalRow | null
  onClose: () => void
}

function formatPrice(cents: number | null): string | null {
  if (cents == null) return null
  const dollars = cents / 100
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}/mo`
}

export function AgentDetailDrawer({
  agent,
  sources,
  latestSignal,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!agent) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [agent, onClose])

  useEffect(() => {
    if (agent && panelRef.current) {
      panelRef.current.focus()
    }
  }, [agent])

  if (!agent) return null

  const verifiedSources = sources.filter((s) => s.status === "verified")
  const isAvailable = agent.status === "verified"
  const price = formatPrice(agent.price_monthly_cents)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`drawer-title-${agent.id}`}
      className="fixed inset-0 z-[60] flex items-stretch justify-end"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        style={{ animation: "council-row-enter 180ms var(--ease-council-out)" }}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[560px] flex-col overflow-y-auto border-l border-graphite bg-obsidian outline-none"
        style={{
          animation:
            "council-drawer-in 280ms var(--ease-council-out) both",
        }}
      >
        <div className="flex items-center justify-between border-b border-graphite px-8 py-5">
          <div className="flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: agent.hex,
                boxShadow: isAvailable ? `0 0 10px ${agent.hex}` : "none",
                opacity: isAvailable ? 1 : 0.45,
              }}
              aria-hidden
            />
            <span
              className={cn(
                "mono rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]",
                isAvailable
                  ? "border border-cyan/40 bg-cyan/10 text-cyan"
                  : "border border-graphite bg-void/60 text-ink-muted"
              )}
            >
              {isAvailable ? "Available" : "In verification"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[6px] border border-graphite bg-void/40 px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:border-violet/40 hover:text-ink"
          >
            ESC
          </button>
        </div>

        <div className="flex flex-col gap-8 px-8 py-8">
          <div>
            <h2
              id={`drawer-title-${agent.id}`}
              className="text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink"
            >
              {agent.name}
            </h2>
            {agent.brief && (
              <p className="mt-4 text-[15px] leading-[1.6] text-ink-body/80">
                {agent.brief}
              </p>
            )}
          </div>

          <div>
            <p className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
              What the agent watches
            </p>
            {verifiedSources.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {verifiedSources.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-[8px] border border-graphite/80 bg-void/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-medium text-ink">
                        {s.name}
                      </span>
                      <span className="mono rounded-full border border-graphite bg-void/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-ink-body/80">
                        {s.kind}
                      </span>
                    </div>
                    {s.description && (
                      <p className="mt-2 text-[13px] leading-[1.55] text-ink-body/70">
                        {s.description}
                      </p>
                    )}
                    {s.cadence && (
                      <p className="mono mt-3 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                        Cadence · {s.cadence}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-[8px] border border-dashed border-graphite bg-void/30 p-6 text-center">
                <p className="mono text-[11px] uppercase tracking-[0.14em] text-ink-veiled">
                  No verified sources yet
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
              Latest verified signal
            </p>
            {latestSignal ? (
              <div className="rounded-[8px] border border-graphite/80 bg-void/40 p-5">
                <div className="mono mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                  <time dateTime={latestSignal.created_at}>
                    {new Date(latestSignal.created_at).toLocaleString()}
                  </time>
                  {latestSignal.confidence != null && (
                    <span className="council-verified">
                      {Math.round(latestSignal.confidence)}%
                    </span>
                  )}
                </div>
                <p className="text-[15px] leading-[1.55] text-ink">
                  {latestSignal.body}
                </p>
              </div>
            ) : (
              <div className="rounded-[8px] border border-dashed border-graphite bg-void/30 p-6 text-center">
                <p className="mono text-[11px] uppercase tracking-[0.14em] text-ink-veiled">
                  No signals published yet
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-[8px] border border-graphite bg-void/40 p-5">
            <div className="flex items-center justify-between">
              <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                Price
              </span>
              <span
                className={cn(
                  "mono text-[15px] font-medium",
                  price ? "council-verified" : "text-ink-veiled"
                )}
              >
                {price ?? BLANK}
              </span>
            </div>
            <a
              href={`#early-access?agent=${agent.id}`}
              onClick={onClose}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-[8px] px-5 py-3 text-[14px] font-medium transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)]",
                isAvailable
                  ? "bg-violet text-ink hover:bg-violet-glow"
                  : "border border-graphite bg-obsidian text-ink-body hover:border-violet/40 hover:text-ink"
              )}
            >
              {isAvailable ? "Request access" : "Join waitlist"} →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
