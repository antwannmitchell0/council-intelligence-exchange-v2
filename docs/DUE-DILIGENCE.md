# Due Diligence Packet — The Council Intelligence Exchange v2

> Every question from a standard investor/acquirer security checklist, answered in one of four states:
> - ✅ **Done** — implemented, with file-path evidence
> - 🟡 **Shipping this phase** — in flight with a target date
> - 🔵 **Scheduled** — specific phase + session commitment
> - ⚪ **Not applicable now** — honest explanation + the phase where it becomes applicable
>
> No item is skipped. No item is hand-waved. If you see a gap and it's not addressed here, flag it — it's an error in the doc, not in the product.

**Document version:** 1.0 (2026-04-24)
**Owning entity:** Demm LLC
**Product status:** Production, Phase 4 complete
**Read first:** `docs/OPERATING-MANUAL.md` §1-4

---

## 0 · Differentiators that most SaaS products DON'T have

These aren't items on the checklist — they're things the product ships with that a reasonable investor should grade positively BEFORE getting into the standard checklist:

| Feature | Why it matters |
|---|---|
| **Append-only integrity audit log** (`v2_integrity_events`) | Immutable record of every stage transition, order outcome, and admin action. No `UPDATE` or `DELETE` policy exists — not even the owner can revise history. Forensic auditability built in. |
| **Math-gated auto-promotion** | Performance claims transition through stages based on encoded statistical gates (`lib/integrity/math.ts`), not marketing. Nightly cron enforces this without human touch. |
| **Zero-fake-data rendering gate** (`lib/render-if-verified.ts`) | UI refuses to display unverified performance claims. Returns blank instead of filler. Contrary to standard industry practice. |
| **Public transparency layer** | Anonymous users can `SELECT` the entire integrity audit log. Every performance claim is independently verifiable by any observer via documented SQL. |
| **Defense-in-depth data access control** | Supabase RLS + PostgREST constraints + code-level stage gates + service-role isolation. Three independent layers that must ALL fail for unauthorized access. |
| **Idempotent broker orchestration** | `client_order_id = signal.id` ensures Alpaca cannot accept duplicate orders from retry storms. Every order traces back to exactly one signal UUID. |
| **Dedicated circuit breakers** | Per-agent breaker (ingestion) AND per-router breaker (Alpaca) are isolated — a broker outage never corrupts ingestion; a broken agent never blocks the router. |
| **Broker-attested 90-day clock** | Live-verified promotion requires ≥90 calendar days of real broker fills passing IC≥0.05 + Sharpe≥1 + t-stat>2. The math is encoded in `LIVE_VERIFIED_GATE` constant, imported everywhere. |
| **Zero-cost operating posture** | $0/month infrastructure cost. Vercel + Supabase + Alpaca all on free tiers. Paid tiers unlock only when usage justifies them. |

---

## 1 · Access Control

### 1.1 How are user roles managed?

⚪ **Not applicable now.** The product is currently a public, read-only intelligence exchange with no user accounts. Everyone sees the same data (verified-only, enforced by Supabase RLS on the anon role). The only "role" today is `operator` (Antwann Mitchell), who has Supabase dashboard access and Vercel owner access.

🔵 **Scheduled — Phase D.** Full RBAC design completed in `docs/ROLE-MODEL.md`. Roles defined: `Owner`, `Admin`, `Manager`, `Analyst`, `Support`, `Auditor`. Implementation via Clerk (identity) + Supabase RLS (authorization). Target: 2 sessions of work when hiring begins.

### 1.2 Can admins control what each user can see or edit?

🔵 **Scheduled — Phase D.** Via the RBAC model above. Each table has a sensitivity tier (`public` / `internal` / `restricted` / `owner-only`) documented in `docs/ROLE-MODEL.md`. Access matrix is per-role × per-tier.

### 1.3 Do you support role-based access control?

