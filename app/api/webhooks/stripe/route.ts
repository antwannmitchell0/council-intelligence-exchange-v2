// Stripe webhook handler — receives events from Stripe Payment Link
// checkouts and subscription lifecycle.
//
// Events we care about:
//   - checkout.session.completed             → first payment landed → insert subscriber + send welcome
//   - customer.subscription.updated          → renewal / pause / past_due → update status
//   - customer.subscription.deleted          → canceled → mark canceled
//
// Security: Stripe signs every webhook with HMAC-SHA256 using the
// signing secret (STRIPE_WEBHOOK_SECRET). We verify the signature on
// every request and reject anything that doesn't match.
//
// Idempotency: Stripe retries failed webhooks. We use the event id as a
// dedup key — re-receiving the same event is a no-op.

import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import Stripe from "stripe"
import { getServerClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { welcomeHtml, welcomeSubject, welcomeText } from "@/lib/email/templates/welcome"
import { sendAlert } from "@/lib/notifications/webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function logEvent(event: string, data: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ event, at: new Date().toISOString(), ...data }))
  } catch {
    console.log(event, data)
  }
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return null
  return new Stripe(key)
}

function notifyOperator(subject: string, body: string): void {
  waitUntil(
    sendAlert({
      severity: "info",
      title: subject,
      description: body,
    })
  )
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()

  if (!stripe || !secret) {
    logEvent("stripe.webhook.misconfigured", {
      has_stripe: !!stripe,
      has_secret: !!secret,
    })
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured" },
      { status: 503 }
    )
  }

  // Stripe signature verification requires the raw body — Next.js's auto
  // JSON parsing would mangle it. request.text() preserves it bit-for-bit.
  const body = await request.text()
  const sig = request.headers.get("stripe-signature") ?? ""

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logEvent("stripe.webhook.bad_signature", { error: msg })
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 400 })
  }

  logEvent("stripe.webhook.received", {
    event_id: event.id,
    event_type: event.type,
  })

  const supabase = getServerClient()
  if (!supabase) {
    logEvent("stripe.webhook.no_supabase", { event_id: event.id })
    return NextResponse.json(
      { ok: false, error: "supabase_unavailable" },
      { status: 503 }
    )
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const email =
          session.customer_email ?? session.customer_details?.email ?? null
        if (!email) {
          logEvent("stripe.webhook.no_email", { event_id: event.id })
          break
        }
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null

        // Upsert by email (Payment Links create one customer per email).
        const { error: upsertErr } = await supabase
          .from("v2_subscribers")
          .upsert(
            {
              email: email.toLowerCase().trim(),
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              status: "active",
              tier: "early-access",
              source: "stripe-payment-link",
            } as never,
            { onConflict: "email" }
          )
        if (upsertErr) {
          logEvent("stripe.webhook.upsert_failed", {
            event_id: event.id,
            error: upsertErr.message,
          })
        } else {
          logEvent("stripe.webhook.subscriber_added", {
            event_id: event.id,
            email,
          })
        }

        // Send welcome email — fire-and-forget so we never block Stripe's
        // retry timer.
        waitUntil(
          (async () => {
            const inviteUrl = process.env.DISCORD_SUBSCRIBER_INVITE_URL
            const result = await sendEmail({
              to: email,
              subject: welcomeSubject(),
              html: welcomeHtml({ email, discordInviteUrl: inviteUrl }),
              text: welcomeText({ email, discordInviteUrl: inviteUrl }),
              tag: "welcome",
            })
            logEvent("stripe.webhook.welcome_sent", {
              event_id: event.id,
              email,
              ok: result.ok,
              error: result.error,
            })
          })()
        )

        // Discord ping the operator so manual onboarding can happen
        // immediately if the welcome email's auto-Discord-invite hasn't
        // shipped yet.
        notifyOperator(
          `🎉 New Early Access subscriber`,
          `**${email}** just paid. They've been auto-emailed; check Discord for their join.`
        )
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const status = mapStripeStatus(sub.status)
        const periodEndAny = (sub as unknown as { current_period_end?: number })
          .current_period_end
        const periodEndISO = periodEndAny
          ? new Date(periodEndAny * 1000).toISOString()
          : null
        const { error } = await supabase
          .from("v2_subscribers")
          .update({
            status,
            current_period_end: periodEndISO,
          } as never)
          .eq("stripe_subscription_id", sub.id)
        if (error) {
          logEvent("stripe.webhook.update_failed", {
            event_id: event.id,
            error: error.message,
          })
        }
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const { error } = await supabase
          .from("v2_subscribers")
          .update({ status: "canceled" } as never)
          .eq("stripe_subscription_id", sub.id)
        if (error) {
          logEvent("stripe.webhook.cancel_failed", {
            event_id: event.id,
            error: error.message,
          })
        }
        notifyOperator(
          `❎ Subscription canceled`,
          `Subscription \`${sub.id}\` — gone. Reach out and ask why if it's a churn signal.`
        )
        break
      }

      default:
        // No-op — we only care about a small subset of Stripe's event
        // taxonomy. Unknown events still 200 so Stripe doesn't retry.
        break
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logEvent("stripe.webhook.handler_threw", {
      event_id: event.id,
      event_type: event.type,
      error: msg,
    })
    notifyOperator(
      "🚨 Stripe webhook threw",
      `Event \`${event.type}\` (\`${event.id}\`) hit an unhandled exception: ${msg}`
    )
    // Return 500 so Stripe retries. Idempotency upstream means re-receiving
    // is safe.
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

function mapStripeStatus(
  s: Stripe.Subscription.Status
): "active" | "paused" | "canceled" | "past_due" {
  if (s === "active" || s === "trialing") return "active"
  if (s === "paused") return "paused"
  if (s === "canceled" || s === "incomplete_expired" || s === "unpaid") return "canceled"
  return "past_due"
}
