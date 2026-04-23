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
  ],
}
