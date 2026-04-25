// /admin — operator command center.
//
// Single index of every external service, dashboard, account, and runbook
// the exchange depends on. The page is intentionally dense: it's the page
// the operator opens at the start of every session to navigate the day.
//
// Adding a service?
//   1. Pick the right section.
//   2. Add a `{ label, href, description? }` entry to that section's links.
//   3. If a whole new tool category appears, add a section.
// No JS needed — pure server-rendered list of <a>.

import { redirect } from "next/navigation"
import { isAdminAuthed } from "@/lib/admin/auth"
import {
  formatRelative,
  getAgentFleetStatus,
  getHealthStatus,
  getRevenueStatus,
  type AgentFleetEntry,
  type AgentTier,
  type HealthStatus,
  type RevenueStatus,
} from "@/lib/admin/status"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const metadata = {
  title: "Admin · Command Center",
  robots: { index: false, follow: false },
}

type Link = { label: string; href: string; description?: string }
type Section = {
  title: string
  description: string
  links: Link[]
}

const sections: Section[] = [
  {
    title: "Production & ops",
    description:
      "The app itself. Live site, health endpoint, Vercel project home.",
    links: [
      {
        label: "Live site",
        href: "https://council-intelligence-exchange-v2.vercel.app",
        description: "Production homepage",
      },
      {
        label: "Health endpoint",
        href: "https://council-intelligence-exchange-v2.vercel.app/api/health",
        description:
          "JSON: supabase + alpaca + sec-edgar checks. 200 = ok, 503 = degraded.",
      },
      {
        label: "Vercel project dashboard",
        href: "https://vercel.com/antwanns-projects/council-intelligence-exchange-v2",
        description: "Deploys, env vars, crons, runtime logs.",
      },
    ],
  },
  {
    title: "Security & monitoring",
    description:
      "Every watchdog pointed at the exchange. Uptime, error tracking, cron alerts, platform security dashboards. Start here when something feels off — three independent failure surfaces, three independent notification channels.",
    links: [
      {
        label: "UptimeRobot — /api/health",
        href: "https://dashboard.uptimerobot.com/monitors/802919772",
        description:
          "5-min interval pings /api/health. Email + SMS + voice alerts when the endpoint returns 503.",
      },
      {
        label: "Sentry — issues feed",
        href: "https://demm.sentry.io/issues/?project=4511278262386688",
        description:
          "Uncaught exceptions, hydration errors, stack traces, session replays. Email on new issues.",
      },
      {
        label: "Sentry — smoke test",
        href: "/api/admin/sentry-test",
        description:
          "Deliberate throw — hit monthly to confirm error capture is still live end-to-end.",
      },
      {
        label: "Discord — #general (cron alerts)",
        href: "https://discord.com/channels/1497409185791348819/1497409186567553127",
        description:
          "Council Cron bot posts 🚨 red-bar alerts when an ingest agent run fails or throws.",
      },
      {
        label: "GitHub — Security tab",
        href: "https://github.com/antwannmitchell0/council-intelligence-exchange-v2/security",
        description:
          "Dependabot advisories, secret scanning, code scanning alerts. Check weekly.",
      },
      {
        label: "GitHub — Dependabot alerts",
        href: "https://github.com/antwannmitchell0/council-intelligence-exchange-v2/security/dependabot",
        description: "Vulnerable package advisories (npm + transitive deps).",
      },
      {
        label: "Vercel — Security settings",
        href: "https://vercel.com/antwanns-projects/council-intelligence-exchange-v2/settings/security",
        description:
          "Deployment protection, DDoS, firewall rules, trusted IPs, attack challenge mode.",
      },
      {
        label: "Vercel — Audit log",
        href: "https://vercel.com/antwanns-projects/~/settings/audit-log",
        description: "Every config change across the team — who did what, when.",
      },
      {
        label: "Supabase — Auth settings",
        href: "https://supabase.com/dashboard/project/_/auth/users",
        description:
          "User accounts, session policies, JWT settings, providers (pick project after click).",
      },
      {
        label: "Supabase — Auth logs",
        href: "https://supabase.com/dashboard/project/_/logs/auth-logs",
        description: "Sign-ins, sign-outs, failed auth attempts.",
      },
      {
        label: "Supabase — Database logs",
        href: "https://supabase.com/dashboard/project/_/logs/postgres-logs",
        description: "Slow queries, errors, connection spikes.",
      },
    ],
  },
  {
    title: "Revenue & subscribers",
    description:
      "Stripe billing, Resend email, the subscriber list. Where money + customer comms live.",
    links: [
      {
        label: "Stripe — Dashboard",
        href: "https://dashboard.stripe.com",
        description: "Payments, customers, invoices, disputes.",
      },
      {
        label: "Stripe — Payment Links",
        href: "https://dashboard.stripe.com/payment-links",
        description:
          "The $49/mo Early Access link is generated here. Edit the price, the success page, the trial.",
      },
      {
        label: "Stripe — Subscriptions",
        href: "https://dashboard.stripe.com/subscriptions",
        description: "Active customers + MRR. Cross-check with /admin tile.",
      },
      {
        label: "Stripe — Webhooks",
        href: "https://dashboard.stripe.com/webhooks",
        description:
          "If subscribers aren't appearing in /admin, check delivery here.",
      },
      {
        label: "Resend — Dashboard",
        href: "https://resend.com/overview",
        description: "Email send volume, deliverability, bounces.",
      },
      {
        label: "Resend — Domains",
        href: "https://resend.com/domains",
        description:
          "DNS verification status. Add SPF + DKIM + DMARC for demmmarketing.com to escape onboarding@resend.dev fallback.",
      },
      {
        label: "Resend — Emails sent",
        href: "https://resend.com/emails",
        description:
          "Per-email log: welcome, daily digest, etc. Resend if a customer says they didn't get one.",
      },
      {
        label: "Pricing page (live)",
        href: "/pricing",
        description: "What customers see when they click 'Get Early Access'.",
      },
    ],
  },
  {
    title: "Code & deploys",
    description: "Source of truth, PR pipeline, deployment history.",
    links: [
      {
        label: "GitHub repo",
        href: "https://github.com/antwannmitchell0/council-intelligence-exchange-v2",
      },
      {
        label: "Open pull requests",
        href: "https://github.com/antwannmitchell0/council-intelligence-exchange-v2/pulls",
      },
      {
        label: "Vercel deployments",
        href: "https://vercel.com/antwanns-projects/council-intelligence-exchange-v2/deployments",
      },
      {
        label: "Vercel runtime logs",
        href: "https://vercel.com/antwanns-projects/council-intelligence-exchange-v2/logs",
        description: "Filter by `cron.ingest.*` to follow daily cron health.",
      },
    ],
  },
  {
    title: "Data — Supabase",
    description:
      "Postgres for v2_signals, v2_agents, v2_sources, audits, leaderboards.",
    links: [
      {
        label: "Supabase dashboard",
        href: "https://supabase.com/dashboard",
      },
      {
        label: "SQL editor (latest project)",
        href: "https://supabase.com/dashboard/project/_/sql/new",
        description: "Pick the right project after click — _ is a placeholder.",
      },
      {
        label: "Table editor",
        href: "https://supabase.com/dashboard/project/_/editor",
      },
    ],
  },
  {
    title: "Brokerage — Alpaca paper",
    description:
      "Where every routed signal becomes a paper-trade order. Live trading flips here in Phase F (RIA-gated).",
    links: [
      {
        label: "Paper dashboard",
        href: "https://app.alpaca.markets/paper/dashboard/overview",
      },
      {
        label: "Orders",
        href: "https://app.alpaca.markets/paper/orders",
        description: "Every order routed by an agent.",
      },
      {
        label: "Positions",
        href: "https://app.alpaca.markets/paper/positions",
      },
      {
        label: "Account",
        href: "https://app.alpaca.markets/paper/account",
      },
    ],
  },
  {
    title: "Data providers",
    description: "Upstream feeds. Each link goes to where you manage that key.",
    links: [
      {
        label: "FRED — API keys",
        href: "https://fredaccount.stlouisfed.org/apikeys",
        description: "yield-curve + fed-futures source.",
      },
      {
        label: "BLS — API registration",
        href: "https://data.bls.gov/registrationEngine/",
        description: "jobs-data source.",
      },
      {
        label: "OpenFIGI — account",
        href: "https://www.openfigi.com/api",
        description: "13F CUSIP→ticker resolver. v3 endpoint.",
      },
      {
        label: "SEC EDGAR — full-text search",
        href: "https://efts.sec.gov/LATEST/search-index",
        description: "Insider + 13F upstream. No key (User-Agent identifies us).",
      },
      {
        label: "Senate eFDSearch",
        href: "https://efdsearch.senate.gov/search/",
        description: "Congress-agent upstream.",
      },
    ],
  },
  {
    title: "Internal pages",
    description: "Public-facing surfaces of the exchange.",
    links: [
      { label: "/agents", href: "/agents" },
      { label: "/exchange", href: "/exchange" },
      { label: "/floor", href: "/floor" },
      { label: "/hive", href: "/hive" },
      { label: "/intelligence", href: "/intelligence" },
      { label: "/marketplace", href: "/marketplace" },
      { label: "/trading", href: "/trading" },
    ],
  },
  {
    title: "Operator runbooks",
    description: "Living docs in the repo. Open these before assuming anything.",
    links: [
      {
        label: "ROADMAP.md",
        href: "https://github.com/antwannmitchell0/council-intelligence-exchange-v2/blob/main/docs/ROADMAP.md",
      },
      {
        label: "OPERATING-MANUAL.md",
        href: "https://github.com/antwannmitchell0/council-intelligence-exchange-v2/blob/main/docs/OPERATING-MANUAL.md",
      },
      {
        label: "ARCHITECTURE.md",
        href: "https://github.com/antwannmitchell0/council-intelligence-exchange-v2/blob/main/docs/ARCHITECTURE.md",
      },
      {
        label: "NEXT-SESSION-HANDOFF.md",
        href: "https://github.com/antwannmitchell0/council-intelligence-exchange-v2/blob/main/docs/NEXT-SESSION-HANDOFF.md",
      },
    ],
  },
]