🔵 **Scheduled — Phase D.** Designed now, implemented when users exist. See `docs/ROLE-MODEL.md`.

### 1.4 Can permissions be customized by organization?

🔵 **Scheduled — Phase D+.** Multi-tenancy via `organization_id` column on relevant tables is part of the Phase D design. For Phase D v1, assume single-tenant per subscription tier.

### 1.5 How do you prevent unauthorized users from accessing private data?

✅ **Done today.** Supabase Row-Level Security is enabled on every `v2_*` table (see `supabase/migrations/0001_init.sql` onwards). Anonymous users can only read rows where `status = 'verified'` (or explicit policy exceptions). Writes to RLS-protected tables are service-role only; service-role credentials live exclusively in Vercel env (never in the browser bundle or repo).

Evidence: `supabase/migrations/0001_init.sql` (lines 76-100), `lib/supabase/server.ts`, `docs/SUPABASE-REFERENCE.md` §"RLS posture".

### 1.6 Is multi-factor authentication available?

⚪ **Not applicable now** — no user accounts.
🔵 **Scheduled — Phase D.** Clerk natively supports TOTP, SMS, WebAuthn, and passkeys. Will be enabled for Admin+ roles at minimum.

### 1.7 Can a user be removed immediately if they leave the company?

⚪ **Not applicable now** — no employees yet.
🔵 **Scheduled — Phase D.** Clerk session invalidation propagates within seconds. Supabase RLS policies check the role claim in the JWT on every query. Revoking a Clerk user → all subsequent queries return empty result sets.

### 1.8 Are password rules enforced?

⚪ **Not applicable now** — no user accounts.
🔵 **Scheduled — Phase D.** Clerk enforces minimum length, common-password blocklist (HaveIBeenPwned integration), and complexity rules per admin configuration.

### 1.9 Can users only access the data assigned to their account or organization?

⚪ **Not applicable now** — single-tenant public data.
🔵 **Scheduled — Phase D.** Per-subscriber access gated by `v2_subscribers.user_id` matching the JWT claim at RLS layer.

### 1.10 Do you support single sign-on later if needed?

🔵 **Scheduled — Phase D.** Clerk supports Google, GitHub, Microsoft, SAML, OIDC out of the box.

---

## 2 · Audit Logs

### 2.1 Do you track user activity inside the app?

⚪ **Partially — product-side events are tracked, user actions are not because there are no users yet.**

✅ **Done for system events:** `v2_integrity_events` records every stage transition, order outcome, agent status change, and cron decision. Append-only; no `UPDATE` or `DELETE` policies exist. See `supabase/migrations/0008_integrity_events.sql`.

✅ **Done for abuse events:** `v2_abuse_events` records failed requests, rate-limit hits, and bot detections on public endpoints. See `supabase/migrations/0009_abuse_events.sql`.

🔵 **Scheduled — Phase D:** `v2_user_actions` table for authenticated user operations (login, logout, data export, settings change).

### 2.2 Can admins see who logged in and when?

🔵 **Scheduled — Phase D.** Clerk dashboard has full session history. Additionally, every authenticated request will hit a middleware that writes to `v2_user_actions` with user_id + action + timestamp + IP hash.

### 2.3 Can admins see who created, edited, deleted, or exported data?

✅ **Done for system-level actions.** Every mutation with integrity significance writes to `v2_integrity_events` with `actor` column (e.g., `trigger:alpaca-router`, `cron:integrity-audit`, `manual:<user>`). Query: `select * from v2_integrity_events where actor like 'manual:%'` for manual admin actions.

🔵 **Scheduled — Phase D** for user-level create/edit/delete/export events on subscriber data.

### 2.4 Are failed login attempts recorded?

⚪ **Not applicable now** — no login.
🔵 **Scheduled — Phase D.** Clerk records these natively + we'll mirror to `v2_user_actions` for unified querying.

### 2.5 How long are audit logs stored?

