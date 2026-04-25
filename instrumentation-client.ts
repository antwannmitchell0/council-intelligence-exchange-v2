// Sentry instrumentation — browser runtime error capture.
//
// Next.js 16 auto-loads this file on the client before any page JS runs.
// DSN is intentionally prefixed NEXT_PUBLIC_ — Sentry DSNs are NOT secrets;
// they're designed to be embedded in browser code. Restrictions on who
// can submit events live on Sentry's side via project-level allowed-
// domains configuration.
//
// Replay note (2026-04-25)
//   We initially enabled @sentry/replayIntegration but it caused hydration
//   errors on /admin (the integration injects DOM nodes during init,
//   which races with React hydration). Replay is "nice to have" — error
//   capture works without it. Re-enable behind a feature flag once we
//   have a replay-isolation strategy (probably: dynamic-import the
//   integration only after `requestIdleCallback`).

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  // Replay integration intentionally omitted — see file header.
})

// Required for Next.js 16 app-router client navigation tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
