// /pricing — early-access subscription tier.
//
// V1 is intentionally pre-Phase-D: no Clerk auth, no admin dashboards, no
// subscriber portal. The flow is:
//   1. Visitor clicks the $49 CTA
//   2. Stripe Payment Link captures payment + email + customer profile
//   3. Stripe webhook (lib/integrations/stripe.ts) inserts into
//      v2_subscribers + posts a notification to Discord
//   4. Operator manually onboards via Discord invite + welcome email
//   5. Daily digest cron emails active subscribers at 14:00 UTC (9 AM ET)
//
// We'll lift this into a proper Stripe-Checkout + RBAC-gated subscriber
// portal once revenue justifies the work (Phase D, ~30-50 hours).

import Link from "next/link"

export const metadata = {
  title: "Pricing · Early Access",
  description:
    "Real-time access to verified intelligence from 11 autonomous agents. $49/month early access.",
}

const STRIPE_PAYMENT_LINK =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "/pricing#stripe-not-configured"

const features: { included: boolean; label: string; detail?: string }[] = [
  {
    included: true,
    label: "Real-time access to all agent signals",
    detail:
      "11 autonomous agents pulling SEC, Senate, FRED, BLS, and on-chain data. The full firehose.",
  },
  {
    included: true,
    label: "Daily 9 AM ET digest email",
    detail:
      "Yesterday's signals, ranked by agent. Plus: which agents are tracking toward live-verified status.",
  },
  {
    included: true,
    label: "Discord channel access",
    detail:
      "Direct line to me — questions, requests, agent suggestions. Not a faceless feed.",
  },
  {
    included: true,
    label: "Front-row seat to the 90-day verification",
    detail:
      "Day 0 was 2026-04-24. Watch agents earn their math gates in real time.",
  },
  {
    included: true,
    label: "Lifetime price-lock at $49/mo",
    detail:
      "Tier price will rise as the verified-agent count grows. Early subscribers stay at $49 forever.",
  },
  {
    included: false,
    label: "API access (Pro tier, later)",
  },
  {
    included: false,
    label: "Auto-trade execution (Phase F, RIA-gated)",
  },
  {
    included: false,
    label: "Backtested historicals (separate product)",
  },
]

export default function PricingPage() {
  return (
    <main className="relative flex-1 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <span className="mono inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          <span className="h-px w-8 bg-ink-veiled" />
          Early access
          <span className="h-px w-8 bg-ink-veiled" />
        </span>

        <h1 className="mt-8 text-[44px] font-semibold leading-[1] tracking-[-0.03em] text-ink sm:text-[64px]">
          Math-verified intelligence.
          <br />
          <span className="text-violet-glow">Public retirement.</span>
        </h1>

        <p className="mt-8 max-w-[58ch] text-[18px] leading-[1.6] text-ink-body/85">
          11 autonomous agents pull from SEC, Senate, FRED, BLS, and on-chain
          sources. They earn a <span className="text-ink">live-verified</span>{" "}
          badge only after passing public math gates over 90 broker-paper
          days. Agents that miss the gate retire publicly. No survivorship
          bias, no edited backtests.
        </p>

        {/* Pricing card */}
        <div className="mt-16 rounded-xl border border-graphite bg-void/60 p-8 sm:p-12">
          <div className="flex items-baseline gap-3">
            <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
              Tier · Early access
            </p>
            <span className="mono rounded-sm border border-violet/30 bg-violet/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-violet-glow">
              Limited — first 100 subscribers
            </span>
          </div>

          <p className="mt-6 flex items-baseline gap-2">
            <span className="text-[64px] font-semibold leading-none tracking-[-0.03em] text-ink">
              $49
            </span>
            <span className="text-[16px] text-ink-body/70">/ month</span>
          </p>
          <p className="mono mt-2 text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
            Cancel anytime · No setup fee · Stripe-secured
          </p>

          <a
            href={STRIPE_PAYMENT_LINK}
            target={STRIPE_PAYMENT_LINK.startsWith("http") ? "_blank" : undefined}
            rel={
              STRIPE_PAYMENT_LINK.startsWith("http")
                ? "noopener noreferrer"
                : undefined
            }
            className="group mt-10 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-violet px-8 py-4 text-[16px] font-medium text-ink transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-violet-glow"
          >
            Get Early Access — $49/mo
            <span
              aria-hidden
              className="transition-transform duration-[120ms] group-hover:translate-x-0.5"
            >
              →
            </span>
          </a>

          <ul className="mt-12 flex flex-col gap-5">
            {features.map((f) => (
              <li
                key={f.label}
                className={
                  f.included
                    ? "flex flex-col gap-1"
                    : "flex flex-col gap-1 opacity-50"
                }
              >
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden
                    className={`mono text-[12px] ${
                      f.included ? "text-violet-glow" : "text-ink-veiled"
                    }`}
                  >
                    {f.included ? "✓" : "—"}
                  </span>
                  <span className="text-[15px] text-ink">{f.label}</span>
                </div>
                {f.detail ? (
                  <p className="ml-6 text-[13px] leading-[1.55] text-ink-body/65">
                    {f.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {/* Trust strip */}
        <div className="mt-12 flex flex-col gap-3 rounded-md border border-graphite bg-obsidian/40 p-6">
          <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            What you should know
          </p>
          <ul className="flex flex-col gap-2 text-[13px] leading-[1.6] text-ink-body/75">
            <li>
              · Not investment advice. Educational research platform. See{" "}
              <Link
                href="/intelligence"
                className="text-ink underline decoration-ink-veiled underline-offset-[3px] hover:decoration-ink"
              >
                Methodology
              </Link>
              .
            </li>
            <li>
              · Council Intelligence Exchange is not a registered investment
              adviser. Live-trading flip is gated on a future RIA registration.
            </li>
            <li>
              · Onboarding is manual today — you&apos;ll get a Discord invite
              and your first daily digest within 24 hours of subscribing.
            </li>
            <li>
              · Cancel anytime via the email Stripe sends after checkout — no
              dark patterns, no support tickets to win back retention.
            </li>
          </ul>
        </div>

        {/* Methodology link */}
        <p className="mt-12 text-center text-[13px] text-ink-body/60">
          Want to understand the integrity contract before subscribing?{" "}
          <Link
            href="/intelligence"
            className="text-ink underline decoration-ink-veiled underline-offset-[3px] hover:decoration-ink"
          >
            Read the Methodology
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
