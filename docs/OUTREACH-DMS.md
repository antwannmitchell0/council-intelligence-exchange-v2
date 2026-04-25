# Outreach DMs — first 10 subscribers

10 ready-to-paste templates. Pick the closest match per recipient, fill in the `[BRACKETS]`, send. Goal: 1 paid subscriber today, even if it's a friend at $49.

**Link to send:** https://council-intelligence-exchange-v2.vercel.app/pricing

---

## Tier 1 — Friends + family (warmest)

These are people who already know you've been building. They want to support. Don't apologize for asking.

### DM #1 — Close friend who knows about the project

> hey [name] — i just turned on early access for the council intelligence thing i've been building. it's basically capitol trades + quiver but with a math-verified leaderboard (agents have to earn a verified badge through a 90-day math gate; ones that miss it retire publicly). $49/mo, locked at that price forever for the first 100 subscribers.
>
> would mean a lot if you'd be subscriber #1. honest reactions welcome — paid or not. https://council-intelligence-exchange-v2.vercel.app/pricing

### DM #2 — Family member with money (parent/uncle/etc.)

> hey [name] — wanted to share something i've been working on for a few months. the council intelligence exchange aggregates 11 alt-data feeds (sec insider buys, congressional trades, treasury yields, jobs data, etc.) and runs a public 90-day math-gate verification on each one. agents that earn the badge get amplified; agents that don't get retired publicly. no cherry-picked results.
>
> just opened early access at $49/mo. early subscribers get locked at that price forever. would love your eyes on it whether you subscribe or not: https://council-intelligence-exchange-v2.vercel.app/pricing

---

## Tier 2 — Trader-adjacent / fintech-curious

People who follow markets but might not be in your inner circle. Slightly more pitch, less personal.

### DM #3 — Twitter trader who's posted about insider activity

> saw your post about [recent thing they tweeted]. i've been building something you might find interesting — the council intelligence exchange. 11 agents pull from sec insiders, senate disclosures, 13f filings, fred macro, etc. each one has to earn a "live-verified" badge by passing a 90-day math gate (IC ≥ 0.05, Sharpe ≥ 1, t-stat > 2). agents that miss the gate retire publicly. no survivorship bias.
>
> just opened early access — $49/mo, first 100 subscribers locked at that price. drop you the link if you're curious: https://council-intelligence-exchange-v2.vercel.app/pricing

### DM #4 — LinkedIn fintech connection

> hi [name] — building the Council Intelligence Exchange, an alt-data aggregation layer with a public verification framework. 11 source agents (SEC, Senate, Treasury, BLS, on-chain) feed into a leaderboard where each agent must clear a 90-day broker-paper math gate to earn the verified badge. The integrity contract is the moat: agents that miss the gate retire publicly, no edited backtests.
>
> Just opened Early Access at $49/mo for the first 100 subscribers. Given your background in [their field], I'd value your perspective — is the price/offer right? Page: https://council-intelligence-exchange-v2.vercel.app/pricing

### DM #5 — Discord/community drop (less formal)

> yo been building this for a few months and just opened early access — council intelligence exchange. SEC + senate + 13F + macro signals, 11 agents, each one has to earn a verified badge through a 90-day broker-paper math gate. agents that don't earn it retire publicly. $49/mo, first 100 subs locked at that forever.
>
> here's the page if you wanna kick the tires → https://council-intelligence-exchange-v2.vercel.app/pricing

---

## Tier 3 — Specific signal traders

People who already trade off ONE of the data sources you aggregate. Lean into the source they care about.

### DM #6 — Someone who follows insider buys (Cohen / Lakonishok crowd)

> [name] — saw you posted about [insider/Cohen Malloy / cluster buys / Lakonishok]. been building the council intelligence exchange — 11 agents, one of them is a Form 4 cluster-buy detector that fires when 2+ insiders independently buy within 30 days at the same issuer. all signals get a 90-day math gate (IC ≥ 0.05, Sharpe ≥ 1) before earning verified status.
>
> early access just opened, $49/mo, locked at that price forever for the first 100. https://council-intelligence-exchange-v2.vercel.app/pricing

### DM #7 — Congressional trade follower

> hey [name] — i know you follow congressional trades closely. heads up that capitol trades + quiver only show one side of it. been building something different: the council intelligence exchange. 11 agents — congress is one of them, but you also get insider buys, 13F flows, macro, on-chain. each one ranked by a 90-day math-gate verification (none of them are "verified" yet — day 0 was 2026-04-24).
>
> $49/mo early access if it sounds useful: https://council-intelligence-exchange-v2.vercel.app/pricing

### DM #8 — Macro trader

> [name] — built a thing you might want to see. 11-agent intelligence aggregator including yield-curve (DGS2/DGS10/T10Y2Y), Fed-funds futures proxy, BLS jobs prints. each agent earns its verified badge through a 90-day broker-paper math gate; ones that miss it retire publicly.
>
> $49/mo early access, first 100 only at this price: https://council-intelligence-exchange-v2.vercel.app/pricing

---

## Tier 4 — Cold but strategic

People you've never spoken to but who you specifically want as customers. Tightest pitch.

### DM #9 — Cold founder/operator with relevant network

> hi [name] — cold DM, but specific. building the council intelligence exchange — alt-data aggregation with a public 90-day verification gate. 11 agents (SEC, Senate, FRED, BLS, on-chain). agents that miss their math gate (IC ≥ 0.05, Sharpe ≥ 1, t-stat > 2) retire publicly.
>
> early access just opened at $49/mo. wondering if (a) you'd subscribe yourself, or (b) you know someone in [their network] who would. either way appreciated. https://council-intelligence-exchange-v2.vercel.app/pricing

### DM #10 — Cold but in their interests (e.g. small fund LP, family office)

> hi [name] — running point on the council intelligence exchange. solo operator, full transparency. we aggregate 11 alt-data sources and run a public 90-day broker-paper verification on each one. ones that fail the math gate retire publicly. no survivorship bias, no edited backtests, no "premium" upsells hiding worse data.
>
> $49/mo early access tier just opened — locked at that price for the first 100 subscribers. given [thing about them], thought it might be relevant. https://council-intelligence-exchange-v2.vercel.app/pricing

---

## After they pay

When Stripe sends you the email saying "[name] subscribed", you have 2 manual onboarding actions (until Phase D automates this):

1. Forward them the Discord invite if the welcome email's auto-invite hasn't shipped yet
2. Reply to their Stripe receipt email with a personal note ("Thanks [name] — you're subscriber #N. First daily digest hits your inbox tomorrow at 9 AM ET. Reply to that email anytime with questions.")

That personal touch on subscriber #1–10 is the difference between "someone who churns in 30 days" and "someone who tells 3 friends".

---

## Tracking

Every paid subscriber → check:
- /admin → Revenue panel (MRR, active count)
- Stripe dashboard → Customers
- Discord cron-alerts channel → "🎉 New Early Access subscriber" posts

If you see a Stripe payment but no /admin update within 60 seconds: webhook is failing. Check Stripe → Webhooks → recent deliveries.
