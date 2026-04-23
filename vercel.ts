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
    // Phase 3 trading-specialist ingestion.
    // SEC + Congress agents: 6-hourly (filings land continuously during business hours).
    {
      path: "/api/cron/ingest?agent=insider-filing-agent",
      schedule: "0 */6 * * *",
    },
    {
      path: "/api/cron/ingest?agent=thirteen-f-agent",
      schedule: "0 */6 * * *",
    },
    {
      path: "/api/cron/ingest?agent=congress-agent",
      schedule: "0 */6 * * *",
    },
    // FRED / BLS agents: daily at 08:00 UTC (~03:00 ET — after US market close
    // data has landed and upstream publishers have settled).
    {
      path: "/api/cron/ingest?agent=yield-curve-agent",
      schedule: "0 8 * * *",
    },
    {
      path: "/api/cron/ingest?agent=jobs-data-agent",
      schedule: "0 8 * * *",
    },
    {
      path: "/api/cron/ingest?agent=fed-futures-agent",
      schedule: "0 8 * * *",
    },
    // Phase 6a archetype ingestion.
    // GDELT: every 3h — tone-anomaly bursts are fast-decaying news signals.
    {
      path: "/api/cron/ingest?agent=gdelt-event-volume-agent",
      schedule: "0 */3 * * *",
    },
    // Wikipedia pageviews: daily at 09:30 UTC — after Wikimedia's
    // prior-day batch lands (~24h lag).
    {
      path: "/api/cron/ingest?agent=wiki-edit-surge-agent",
      schedule: "30 9 * * *",
    },
    // Etherscan whale outflows: every 2h — on-chain moves are near-real-time.
    {
      path: "/api/cron/ingest?agent=etherscan-whale-agent",
      schedule: "0 */2 * * *",
    },
    // ClinicalTrials.gov outcomes: daily at 12:00 UTC — batched updates are
    // sufficient cadence for biotech catalysts.
    {
      path: "/api/cron/ingest?agent=clinical-trial-outcomes-agent",
      schedule: "0 12 * * *",
    },
  ],
}
