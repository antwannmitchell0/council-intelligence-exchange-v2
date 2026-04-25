// Operator-only admin gate.
//
// This is a single-operator stopgap until Phase D ships proper Clerk-based
// auth + RBAC. Goals here are minimal:
//   1. Block /admin from anonymous viewers.
//   2. Self-signed cookie — no DB session table to maintain.
//   3. Constant-time compares so timing attacks can't leak the password
//      or the HMAC.
//   4. Rotation: bumping ADMIN_PASSWORD or ADMIN_SESSION_SECRET in Vercel
//      env immediately invalidates every existing session.
//
// Cookie format
//   admin_session = "<expiresAtMs>.<hexHmac>"
//   hmac = HMAC-SHA256(ADMIN_SESSION_SECRET, `v1.${expiresAtMs}`)
//   On verify: parse expiresAt, check not past, recompute HMAC, constant-
//   time compare. No DB lookup.

import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

export const ADMIN_COOKIE_NAME = "admin_session"
export const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET?.trim()
  if (!s || s.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET env var must be set (≥32 chars). Generate one with: openssl rand -hex 32"
    )
  }
  return s
}

function sign(expiresAtMs: number): string {
  const hmac = createHmac("sha256", getSecret())
  hmac.update(`v1.${expiresAtMs}`)
  return hmac.digest("hex")
}

export function issueAdminSession(): string {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS
  return `${expiresAt}.${sign(expiresAt)}`
}

export function verifyAdminSession(token: string | undefined): boolean {
  if (!token) return false
  const dot = token.indexOf(".")
  if (dot <= 0 || dot === token.length - 1) return false
  const expiresAtStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expiresAt = Number(expiresAtStr)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false
  const expected = sign(expiresAt)
  if (sig.length !== expected.length) return false
  try {
    return timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex")
    )
  } catch {
    return false
  }
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies()
  const token = store.get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminSession(token)
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  // Length-mismatch leaks nothing — the lengths of the *constants* are
  // the only thing the comparison needs to operate on.
  if (input.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(input), Buffer.from(expected))
  } catch {
    return false
  }
}
