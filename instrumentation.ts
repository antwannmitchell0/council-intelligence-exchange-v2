// Sentry instrumentation — server + edge runtime error capture.
//
// Next.js 16 calls register() once per function invocation on cold start.
// We initialize Sentry inline based on NEXT_RUNTIME so Node.js and Edge
// runtimes both get error capture without a runtime-detection shim.
//
// onRequestError is a Next.js 16 hook that runs on any request-path error
// — Sentry's helper wires it to the Sentry issue stream automatically.

import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      // Trace 10% of requests — enough for perf insight without billing
      // surprises on the free tier (5k errors/month + 10k performance).
      tracesSampleRate: 0.1,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      // Attach short commit SHA so you can pivot from an issue to the
      // exact deploy that introduced it.
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    })
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    })
  }
}

export const onRequestError = Sentry.captureRequestError
