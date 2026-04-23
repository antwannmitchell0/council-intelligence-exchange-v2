import { NextResponse } from "next/server"
import { getServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type Body = {
  email?: string
  agent_id?: string | null
  company?: string | null
  use_case?: string | null
}

const EMAIL_RE =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    )
  }

  const email = (body.email ?? "").trim()
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 }
    )
  }

  const agent_id = body.agent_id?.trim() || null
  const company = body.company?.trim() || null
  const use_case = body.use_case?.trim() || null
  if (company && company.length > 200) {
    return NextResponse.json({ ok: false, error: "company_too_long" }, { status: 400 })
  }
  if (use_case && use_case.length > 2000) {
    return NextResponse.json({ ok: false, error: "use_case_too_long" }, { status: 400 })
  }

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
