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
    title: "Production & monitoring",
    description:
      "Live site, scheduled crons, uptime alerts. First place to look when something feels off.",
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
        label: "UptimeRobot — /api/health",
        href: "https://dashboard.uptimerobot.com/monitors/802919772",
        description: "5-min interval. Email + SMS + voice alerts on 503.",
      },
      {
        label: "Vercel project dashboard",
        href: "https://vercel.com/antwanns-projects/council-intelligence-exchange-v2",
        description: "Deploys, env vars, crons, runtime logs.",
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
