// Resend client — single entry-point for transactional + digest emails.
//
// Two senders configured:
//   - SENDER_OPERATIONAL: from address used for system / digest emails
//                         (e.g. "Council Intelligence <info@demmmarketing.com>")
//   - REPLY_TO:           where customer replies land (operator inbox)
//
// During Resend domain-verification (which can take up to 24h after
// adding DNS records), we fall back to "onboarding@resend.dev" so the
// pipe works end-to-end before the real sender is live. Once the
// domain verifies, swap the env var and the real sender takes over —
// no code change needed.

import "server-only"
import { Resend } from "resend"

const FALLBACK_SENDER = "Council Intelligence <onboarding@resend.dev>"

let cached: Resend | null = null

export function getResendClient(): Resend | null {
  if (cached) return cached
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return null
  cached = new Resend(key)
  return cached
}

export function getOperationalSender(): string {
  return (
    process.env.RESEND_OPERATIONAL_SENDER?.trim() ?? FALLBACK_SENDER
  )
}

export function getReplyTo(): string | undefined {
  return process.env.RESEND_REPLY_TO?.trim() || undefined
}

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  // Plain-text fallback — best practice for deliverability + accessibility.
  text?: string
  // Optional tag for Sentry / Resend dashboard segmentation.
  tag?: "welcome" | "digest" | "operational"
}

export type SendEmailResult = {
  ok: boolean
  id?: string
  error?: string
}

/**
 * sendEmail — single send call. Returns `{ ok: false, error }` on any
 * failure including missing API key — callers should never throw on a
 * failed email (an outage in Resend should never break the cron).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getResendClient()
  if (!client) {
    return { ok: false, error: "resend_api_key_not_configured" }
  }

  try {
    const { data, error } = await client.emails.send({
      from: getOperationalSender(),
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: getReplyTo(),
      tags: input.tag
        ? [{ name: "kind", value: input.tag }]
        : undefined,
    })
    if (error) {
      return { ok: false, error: error.message ?? "resend_send_failed" }
    }
    return { ok: true, id: data?.id }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