// ---- Live status panels --------------------------------------------------

const TIER_META: Record<AgentTier, { dot: string; ring: string; label: string }> = {
  fresh: { dot: "bg-emerald-400", ring: "ring-emerald-400/20", label: "fresh" },
  stale: { dot: "bg-amber-400", ring: "ring-amber-400/20", label: "stale" },
  down: { dot: "bg-red-400", ring: "ring-red-400/20", label: "down" },
}

function HealthBanner({ health }: { health: HealthStatus }) {
  const isOk = health.ok && !health.error
  const dotColor = isOk ? "bg-emerald-400" : "bg-red-400"
  const headline = health.error
    ? "Health endpoint unreachable"
    : isOk
    ? "All systems operational"
    : "Degraded"

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border px-5 py-4 ${
        isOk
          ? "border-emerald-400/20 bg-emerald-400/[0.04]"
          : "border-red-400/30 bg-red-400/[0.06]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor}`}
        />
        <p className="text-[15px] tracking-tight text-ink">{headline}</p>
        <p className="mono ml-auto text-[10px] uppercase tracking-[0.18em] text-ink-veiled">
          {health.error ? "fetch error" : `${health.total_latency_ms}ms total`}
        </p>
      </div>
      {health.error ? (
        <p className="mono text-[11px] uppercase tracking-[0.12em] text-red-300/90">
          {health.error}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {health.checks.map((c) => (
            <li
              key={c.name}
              className="mono flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
            >
              <span
                aria-hidden
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  c.ok ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              <span className="text-ink-body/70">{c.name}</span>
              <span className="text-ink-veiled">
                {c.ok ? `${c.latency_ms}ms` : c.detail ?? "fail"}
              </span>
              {!c.critical ? (
                <span className="rounded-sm border border-graphite px-1 text-[9px] tracking-[0.18em] text-ink-veiled">
                  non-critical
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FleetRow({ entry }: { entry: AgentFleetEntry }) {
  const meta = TIER_META[entry.tier]
  return (
    <li className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 rounded-md border border-graphite bg-void/40 px-4 py-3 transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-void/60">
      <span
        aria-hidden
        className={`inline-block h-2.5 w-2.5 rounded-full ${meta.dot} ring-2 ${meta.ring}`}
      />
      <div className="flex flex-col">
        <span className="text-[14px] text-ink">{entry.display_name}</span>
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-veiled">
          {entry.agent_id}
        </span>
      </div>
      <span className="mono text-right text-[11px] uppercase tracking-[0.14em] text-ink-body/70">
        {formatRelative(entry.hours_since_seen)}
      </span>
      <span className="mono w-[14ch] text-right text-[11px] uppercase tracking-[0.14em] text-ink-body/70">
        {entry.signals_24h.toLocaleString()} sig/24h
      </span>
    </li>
  )
}

function RevenuePanel({ revenue }: { revenue: RevenueStatus }) {
  if (!revenue.ok) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-amber-400/30 bg-amber-400/[0.04] px-5 py-4">
        <p className="mono text-[11px] uppercase tracking-[0.18em] text-amber-300/90">
          Revenue snapshot unavailable
        </p>
        <p className="text-[12px] text-ink-body/70">
          {revenue.error ?? "v2_subscribers query failed"}. Apply migration
          0016_subscribers.sql in Supabase if you haven&apos;t yet.
        </p>
      </div>
    )
  }
  const tiles: { label: string; value: string; sub?: string }[] = [
    {
      label: "MRR",
      value: `$${revenue.mrr_usd.toLocaleString()}`,
      sub: "monthly recurring",
    },
    {
      label: "Active subs",
      value: revenue.active_subscribers.toLocaleString(),
      sub:
        revenue.new_last_7d > 0
          ? `+${revenue.new_last_7d} last 7d`
          : "no growth last 7d",
    },
    {
      label: "Past due",
      value: revenue.past_due.toLocaleString(),
      sub: revenue.past_due > 0 ? "needs attention" : "all clear",
    },
    {
      label: "Canceled (lifetime)",
      value: revenue.canceled.toLocaleString(),
      sub: "churned",
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="flex flex-col gap-1 rounded-md border border-graphite bg-void/40 px-4 py-3"
        >
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-ink-veiled">
            {t.label}
          </p>
          <p className="text-[24px] font-semibold tracking-tight text-ink">
            {t.value}
          </p>
          {t.sub ? (
            <p className="mono text-[10px] uppercase tracking-[0.14em] text-ink-body/60">
              {t.sub}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function FleetPanel({ fleet }: { fleet: AgentFleetEntry[] }) {
  if (fleet.length === 0) {
    return (
      <p className="mono text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
        Fleet status unavailable — Supabase fetch failed.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {fleet.map((entry) => (
        <FleetRow key={entry.agent_id} entry={entry} />
      ))}
    </ul>
  )
}

// ---- Link card -----------------------------------------------------------

function LinkCard({ link }: { link: Link }) {
  const isExternal = link.href.startsWith("http")
  const cls =
    "group flex flex-col gap-1 rounded-md border border-graphite bg-void/40 px-4 py-3 transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:border-ink-muted hover:bg-void/60"

  const inner = (
    <>
      <span className="text-[14px] text-ink">
        {link.label}
        {isExternal ? (
          <span aria-hidden className="mono ml-1.5 text-[11px] text-ink-veiled">
            ↗
          </span>
        ) : null}
      </span>
      {link.description ? (
        <span className="text-[12px] leading-[1.5] text-ink-body/60">
          {link.description}
        </span>
      ) : null}
    </>
  )

  if (isExternal) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
      >
        {inner}
      </a>
    )
  }
  return (
    <a href={link.href} className={cls}>
      {inner}
    </a>
  )
}

export default async function AdminPage() {
  if (!(await isAdminAuthed())) redirect("/admin/login")

  // All panels fetch in parallel. Any failure is non-fatal — the page
  // renders with degraded status indicators rather than 500'ing.
  const [health, fleet, revenue] = await Promise.all([
    getHealthStatus(),
    getAgentFleetStatus(),
    getRevenueStatus(),
  ])

  return (
    <main className="min-h-screen bg-void px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
              Council Intelligence Exchange
            </p>
            <h1 className="mt-3 text-[32px] tracking-tight text-ink">
              Admin / Command Center
            </h1>
            <p className="mt-3 max-w-[58ch] text-[13px] leading-[1.6] text-ink-body/70">
              Operator surface. Every dashboard, account, and runbook the
              exchange depends on, in one place. Bookmark this — it&apos;s the
              starting point for every session.
            </p>
          </div>
          <form action="/api/admin/logout" method="POST" className="shrink-0">
            <button
              type="submit"
              className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Live system-status banner — server-fetched at render time */}
        <div className="mt-12">
          <HealthBanner health={health} />
        </div>

        {/* Revenue snapshot — MRR, active subs, growth, churn */}
        <section className="mt-10">
          <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            Revenue · Early Access
          </p>
          <p className="mt-2 max-w-[58ch] text-[13px] leading-[1.6] text-ink-body/60">
            Subscriber tier is $49/mo. MRR = active count × $49. Past-due =
            payment failed but Stripe is retrying — reach out before they
            churn.
          </p>
          <div className="mt-6">
            <RevenuePanel revenue={revenue} />
          </div>
        </section>

        {/* Live agent fleet status — heartbeats + 24h signal counts */}
        <section className="mt-12">
          <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            Agent fleet status
          </p>
          <p className="mt-2 max-w-[58ch] text-[13px] leading-[1.6] text-ink-body/60">
            Green = ran in the last 36 hours. Amber = 36–72 hours (one missed
            tick). Red = &gt; 72 hours (multiple missed ticks — investigate).
          </p>
          <div className="mt-6">
            <FleetPanel fleet={fleet} />
          </div>
        </section>

        <div className="mt-16 flex flex-col gap-14">
          {sections.map((section) => (
            <section key={section.title}>
              <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
                {section.title}
              </p>
              <p className="mt-2 max-w-[58ch] text-[13px] leading-[1.6] text-ink-body/60">
                {section.description}
              </p>
              <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <LinkCard link={link} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mono mt-20 text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
          Last updated 2026-04-24 · Single-operator stopgap until Phase D
        </p>
      </div>
    </main>
  )
}