✅ **Indefinitely.** `v2_integrity_events` and `v2_abuse_events` have no retention policy. They grow forever unless explicitly pruned. Supabase free tier includes 500MB total database size; at current write volume (~100 events/day), we have years of runway before a retention policy becomes cost-relevant.

### 2.6 Can audit logs be exported?

✅ **Done.** Any Supabase user with SELECT access on `v2_integrity_events` can export via:
- Supabase dashboard → SQL Editor → run `select * from v2_integrity_events ...` → Download CSV
- `psql` client → `COPY (SELECT ...) TO STDOUT WITH CSV HEADER`
- Programmatic via `lib/supabase/server.ts` for code-driven exports

Sample export query in `docs/SUPABASE-REFERENCE.md` §"Sample audit query".

### 2.7 Can suspicious activity be flagged?

⚪ **Partially.** Anti-abuse module (`lib/anti-abuse/rate-limit.ts`) flags IPs that exceed request thresholds on `/api/marketplace/early-access`. Flagged events land in `v2_abuse_events`.

🔵 **Scheduled — Phase B** (this session or next): extend to all public endpoints + add Slack webhook on elevated abuse score.

### 2.8 Are admin actions logged separately?

✅ **Done via actor convention.** `v2_integrity_events.actor` distinguishes `manual:<user>` (human admin SQL actions), `trigger:*` (database triggers), and `cron:*` (scheduled jobs). Filter by prefix for separation.

### 2.9 Can records be restored after deletion?

⚠️ **Partial.** Integrity events are never deleted (append-only by policy). Other tables: Supabase free tier includes daily backups with 7-day retention; point-in-time recovery available on Pro tier.

🔵 **Scheduled — Phase B:** documented restore procedure in `docs/SECRETS-ROTATION-PLAYBOOK.md` extended section.

### 2.10 Are changes timestamped?

✅ **Done.** Every `v2_*` table has `created_at timestamptz not null default now()`. Mutable tables (`v2_trade_tickets`) also have `updated_at` maintained by trigger.

---

## 3 · Customer Data Isolation

### 3.1 How is one customer's data separated from another customer's data?

⚪ **Not applicable now** — no customer accounts; all data is single-tenant Demm LLC's.

🔵 **Scheduled — Phase D.** Each customer table gets `user_id uuid not null references auth.users(id)` column + RLS policy `using (user_id = auth.uid())`. This is the standard Supabase multi-tenant pattern; proven at scale.

### 3.2 Does each business/organization have its own workspace?

🔵 **Scheduled — Phase D+** (organization multi-tenancy). Not in Phase D v1, but the schema supports it: add `organization_id` column + RLS policy matching user's `organization_id` from JWT claim.

### 3.3 Can users from one company ever see another company's data?

🔵 **Scheduled — Phase D.** RLS enforcement at the database layer means even if application code has a bug, Postgres will refuse to return rows not matching the current user's organization. Defense in depth.

### 3.4 Is data separated by organization ID or tenant ID?

🔵 **Scheduled — Phase D+.** See §3.1 and §3.2.

### 3.5 Are database queries protected so users only see their own records?

✅ **Done today for anonymous users** — RLS enforces `status = 'verified'` filter on all public tables.
🔵 **Scheduled — Phase D** for per-user record isolation.

### 3.6 Is owner/admin data separated from regular user data?

🔵 **Scheduled — Phase D.** Per the role model (`docs/ROLE-MODEL.md`), owner-only tables (`v2_financial_records`, `v2_trade_tickets`, `v2_subscribers` PII columns) are RLS-gated to `role = 'owner'`. Regular users never see these rows.

### 3.7 Can staff access customer data? If yes, is that access logged?

🔵 **Scheduled — Phase D.** Staff access to customer data will be:
1. Role-gated (only `Support` + `Owner` roles can query subscriber PII)
2. Logged per-query to `v2_staff_data_access` (new table — see roadmap)
3. Subject to just-in-time access escalation for highly sensitive fields (financial data requires owner approval)

