// /admin/login — single-input password gate for the operator surface.
//
// Pure server-rendered <form action> POST → /api/admin/login. No client JS
// is needed for the happy path. The login route 303-redirects to /admin
// (success) or back here with ?error=invalid (failure).

import { redirect } from "next/navigation"
import { isAdminAuthed } from "@/lib/admin/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const metadata = {
  title: "Admin · Sign in",
  robots: { index: false, follow: false },
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await isAdminAuthed()) redirect("/admin")
  const params = await searchParams
  const errored = params.error === "invalid"

  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6 py-24">
      <div className="w-full max-w-md">
        <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          Council Intelligence Exchange
        </p>
        <h1 className="mt-3 text-[28px] tracking-tight text-ink">
          Admin / Sign in
        </h1>
        <p className="mt-4 text-[13px] leading-[1.6] text-ink-body/70">
          Restricted operator surface. The command center indexes every
          dashboard, account, and runbook the exchange depends on.
        </p>

        <form
          action="/api/admin/login"
          method="POST"
          className="mt-10 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-2">
            <span className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
              Operator password
            </span>
            <input
              type="password"
              name="password"
              required
              autoFocus
              autoComplete="current-password"
              className="rounded-md border border-graphite bg-void/40 px-4 py-3 text-[14px] text-ink placeholder:text-ink-veiled focus:border-ink-muted focus:outline-none"
            />
          </label>

          {errored ? (
            <p
              role="alert"
              className="mono text-[11px] uppercase tracking-[0.18em] text-red-400"
            >
              Invalid password — try again.
            </p>
          ) : null}

          <button
            type="submit"
            className="mono mt-2 rounded-md border border-ink-muted bg-ink/10 px-4 py-3 text-[12px] uppercase tracking-[0.18em] text-ink transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-ink/20"
          >
            Continue
          </button>
        </form>

        <p className="mono mt-12 text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
          Single-operator stopgap until Phase D Clerk rollout
        </p>
      </div>
    </main>
  )
}
