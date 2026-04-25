// Platform-agnostic alert webhook sender — supports Slack + Discord.
//
// Single env var: ALERT_WEBHOOK_URL.
//   Slack URL:   https://hooks.slack.com/services/...
//   Discord URL: https://discord.com/api/webhooks/...
//
// We auto-detect the platform from the host and format the payload
// accordingly. This means flipping Slack ↔ Discord later is a one-line
// env-var change with zero code or redeploy.
//
// Fire-and-forget pattern: callers wrap calls in `waitUntil()` so the
// cron handler returns its response without blocking on the webhook
// post. Missing config → silent no-op (local dev / preview deployments
// without the secret keep working).

import "server-only"

export type AlertSeverity = "error" | "warn" | "info"

const SEVERITY_HEX_DECIMAL: Record<AlertSeverity, number> = {
  error: 0xe74c3c, // red
  warn: 0xf1c40f, // amber
  info: 0x3498db, // blue
}

const SEVERITY_HEX_STRING: Record<AlertSeverity, string> = {
  error: "#e74c3c",
  warn: "#f1c40f",
  info: "#3498db",
}

const SEVERITY_PREFIX: Record<AlertSeverity, string> = {
  error: "🚨",
  warn: "⚠️",
  info: "ℹ️",
}

export type AlertPayload = {
  severity: AlertSeverity
  title: string
  description?: string
  fields?: Array<{ name: string; value: string; inline?: boolean }>
}

type Platform = "slack" | "discord" | "unknown"

function detectPlatform(url: string): Platform {
  if (url.includes("hooks.slack.com")) return "slack"
  if (url.includes("discord.com/api/webhooks") || url.includes("discordapp.com/api/webhooks"))
    return "discord"
  return "unknown"
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

/** Build the Slack incoming-webhook payload. Uses legacy attachments
 *  format because it gives us colored sidebars + fields with the least
 *  ceremony — Block Kit is more flexible but overkill for op alerts. */
function buildSlackBody(payload: AlertPayload): unknown {
  const titleWithPrefix = `${SEVERITY_PREFIX[payload.severity]} ${truncate(
    payload.title,
    250
  )}`
  return {
    text: titleWithPrefix, // fallback for notification preview
    attachments: [
      {
        color: SEVERITY_HEX_STRING[payload.severity],
        title: titleWithPrefix,
        text: payload.description ? truncate(payload.description, 4000) : undefined,
        fields: payload.fields?.slice(0, 25).map((f) => ({
          title: truncate(f.name, 256),
          value: truncate(f.value, 1024),
          short: f.inline ?? false,
        })),
        ts: Math.floor(Date.now() / 1000),
        footer: "council-intelligence-exchange-v2",
      },
    ],
  }
}

/** Build the Discord webhook payload — embeds with timestamp + colored bar. */
function buildDiscordBody(payload: AlertPayload): unknown {
  const titleWithPrefix = `${SEVERITY_PREFIX[payload.severity]} ${truncate(
    payload.title,
    250
  )}`
  return {
    username: "Council Cron",
    embeds: [
      {
        title: titleWithPrefix,
        description: payload.description
          ? truncate(payload.description, 4096)
          : undefined,
        color: SEVERITY_HEX_DECIMAL[payload.severity],
        fields: payload.fields?.slice(0, 25).map((f) => ({
          name: truncate(f.name, 256),
          value: truncate(f.value, 1024),
          inline: f.inline ?? false,
        })),
        timestamp: new Date().toISOString(),
        footer: { text: "council-intelligence-exchange-v2" },
      },
    ],
  }
}

/**
 * sendAlert — POST to whichever ALERT_WEBHOOK_URL is configured. Returns
 * true on 2xx, false on any failure (including missing config or unknown
 * URL host). Never throws.
 */
export async function sendAlert(payload: AlertPayload): Promise<boolean> {
  const url = process.env.ALERT_WEBHOOK_URL?.trim()
  if (!url) return false

  const platform = detectPlatform(url)
  if (platform === "unknown") {
    console.warn(
      "[webhook] ALERT_WEBHOOK_URL host is neither slack.com nor discord.com — skipping"
    )
    return false
  }

  const body =
    platform === "slack" ? buildSlackBody(payload) : buildDiscordBody(payload)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch (err) {
    console.warn(
      "[webhook] post failed:",
      err instanceof Error ? err.message : String(err)
    )
    return false
  }
}