### 3.8 Is customer data encrypted?

✅ **Done at the infrastructure layer.** Supabase Postgres data is encrypted at rest (AES-256) and in transit (TLS 1.2+). This is inherent to Supabase's hosting on AWS RDS.

🔵 **Scheduled — Phase D** for application-level encryption on specific high-sensitivity fields (e.g., full payment reference IDs — even though Stripe handles the actual card data).

### 3.9 What happens to customer data if they cancel?

🔵 **Scheduled — Phase D.** Documented data-retention policy will require:
- 30 days retention after cancellation for billing reconciliation
- Then soft-delete (set `deleted_at` + restrict SELECT via RLS)
- 1 year later: hard-delete or anonymize per jurisdiction (GDPR 25.1)

### 3.10 Can customer data be deleted upon request?

🔵 **Scheduled — Phase D.** Data Subject Request workflow per GDPR Article 17. Implementation: admin dashboard endpoint `POST /api/admin/data-delete-request` that soft-deletes then scheduled hard-delete. Template in `docs/LEGAL/PRIVACY-POLICY.md`.

---

## 4 · Data Protection

### 4.1 Is data encrypted in transit and at rest?

✅ **Done.**
- **In transit:** All Vercel-served traffic is TLS 1.2+ (Vercel terminates TLS with auto-renewed certs). Supabase API is HTTPS-only. Alpaca API is HTTPS-only.
- **At rest:** Supabase Postgres storage encrypts all data at rest with AES-256 (inherited from AWS RDS).
- **Secrets:** Vercel env vars are encrypted at rest; never exposed in logs or browser bundles.

### 4.2 Where is the data stored?

✅ **Documented.**
- **Primary database:** Supabase project `eugcwkewdmlotwwbzdkl` (US region, AWS-hosted)
- **Static assets:** Vercel CDN (global edge network)
- **Secrets:** Vercel encrypted env var store
- **Source code:** GitHub (public repo, US-hosted)

### 4.3 Who has access to the database?

✅ **Documented.**
- **Operator:** Antwann Mitchell (full dashboard access)
- **Service role:** Programmatic access via `SUPABASE_SECRET_KEY` env var; only Vercel functions use it
- **Anonymous (public):** Read-only, RLS-gated to verified rows
- **Supabase platform staff:** Per Supabase's SOC 2 Type II controls — see Supabase's DPA

No employees currently. When employees hire, access flows through the admin app with role-scoped tokens; no direct Supabase dashboard access.

### 4.4 Do you back up customer data?

✅ **Done at the platform layer.** Supabase free tier: **daily automatic backups, 7-day retention**. Pro tier ($25/mo): point-in-time recovery, 30-day retention. We're on free tier now; upgrading to Pro when customer data exists (Phase D) is already roadmapped.

### 4.5 How often are backups done?

✅ **Done.** Daily automatic backups via Supabase. Upgrading to more frequent backups at Phase D.

🔵 **Scheduled — Phase B:** document a manual backup-export procedure for belt-and-suspenders (weekly SQL dump to a separate location).

---

## 5 · Privacy

### 5.1 Do you have a privacy policy?

🟡 **Shipping tonight.** `docs/LEGAL/PRIVACY-POLICY.md` template committed. Will be posted publicly at `/legal/privacy` after counsel review. Target: counsel review before any paid customer signup.

### 5.2 Do you sell or share user data?

✅ **Documented NO.** `docs/LEGAL/PRIVACY-POLICY.md` explicitly states: The Council does not sell, rent, or share user data with third parties for advertising or monetization. Data shared with service providers (Supabase, Vercel, Alpaca, Stripe when live) only as necessary to operate the service, under those providers' DPAs.

### 5.3 Can users request their data?

