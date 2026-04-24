# Privacy Policy

> **⚠️ Template — pending counsel review before public publication.** Do not post publicly until a qualified attorney has reviewed this document under Demm LLC's jurisdiction (US) and any other target markets (EU/UK for GDPR; California for CCPA).

**Entity:** Demm LLC (d/b/a The Council Intelligence Exchange)
**Effective date:** [To be set on publication]
**Document version:** 1.0 (2026-04-24)

---

## 1 · Who we are

The Council Intelligence Exchange ("**The Council**", "**we**", "**us**") is operated by **Demm LLC**, a US limited liability company.

**Contact:** antwannmitchell0@gmail.com (primary), `privacy@<domain>` (once domain provisioned)

---

## 2 · What this policy covers

This policy explains what personal data The Council collects, how we use it, who we share it with, and what rights you have regarding your data.

It applies to:
- Visitors to our website
- People who submit information via our waitlist / early-access form
- (After our Phase D launch) Paid subscribers and their authorized users

---

## 3 · What we collect

### 3.1 Today (public site)

| Data | When we collect | Why |
|---|---|---|
| Email address | When you submit the marketplace waitlist form | To notify you when access opens, or to respond to your inquiry |
| Use-case text (optional) | Same | To understand demand + prioritize agent development |
| Company name (optional) | Same | Same |
| Hashed IP address | On every public endpoint request | Anti-abuse (rate limiting, bot detection). We never store raw IP addresses — only SHA-256 hashes salted with a secret, in `v2_abuse_events` |
| Hashed user-agent | Same | Same |
| Server logs (request path, response status, timing) | Every request | Operational debugging, performance monitoring. Retained per `docs/SUPABASE-REFERENCE.md` |

