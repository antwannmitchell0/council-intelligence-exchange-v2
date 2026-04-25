// GET /api/admin/sentry-test — deliberately throw so we can verify error
// capture is working end-to-end.
//
// Admin-auth-gated so random visitors can't trip it. Keep the route around
// long-term as an on-demand "is Sentry still capturing my errors?" smoke
// test — every few weeks it's worth hitting this and confirming the event
// lands in the Sentry issue stream.

import { NextResponse } from "next/server"
import { isAdminAuthed } from "@/lib/admin/auth"
import * as Sentry from "@sentry/nextjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  // Tag the event so it's filterable from real errors in Sentry's issue
  // stream ("tag:source=sentry-test").
  Sentry.setTag("source", "sentry-test")
  Sentry.setTag("deliberate", "true")

  // Throw after a tiny delay so Sentry has a chance to attach
  // breadcrumbs (the tags + the route invocation).
  throw new Error(
    "Deliberate Sentry test error from /api/admin/sentry-test — if you see this in Sentry, error capture is healthy."
  )
}