🔵 **Scheduled — Phase D.** Data Subject Access Request workflow; 30-day SLA per GDPR Article 15.

### 5.4 Can users delete their account?

🔵 **Scheduled — Phase D.** Self-service account deletion in subscriber dashboard. See §3.9, §3.10.

### 5.5 What personal information do you collect?

✅ **Documented.** Today: only email addresses on the marketplace waitlist (via `/api/marketplace/early-access`) + optional use-case free-text + optional company name. That's it. No IP addresses stored in cleartext (only SHA-256 hashes in `v2_abuse_events`, salted with `ABUSE_HASH_SALT`).

After Phase D: email, name, billing reference (Stripe customer_id, never card data), subscription tier, activity timestamps.

---

## 6 · Reliability

### 6.1 What happens if the app goes down?

✅ **Documented.** Vercel serves from global edge. A single region outage is transparent to users (traffic routes around). A total Vercel outage would take the site down; Supabase and Alpaca continue operating; ingestion crons fail quietly and re-attempt next scheduled run. Complete outage posture detailed in `docs/SECURITY.md` §"Incident response".

### 6.2 Do you monitor uptime?

⚠️ **Partial.** Vercel has built-in error/performance monitoring. Supabase has its own status page. Alpaca has API status page.

🟡 **Shipping tonight:** `/api/health` endpoint returning JSON with DB + broker + external-source connectivity checks. Can be polled by any external uptime monitor (UptimeRobot, Better Uptime, Pingdom — all free tiers).

🔵 **Scheduled — Phase B:** Slack webhook + PagerDuty on critical failures.

### 6.3 Is there a support contact?

🟡 **Shipping tonight** — support email placeholder documented, pending domain provisioning by operator. Interim: antwannmitchell0@gmail.com.

### 6.4 How fast do you respond to issues?

⚠️ **Best-effort today** — single-operator, no published SLA yet.
🔵 **Scheduled — Phase D:** documented SLA per subscription tier (e.g., free: 72hr, paid: 24hr, enterprise: 4hr).

### 6.5 Do you have a disaster recovery plan?

🟡 **Shipping tonight.** DR plan section in `docs/SECURITY.md`:
- Supabase daily backup restores within 2 hours (RPO 24h, RTO 2h on free tier)
- Vercel deploy can be redeployed from GitHub `main` in minutes
- Vercel env can be re-populated from `docs/VERCEL-PROJECT-REFERENCE.md` inventory
- Alpaca keys can be regenerated in minutes

🔵 **Scheduled — Phase B:** formal DR test runbook (fire quarterly).

---

## 7 · Payments

### 7.1 Do you store credit card information?

✅ **Documented NO and permanently NO.** When Stripe ships (Phase D), we store only Stripe `customer_id` (opaque reference). Never card numbers, expiration dates, CVVs, or any PCI-scoped data. Stripe is PCI-DSS Level 1 certified; they hold the card data.

### 7.2 Is payment handled by Stripe, Square, or another processor?

🔵 **Scheduled — Phase D.** Stripe, integrated via Vercel's Stripe integration (provisioned env vars automatically).

### 7.3 Are invoices and receipts available?

🔵 **Scheduled — Phase D.** Stripe generates all invoices, accessible via customer portal.

### 7.4 Can customers cancel subscriptions easily?

🔵 **Scheduled — Phase D.** Self-service cancellation via Stripe customer portal. No phone-call-required policies.

---

## 8 · Legal

### 8.1 Do you have Terms of Service?

🟡 **Shipping tonight.** Template committed at `docs/LEGAL/TERMS-OF-SERVICE.md`. Will be posted publicly at `/legal/terms` after counsel review.

### 8.2 Do you have a Privacy Policy?

🟡 **Shipping tonight.** See §5.1.

### 8.3 Do you have a Data Processing Agreement for business clients?

🟡 **Shipping tonight.** Template committed at `docs/LEGAL/DATA-PROCESSING-AGREEMENT.md` for B2B deals. Will be activated when first enterprise inquiry lands.