We **do not** collect:
- Your name (beyond what you voluntarily type)
- Your home or business address
- Your phone number
- Your payment information (we don't yet charge; when we do, Stripe holds it — see §3.2)
- Your social security number, tax ID, or government-issued ID
- Tracking cookies, third-party ad identifiers, or fingerprinting

### 3.2 Future (post-Phase D subscriber launch)

When we begin paid subscriptions:

| Additional data | Source | Why |
|---|---|---|
| Name | Signup form | Account identification |
| Stripe customer ID (opaque reference) | Stripe | Payment processing — we never see card numbers |
| Subscription tier + renewal date | Stripe | Feature access control |
| Login timestamps | Authentication service (Clerk) | Audit, security |
| In-app actions (clicks, signal views) | Application events | Product improvement — aggregated, not sold |

---

## 4 · How we use your data

We use the data we collect to:

- Provide the service (respond to waitlist, deliver signals to subscribers)
- Prevent abuse (rate limiting, bot detection)
- Improve the product (aggregated analytics — never tied to individual users in published material)
- Comply with legal obligations (tax reporting, court orders)
- Communicate with you (transactional emails about your account; rare product updates)

We **do not** use your data to:
- Sell or rent to third parties
- Target you with ads on behalf of advertisers
- Profile you for profit beyond operating our own service
- Train any AI or ML model with your personal data (our AI components use signal data, not user data)

---

## 5 · Who we share with

We share only with **service providers necessary to operate the service**, under their own privacy commitments:

| Provider | Role | Location | Privacy commitment |
|---|---|---|---|
| Vercel | Hosting + edge + TLS | US (multi-region) | [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy), SOC 2 Type II |
| Supabase | Database + realtime | US (AWS) | [Supabase Privacy Policy](https://supabase.com/privacy), SOC 2 Type II |
| Alpaca Markets | Broker (paper, moving to live post-RIA) | US | [Alpaca Privacy Policy](https://alpaca.markets/privacy) |
| Clerk (post-Phase D) | Identity + auth | US | [Clerk Privacy Policy](https://clerk.com/privacy), SOC 2 Type II |
| Stripe (post-Phase D) | Payment processing | US/global | [Stripe Privacy Policy](https://stripe.com/privacy), PCI-DSS Level 1 |
| Resend (post-transactional-email) | Email delivery | US | [Resend Privacy](https://resend.com/legal/privacy-policy) |

Data Processing Agreements will be executed with each vendor per `docs/KNOWN-LIMITATIONS.md` §"Legal / compliance gaps".

We may also share data when **legally required**: subpoenas, court orders, regulatory inquiries. We will notify affected users unless prohibited by law.

We **will never** share data with data brokers, ad networks, or analytics vendors that use it for cross-site tracking.

---

## 6 · How long we keep it

| Data | Retention |
|---|---|
| Waitlist emails | Until you request deletion OR convert to a subscriber |
| Hashed IP/UA in abuse events | Indefinite (hashed, not traceable to identity) |
| Server logs (Vercel) | 1 hour on free tier, 30 days on paid |
| Database backups | 7 days rolling (Supabase free tier) |
| (Post-Phase D) Subscriber data | Duration of subscription + 30 days post-cancellation for billing reconciliation; then anonymized or deleted per Article 17 GDPR |
| Integrity audit log (`v2_integrity_events`) | Indefinite (append-only, immutable, public) — note this contains no subscriber PII |
| Trade tickets (`v2_trade_tickets`) | Indefinite — this is Demm LLC's own trading history, not user data |

---

## 7 · Your rights

### 7.1 For everyone (any jurisdiction)

You can:
- **Access** the personal data we hold about you
- **Correct** inaccurate data
- **Delete** your data (subject to any legal retention obligations we explicitly cite)
- **Export** your data in a common format

**How:** email `privacy@<domain>` or `antwannmitchell0@gmail.com` with your request. We respond within 30 days.

### 7.2 Additional rights for EU/UK residents (GDPR)

Under GDPR Articles 15-21:
- Right to be informed (this policy)
- Right of access (§7.1)
- Right to rectification (§7.1)
- Right to erasure (§7.1)
- Right to restrict processing
- Right to data portability
- Right to object
- Rights related to automated decision-making (we don't do this to users)

**Legal basis for processing:** Contract performance (to deliver the service) + Legitimate interest (anti-abuse, product improvement) + Consent (waitlist signup).

### 7.3 Additional rights for California residents (CCPA / CPRA)

You have the right to:
- Know what personal information we collect, use, share, and sell (we don't sell — see §5)
- Delete your personal information
- Correct inaccurate personal information
- Opt-out of the sale or sharing of personal information (again — we don't)
- Limit use of sensitive personal information (we don't collect any — see §3)
- Non-discrimination for exercising these rights

---

## 8 · Children

The Council is not directed at children under 18. We do not knowingly collect data from children. If you believe we have, please contact us immediately for deletion.

---

## 9 · International data transfers

Data we process may be stored in the United States. If you are accessing from outside the US, your data will be transferred to and processed in the US.

For EU/UK residents, transfers rely on **Standard Contractual Clauses (SCCs)** with our US-based vendors where applicable.

---

## 10 · Security

See **`docs/SECURITY.md`** for our full security posture, including encryption, access control, audit logging, responsible-disclosure policy, and incident response.

If you discover a security issue, please report per `docs/SECURITY.md` §5.1 rather than here.

---

## 11 · Changes to this policy

We may update this policy. When we do:
- The "Effective date" above is updated
- Material changes are announced via email to affected users
- A public changelog is maintained at `docs/LEGAL/PRIVACY-POLICY-CHANGES.md` (to be created on first update)

---

## 12 · Contact

Questions, requests, or complaints:

**Email:** antwannmitchell0@gmail.com (until privacy@<domain> is provisioned)
**Mail:** Demm LLC, [address TBD — operator to provide]

For complaints about our data handling, you may also contact:
- Your local data protection authority (EU/UK residents)
- California Attorney General's Office (California residents)
- Federal Trade Commission (US residents)

---

*This policy is authoritative. If our service's actual behavior differs from what's described here, that's a bug and we fix it.*
