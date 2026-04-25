// Welcome email — sent after Stripe webhook receives checkout.session.completed.
//
// Plain HTML, inline CSS, no client JS. Deliverability-first: short subject
// line, single CTA, plaintext alternative for clients that don't render HTML
// (gmail filters / corporate firewalls).

export type WelcomeEmailInput = {
  email: string
  // Optional Discord invite URL — provided if the operator has a static
  // invite link configured (DISCORD_INVITE_URL env var). Otherwise the
  // template tells the customer they'll get a manual invite within 24h.
  discordInviteUrl?: string
}

export function welcomeSubject(): string {
  return "Welcome to Council Intelligence — your access is active"
}

export function welcomeText(input: WelcomeEmailInput): string {
  const lines = [
    "Welcome to Council Intelligence.",
    "",
    "You're now an Early Access subscriber. Here's what happens next:",
    "",
    "1. Daily digest — you'll start receiving the 9 AM ET digest tomorrow morning.",
    "    Yesterday's signals from all 11 agents, ranked, with the agents' verification status.",
    "",
    input.discordInviteUrl
      ? `2. Discord — join the subscriber channel: ${input.discordInviteUrl}`
      : "2. Discord — your invite link will arrive in a follow-up email within 24 hours.",
    "",
    "3. Front-row seat — the 90-day broker-paper verification clock started 2026-04-24.",
    "    Watch agents earn their math gates (IC ≥ 0.05, Sharpe ≥ 1, t-stat > 2) in real time.",
    "",
    "What this isn't:",
    "    Not investment advice. Educational research. See the Methodology:",
    "    https://council-intelligence-exchange-v2.vercel.app/intelligence",
    "",
    "Reply to this email anytime. I read every message myself.",
    "",
    "—",
    "Antwann · Council Intelligence Exchange",
  ]
  return lines.join("\n")
}

export function welcomeHtml(input: WelcomeEmailInput): string {
  const discordBlock = input.discordInviteUrl
    ? `<a href="${input.discordInviteUrl}" style="color:#a78bfa;text-decoration:underline;">Join the subscriber Discord channel →</a>`
    : `Your Discord invite will arrive in a follow-up email within 24 hours.`

  // Style: dark Council Design Language palette, system font for max
  // deliverability. Inline styles only — most email clients strip
  // <style> blocks.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Welcome to Council Intelligence</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
    <p style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#9ca3af;margin:0 0 16px;">
      Council Intelligence · Early Access
    </p>
    <h1 style="font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.15;color:#ffffff;margin:0 0 24px;">
      Welcome aboard.
    </h1>
    <p style="font-size:15px;line-height:1.65;color:#d1d5db;margin:0 0 24px;">
      You're an Early Access subscriber. Here's what happens next.
    </p>

    <div style="border-left:2px solid #7c3aed;padding:8px 0 8px 16px;margin:0 0 28px;">
      <p style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#9ca3af;margin:0 0 6px;">
        Step 1 · Daily digest
      </p>
      <p style="font-size:14px;line-height:1.6;color:#d1d5db;margin:0;">
        You'll start receiving the 9 AM ET digest tomorrow morning. Yesterday's signals from all 11 agents, ranked, with each agent's verification status.
      </p>
    </div>

    <div style="border-left:2px solid #7c3aed;padding:8px 0 8px 16px;margin:0 0 28px;">
      <p style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#9ca3af;margin:0 0 6px;">
        Step 2 · Discord access
      </p>
      <p style="font-size:14px;line-height:1.6;color:#d1d5db;margin:0;">
        ${discordBlock}
      </p>
    </div>

    <div style="border-left:2px solid #7c3aed;padding:8px 0 8px 16px;margin:0 0 28px;">
      <p style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#9ca3af;margin:0 0 6px;">
        Step 3 · Front-row seat to verification
      </p>
      <p style="font-size:14px;line-height:1.6;color:#d1d5db;margin:0;">
        The 90-day broker-paper clock started 2026-04-24. Watch agents earn their math gates (IC ≥ 0.05, Sharpe ≥ 1, t-stat &gt; 2) in real time. Earliest live-verified promotions: 2026-07-23.
      </p>
    </div>

    <div style="border:1px solid #1f2937;border-radius:8px;padding:20px;margin:32px 0;">
      <p style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#9ca3af;margin:0 0 8px;">
        What this isn't
      </p>
      <p style="font-size:13px;line-height:1.6;color:#9ca3af;margin:0;">
        Not investment advice. Educational research platform. Full integrity contract at <a href="https://council-intelligence-exchange-v2.vercel.app/intelligence" style="color:#a78bfa;text-decoration:underline;">/intelligence</a>.
      </p>
    </div>

    <p style="font-size:14px;line-height:1.6;color:#d1d5db;margin:32px 0 16px;">
      Reply to this email anytime. I read every message myself.
    </p>

    <p style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#9ca3af;margin:48px 0 0;">
      Antwann · Council Intelligence Exchange
    </p>
  </div>
</body>
</html>`
}
