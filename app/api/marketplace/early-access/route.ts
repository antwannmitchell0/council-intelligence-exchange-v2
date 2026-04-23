import { NextResponse } from "next/server"
import { getServerClient } from "@/lib/supabase/server"
import {
  isValidEmailSyntax,
  hasMX,
  isDisposable,
} from "@/lib/anti-abuse/email-validator"
import { checkIpRateLimit } from "@/lib/anti-abuse/rate-limit"
import { logAbuseEvent, type AbuseReason } from "@/lib/anti-abuse/log"

export const runtime = "nodejs"

type Body = {
  email?: string
  agent_id?: string | null
  company?: string | null
  use_case?: string | null
  /** Honeypot — real humans never see or fill this field. */
  url_website?: string | null
}

const ROUTE = "/api/marketplace/early-access"

// Sliding-window rate limit: 5 requests per 60s per IP.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")
  const first = fwd?.split(",")[0]?.trim()
  return first && first.length > 0 ? first : "unknown"
}

function silentOk(): NextResponse {
  // Silent 200 — used for bot signals (honeypot) so we don't tip off
  // the attacker that detection fired. Shape matches the success path.
  return NextResponse.json({ ok: true }, { status: 200 })
}

async function recordAbuse(
  request: Request,
  reason: AbuseReason,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAbuseEvent({
    route: ROUTE,
    reason,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata,
  })
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

export async function POST(request: Request) {
  // Parse body first so the honeypot check can run before anything else.
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    )
  }

  // 1. Honeypot — silent 200, audit, no further work.
  if (typeof body.url_website === "string" && body.url_website.trim() !== "") {
    await recordAbuse(request, "honeypot")
    return silentOk()
  }

  // 2. Per-IP rate limit — explicit 429 so legit retrying users can see it.
  const ip = getClientIp(request)
  const { allowed } = await checkIpRateLimit(
    ip,
    "early-access",
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  )
  if (!allowed) {
    await recordAbuse(request, "ratelimit")
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
        },
      }
    )
  }

  // 3. Email: syntax → MX → disposable.
  const email = (body.email ?? "").trim()
  if (!isValidEmailSyntax(email)) {
    await recordAbuse(request, "email-invalid", { stage: "syntax" })
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 }
    )
  }

  // Disposable check is cheap and doesn't touch the network; run before MX
  // so we don't spend a DNS roundtrip on domains we'd reject anyway.
  if (isDisposable(email)) {
    await recordAbuse(request, "disposable")
    return NextResponse.json(
      {
        ok: false,
        error: "disposable_email",
        message: "Please use a work email address.",
      },
      { status: 400 }
    )
  }

  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase()
  const mxOk = await hasMX(domain, 2000)
  if (!mxOk) {
    await recordAbuse(request, "email-invalid", { stage: "mx", domain })
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 }
    )
  }

  // 4. Field bounds (original success-path validation preserved).
  const agent_id = body.agent_id?.trim() || null
  const company = body.company?.trim() || null
  const use_case = body.use_case?.trim() || null
  if (company && company.length > 200) {
    return NextResponse.json(
      { ok: false, error: "company_too_long" },
      { status: 400 }
    )
  }
  if (use_case && use_case.length > 2000) {
    return NextResponse.json(
      { ok: false, error: "use_case_too_long" },
      { status: 400 }
    )
  }

  // 5. Persist.
  const supabase = getServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "supabase_unavailable" },
      { status: 503 }
    )
  }

  const { data, error } = await supabase.rpc(
    "v2_submit_early_access" as never,
    {
      p_email: email,
      p_agent_id: agent_id,
      p_company: company,
      p_use_case: use_case,
    } as never
  )

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, data }, { status: 200 })
}
