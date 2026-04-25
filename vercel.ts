import { routes, type VercelConfig } from "@vercel/config/v1"

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
]

export const config: VercelConfig = {
  framework: "nextjs",
  headers: [
    routes.header("/(.*)", securityHeaders),
    routes.cacheControl("/fonts/(.*)", {
      public: true,
      maxAge: "1year",
      immutable: true,
    }),
    routes.cacheControl("/_next/static/(.*)", {
      public: true,
      maxAge: "1year",
      immutable: true,
    }),
  ],
  crons: [
    {
      path: "/api/cron/integrity-audit",
      schedule: "0 6 * * *",
    },
    // Phase 3 trading-specialist ingestion — daily cadence (Vercel Hobby limit).
    // Staggered across the morning so pulls don't thundering-herd the same upstream.
    // Upgrade to Pro unlocks sub-daily cadence for the time-sensitive sources.
    //
    // Path-segment form is required — the route handler is a Next.js
    // dynamic route at app/api/cron/ingest/[agent]/route.ts. The earlier
    // query-string declarations (`?agent=X`) silently 404'd against the
    // scheduler because there is no parent /api/cron/ingest/route.ts.
    { path: "/api/cron/ingest/insider-filing-agent", schedule: "0 7 * * *" },
    { path: "/api/cron/ingest/thirteen-f-agent", schedule: "15 7 * * *" },
    // Diff layer reads thirteen-f-agent's output and emits quarter-over-
    // quarter NEW_ENTRY / EXIT / GROW / SHRINK signals with `side`
    // populated. Runs 30 min after the snapshot agent so the snapshots
    // it diffs against are guaranteed landed.
    { path: "/api/cron/ingest/thirteen-f-diff-agent", schedule: "45 7 * * *" },
    // congress-agent re-enabled 2026-04-24 after upstream swap from the
    // dead senatestockwatcher.com community mirror to the official
    // efdsearch.senate.gov system. See lib/ingestion/agents/congress.ts
    // for the three-step CSRF/cookie fetch flow.
    { path: "/api/cron/ingest/congress-agent", schedule: "30 7 * * *" },
    { path: "/api/cron/ingest/yield-curve-agent", schedule: "0 8 * * *" },
    { path: "/api/cron/ingest/jobs-data-agent", schedule: "15 8 * * *" },
    { path: "/api/cron/ingest/fed-futures-agent", schedule: "30 8 * * *" },
    // Phase 6a archetype ingestion — daily cadence.
    { path: "/api/cron/ingest/gdelt-event-volume-agent", schedule: "0 10 * * *" },
    { path: "/api/cron/ingest/wiki-edit-surge-agent", schedule: "30 9 * * *" },
    { path: "/api/cron/ingest/etherscan-whale-agent", schedule: "0 11 * * *" },
    { path: "/api/cron/ingest/clinical-trial-outcomes-agent", schedule: "0 12 * * *" },
    // Phase 4 broker-paper reconciler. Daily cadence fits Vercel Hobby's
    // 1/day cron limit; upgrade to Pro unlocks 15-min polling during
    // US market hours — the spec we want long-term is:
    //   schedule: "*/15 13-21 * * 1-5"   (9–4pm ET, weekdays, in UTC).
    { path: "/api/cron/alpaca-poll", schedule: "0 21 * * *" },
  ],
}
