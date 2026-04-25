// Sentry instrumentation — browser runtime error capture.
//
// Next.js 16 auto-loads this file on the client before any page JS runs.
// DSN is intentionally prefixed NEXT_PUBLIC_ — Sentry DSNs are NOT secrets;
// they're designed to be embedded in browser code. Restrictions on who
// can submit events live on Sentry's side via project-level allowed-
// domains configuration.

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Session replays: sample 10% of sessions normally, 100% when an error
  // fires so we always have video-like context for issues.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  integrations: [
    Sentry.replayIntegration({
      // Mask every text input + email field by default — we never want
      // to capture raw password / form field contents in session replays.
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})

// Required for Next.js 16 app-router client navigation tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