### 8.4 Are users required to accept terms before using the app?

🔵 **Scheduled — Phase D.** Signup flow will require ToS + Privacy Policy acceptance (click-wrap checkbox with timestamp logged to `v2_integrity_events` per user).

---

## 9 · Regulatory posture (Council-specific)

### 9.1 Is The Council a registered investment adviser?

❌ **Currently NO — and intentionally operating under the publisher's exemption.**

The Council operates as a **bona fide publisher** under §202(a)(11)(D) of the Investment Advisers Act of 1940:
- Published materials (site content, agent signals) are of regular, general circulation
- Not tailored to any specific subscriber's investment needs
- Not providing individualized advice
- Compensation is for the publication, not for advice

This posture is the working analysis. It permits operation through `broker-paper-tracking` and `live-verified` stages without RIA registration. **See `council-regulatory-compliance` skill for the full legal framework** (installed at `~/.claude/skills/council-regulatory-compliance/`).

🔵 **Blocked on RIA — Phase F.** Live-trading with customer money requires RIA registration OR a specific exemption. Until then, `live-trading` stage is blocked at the code boundary (`lib/alpaca/client.ts` refuses non-paper URLs).

### 9.2 Are there known regulatory risks?

Documented honestly in `docs/KNOWN-LIMITATIONS.md`:
- Publisher's exemption is a legal analysis, not a filed exemption — a regulator disagreeing could force an enforcement action
- "Math-gated promotion" is a novel framing — SEC may have views on public promotion of investment-adjacent signals
- RIA registration when we need it is non-trivial (likely 60-90 days + legal costs)

Mitigation: `alt-data-licensing` skill covers CFAA/ToS for each data source; `council-regulatory-compliance` skill covers the framework.

---

## 10 · Commercial / Acquisition

### 10.1 What exactly would a buyer acquire?

Itemized in `docs/OPERATING-MANUAL.md` §12.1. Short list:
- Source code + GitHub repo + history
- Vercel + Supabase projects
- Brand + 24-agent catalog + bios
- Six proprietary Claude Agent Skills (integrity frameworks)
- Integrity audit trail from Day 0 onward

### 10.2 What would a buyer need to replace?

Itemized in `docs/OPERATING-MANUAL.md` §12.2:
- Alpaca paper account (new one under buyer's entity)
- Third-party API keys (SEC_USER_AGENT, FRED, BLS, Etherscan)
- Anthropic API credits (for Claude Code sessions if buyer uses them)

### 10.3 Is there a handover checklist?

🟡 **Shipping tonight** — `docs/OPERATING-MANUAL.md` §12.3 covers a 30-minute close-day checklist. Full `docs/HANDOVER-CHECKLIST.md` in Phase C closeout.

### 10.4 Who owns the IP?

✅ **Documented.** Demm LLC (owning entity) holds all IP:
- Source code
- Brand + visual identity
- The integrity architecture thesis
- Proprietary Claude skills (integrity playbook, regulatory compliance, alt-data-licensing)
- Agent bios + academic-citation research

Assignment agreements can be drafted for a sale; default is that all IP transfers with the entity sale.

---

## 11 · Contacts for the buyer's diligence counsel

- **Primary technical:** antwannmitchell0@gmail.com
- **Legal / corporate:** (counsel of record TBD — operator to provide on request)
- **Financial:** (bookkeeper TBD — operator to provide on request)
- **Security incidents / responsible disclosure:** per `docs/SECURITY.md`

---

*This document is authoritative. If you find a gap or ambiguity, it's a documentation bug — flag it and it gets fixed.*

*See also: `docs/OPERATING-MANUAL.md` (master), `docs/ROLE-MODEL.md`, `docs/SECURITY.md`, `docs/KNOWN-LIMITATIONS.md`, `docs/ROADMAP.md`.*
