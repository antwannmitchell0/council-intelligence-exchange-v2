import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  /* config options here */
}

// withSentryConfig wraps the Next.js config so Sentry can:
//  - Tunnel events through /monitoring to bypass adblockers that kill
//    direct sentry.io requests (the bulk of missed browser errors).
//  - Wrap server actions + route handlers so unhandled rejections land
//    in Sentry instead of vanishing.
//  - Upload source maps on deploy when SENTRY_AUTH_TOKEN is set (we
//    don't set it tonight — minified stack traces are fine for v1).
//
// `silent` suppresses build-time Sentry CLI output; set to false if a
// deploy is failing and you need to see why.
export default withSentryConfig(nextConfig, {
  org: "demm",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  // Don't upload source maps without an auth token — would fail the
  // build loudly. Flip this on once SENTRY_AUTH_TOKEN is wired in CI.
  sourcemaps: { disable: true },
  disableLogger: true,
  automaticVercelMonitors: false,
})
