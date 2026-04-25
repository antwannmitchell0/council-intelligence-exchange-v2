// POST /api/admin/login — verify password, set self-signed session cookie.
//
// Form-encoded POST so the login page can be a pure HTML <form action>
// with no client JS. The form submits, the route checks the password,
// and the response is a 303 redirect — to /admin on success, back to
// /admin/login?error=invalid on failure.
//
// Cookie shape lives in lib/admin/auth.ts; this route just bundles it.

import { NextResponse } from "next/server"
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_MS,
  issueAdminSession,
  verifyPassword,
} from "@/lib/admin/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function logEvent(event: string, data: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }))
  } catch {
    console.log(event, data)
  }
}

export async function POST(request: Request) {
  let password = ""
  try {
    const form = await request.formData()
    password = String(form.get("password") ?? "")
  } catch {
    // Malformed body — treat as failed login.
  }

  // Vercel injects the originating client IP via this header; falls back to
  // the standard forwarded chain. We only log the *suffix* + length so a
  // log spill leaks neither the raw IP nor enough info to fingerprint.
  const fwd = request.headers.get("x-forwarded-for") ?? ""
  const ipSuffix = fwd.split(",")[0]?.trim().split(".").slice(-1)[0] ?? "?"

  if (!verifyPassword(password)) {
    logEvent("admin.login.fail", {
      ip_suffix: ipSuffix,
      input_len: password.length,
    })
    return NextResponse.redirect(
      new URL("/admin/login?error=invalid", request.url),
      303
    )
  }

  logEvent("admin.login.success", { ip_suffix: ipSuffix })

  const token = issueAdminSession()
  const res = NextResponse.redirect(new URL("/admin", request.url), 303)
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  })
  return res
}
