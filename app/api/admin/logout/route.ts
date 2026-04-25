// POST /api/admin/logout — clear the session cookie, redirect to /admin/login.

import { NextResponse } from "next/server"
import { ADMIN_COOKIE_NAME } from "@/lib/admin/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/admin/login", request.url), 303)
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return res
}
