import { BLANK } from "@/lib/render-if-verified"
import type { AgentRow, SourceRow } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type Props = {
  agent: AgentRow
  sources: SourceRow[]
}

function formatPrice(cents: number | null): string | null {
  if (cents == null) return null
  const dollars = cents / 100
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}/mo`
}

export function AgentProductCard({ agent, sources }: Props) {
  const isAvailable = agent.status === "verified"
  const price = formatPrice(agent.price_monthly_cents)
  const sourceCount = sources.filter((s) => s.status === "verified").length

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-6 rounded-[12px] border bg-obsidian/40 p-7 transition-colors duration-[240ms] [transition-timing-function:var(--ease-council)]",
        isAvailable
          ? "border-graphite hover:border-violet/60"
          : "border-graphite/50"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: agent.hex,
              boxShadow: isAvailable ? `0 0 12px ${agent.hex}` : "none",
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
        {agent.tier_label && (
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            {agent.tier_label}
          </span>
        )}
      </div>

      <h3 className="text-[24px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink">
        {agent.name}
      </h3>

      <p className="min-h-[72px] text-[14px] leading-[1.6] text-ink-body/75">
        {agent.brief ?? "Description forthcoming."}
      </p>

      <dl className="grid grid-cols-2 gap-4 border-t border-graphite/60 pt-5">
        <div className="flex flex-col gap-1">
          <dt className="mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            Verified sources
          </dt>
          <dd
            className={cn(
              "mono text-[15px] font-medium",
              sourceCount > 0 ? "text-ink" : "text-ink-veiled"
            )}
          >
            {sourceCount > 0 ? sourceCount : BLANK}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            Price
          </dt>
          <dd
            className={cn(
              "mono text-[15px] font-medium",
              price ? "council-verified" : "text-ink-veiled"
            )}
          >
            {price ?? BLANK}
          </dd>
        </div>
      </dl>

      <a
        href={`#early-access?agent=${agent.id}`}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[8px] px-5 py-3 text-[14px] font-medium transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)]",
          isAvailable
            ? "bg-violet text-ink hover:bg-violet-glow"
            : "border border-graphite bg-obsidian text-ink-body hover:border-violet/40 hover:text-ink"
        )}
      >
        {isAvailable ? "Request access" : "Join waitlist"}
        <span
          aria-hidden
          className="transition-transform duration-[120ms] group-hover:translate-x-0.5"
        >
          →
        </span>
      </a>
    </article>
  )
}
