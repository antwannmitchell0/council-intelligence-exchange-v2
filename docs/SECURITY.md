# Security Posture — The Council Intelligence Exchange v2

> Public-facing security posture, responsible-disclosure policy, and incident-response runbook. This document is the single source of truth for security questions; if you're asked one that isn't answered here, the answer is "we'll add it and document it publicly."

**Document version:** 1.0 (2026-04-24)
**Owning entity:** Demm LLC
**Primary security contact:** antwannmitchell0@gmail.com (migrating to `security@<domain>` once domain provisioned)

---

## 1 · Inherited compliance

The Council operates entirely on vendors with active SOC 2 Type II certifications. We inherit their controls:

| Vendor | Role | Compliance |
|---|---|---|
| Vercel | Hosting, edge, TLS termination | SOC 2 Type II, GDPR |
| Supabase | Database, auth, realtime | SOC 2 Type II, HIPAA-eligible (paid tier), GDPR |
| Alpaca Markets | Broker (paper + future live) | FINRA/SEC regulated, SOC 2 Type II |
| Clerk (post-Phase D) | Identity + SSO | SOC 2 Type II, GDPR |
| Stripe (post-Phase D) | Payment processing | PCI-DSS Level 1 |
| GitHub | Source code hosting | SOC 1/2 Type II, ISO 27001, FedRAMP Moderate |

Our own SOC 2 Type II is scheduled for when we cross $500k ARR (industry-standard bar for own certification). Until then, our controls pass through to these vendors' certifications with our own process layered on top.

---

## 2 · Data protection

### 2.1 Encryption

- **In transit:** TLS 1.2+ enforced on every connection. HSTS header (`max-age=63072000; includeSubDomains; preload`) configured in `vercel.ts`. Mixed content is not possible.
- **At rest:** Supabase Postgres storage uses AWS RDS's native AES-256 encryption. All backups inherit the same encryption.
- **Secrets:** Vercel environment variables are encrypted at rest with per-team KMS keys. Never appear in logs or browser bundles.
- **Client-side:** The public Supabase publishable key (`sb_publishable_...`) is bundled to the browser intentionally — it's designed for public use and RLS enforces access. The secret key never touches the client.

### 2.2 Data classification

See `docs/ROLE-MODEL.md` §3 for the sensitivity tier definitions (`public` / `internal` / `restricted` / `confidential` / `owner-only`) and §5 for the per-table map.

### 2.3 Data retention

| Data type | Retention |
|---|---|
| Agent signals (`v2_signals`) | Indefinite — historical record is the product |
| Trade tickets (`v2_trade_tickets`) | Indefinite |
| Integrity events (`v2_integrity_events`) | Indefinite, append-only |
| Abuse events (`v2_abuse_events`) | Indefinite (IP/UA hashes only, no raw PII) |
| Waitlist emails (`v2_early_access_requests`) | Until subscriber signs up OR requests deletion |
| Backups (Supabase free tier) | Rolling 7 days |
| Vercel logs | 1 hour on free tier (longer on paid) |

Post-Phase D: GDPR-compliant subscriber data retention policies (see §5).

### 2.4 Backups + DR

- **Backups:** Supabase automatic daily, 7-day rolling retention on free tier
- **RPO:** 24 hours (worst case)
- **RTO:** 2 hours (to restore a Supabase backup)
- **Alternate DR path:** `docs/VERCEL-PROJECT-REFERENCE.md` documents every env var; `docs/SUPABASE-REFERENCE.md` documents every migration in order. Full rebuild from zero = ~4 hours (clone repo, re-create Supabase, run migrations, restore most-recent backup, re-provision Vercel env).

---

## 3 · Access control

### 3.1 Infrastructure access

- **Vercel:** Team has single member (Antwann Mitchell). MFA enforced.
- **Supabase:** Project owner is single member. MFA enforced.
- **GitHub:** Single account (antwannmitchell0). MFA enforced.
- **Alpaca:** Single account, paper-only. MFA enforced.

**No shared credentials exist.** Each service has its own authentication with its own MFA. Rotation procedure per service is in `docs/SECRETS-ROTATION-PLAYBOOK.md`.

### 3.2 Application access

Today: public site + anon-RLS-gated reads. No user accounts.
Post-Phase D: full RBAC per `docs/ROLE-MODEL.md`.

---

## 4 · Integrity architecture (product-specific)

The Council's defining security-relevant feature:

- **Append-only audit log** (`v2_integrity_events`). No `UPDATE` or `DELETE` policies exist on this table, not even for `owner` role. Rows are immutable once written. This is enforced by the database, not by code.
- **Public transparency.** Anonymous users can `SELECT` the entire integrity audit. An observer can verify every performance claim the product makes by running the queries documented in `docs/STAGE-TAXONOMY.md`.
- **Service-role isolation.** All privileged writes go through `lib/supabase/server.ts::getServerClient()` which uses the service-role key. The service-role key is server-only (never bundled to client) and is required to bypass RLS.
- **Stage-gated UI.** `lib/render-if-verified.ts` enforces that no performance number is rendered without its stage tag matching the claim. Blanks out rather than fills.

---

## 5 · Responsible disclosure

### 5.1 Reporting a vulnerability

If you believe you've found a security vulnerability in The Council Intelligence Exchange v2:

**Email:** antwannmitchell0@gmail.com (migrating to `security@<domain>` once domain is provisioned)

**Please include:**
- A description of the vulnerability
- Steps to reproduce
- Your assessment of severity
- (Optional) your name + contact for follow-up

**We commit to:**
- Acknowledge receipt within 48 hours
- Provide a preliminary assessment within 7 days
- Keep you updated on remediation progress
- Credit you publicly (with your permission) in the disclosure

### 5.2 Scope

**In-scope:**
- `council-intelligence-exchange-v2.vercel.app` (or future custom domain)
- API endpoints at `/api/*`
- The Supabase project (schema, RLS policies, triggers)
- Source code on GitHub

**Out-of-scope:**
- Third-party vendors (report directly to them)
- Social engineering of the operator
- Physical attacks
- Denial-of-service attacks (please don't)

### 5.3 Safe harbor

Good-faith security research is welcomed. We will not pursue legal action against researchers who:
- Do not exfiltrate data beyond the minimum required to demonstrate the vulnerability
- Do not degrade service for other users
- Do not access other users' accounts or data
- Report the vulnerability privately before any public disclosure

---

## 6 · Incident response runbook

### 6.1 Severity definitions

| Severity | Definition | Response SLA |
|---|---|---|
| **Sev 1 — Critical** | Active exploitation, customer data at risk, or regulatory-reportable incident | Immediate (within 30 min of detection) |
| **Sev 2 — High** | Service outage or high likelihood of Sev 1 escalation | Within 2 hours |
| **Sev 3 — Medium** | Degraded service, no data exposure, workaround exists | Within 24 hours |
| **Sev 4 — Low** | Cosmetic or non-impactful | Scheduled for next session |

### 6.2 Response procedure

1. **Detect** — Vercel logs, Supabase dashboard, external uptime monitor, or external report
2. **Triage** — assign severity per §6.1
3. **Contain** — stop the immediate harm:
   - Compromised secret → rotate via `docs/SECRETS-ROTATION-PLAYBOOK.md`
   - Active exploitation → block offending IP via anti-abuse, or take the endpoint offline via Vercel
   - Data exposure → disable the leaky query path; audit `v2_integrity_events` to assess scope
4. **Communicate** — within SLA per §6.1:
   - Internal: entry in `v2_integrity_events` with `event_type='incident'`
   - External: status update on site (future status page) + email to affected parties if applicable
5. **Eradicate** — root-cause the vulnerability; fix in code; ship to prod
6. **Recover** — verify service is fully operational; re-enable any disabled endpoints
7. **Post-mortem** — within 7 days: written post-mortem added to `docs/incidents/YYYY-MM-DD-<slug>.md`; actionable items added to `docs/ROADMAP.md`

### 6.3 Playbooks for known incident types

**Compromised secret:** Execute `docs/SECRETS-ROTATION-PLAYBOOK.md` Step 1-6 for the affected secret. Write incident record.

**Supabase outage:** Site continues to serve cached/static content (SSG pages). Ingestion crons queue up retries. Once Supabase recovers, re-fire any missed crons via `docs/VERCEL-PROJECT-REFERENCE.md` §"Manually triggering a cron". No data loss expected (Vercel doesn't lose state; SEC/FRED data is stored upstream for days).

**Alpaca outage:** Order router has its own circuit breaker. After 3 consecutive failures it stops, so ingestion continues but no orders fire. When Alpaca recovers, manually reset breaker via agent cold-restart (redeploy) or backfill endpoint (Phase B).

**Data deletion request (GDPR/CCPA):** Execute `docs/LEGAL/PRIVACY-POLICY.md` §"Data Subject Requests" workflow. Log in `v2_integrity_events` with `actor='manual:owner'`.

**Legal subpoena / DMCA / regulatory inquiry:** Preserve all data in scope. Do not destroy anything. Contact counsel before responding. Update `docs/LEGAL/TERMS-OF-SERVICE.md` §"Legal Process" workflow.

---

## 7 · Known risks + mitigations

Catalogued in `docs/KNOWN-LIMITATIONS.md`. Summary of security-relevant ones:

| Risk | Current mitigation | Roadmap |
|---|---|---|
| No production-grade alerting | Vercel log drains + manual checks | Phase B: Slack webhook on cron failures + Sentry |
| Single-operator dependency | Documented handover in `docs/OPERATING-MANUAL.md` §12 | Phase C: redundant operator OR acquirer |
| No formal SOC 2 of our own | Rely on vendors' SOC 2 | After $500k ARR |
| No bug bounty | Responsible-disclosure policy (this doc) | After $1M ARR consider HackerOne |
| Regulatory uncertainty (publisher exemption) | Legal analysis via `council-regulatory-compliance` skill | Phase F: RIA registration before live trading |
| Supabase free-tier 500MB cap | ~years of runway at current write rate | Upgrade to Pro ($25/mo) at 400MB threshold |
| No anti-abuse on all endpoints (only `/api/marketplace/early-access`) | Phase 6 anti-abuse framework in `lib/anti-abuse/` | Phase B: enforce on all public endpoints |

---

## 8 · Audit + transparency

Every admin action, every automated decision, every integrity event is logged to `v2_integrity_events`:

```sql
-- See everything a specific actor did in a time window
select created_at, actor, event_type, agent_id, reason, context
from v2_integrity_events
where actor = 'manual:antwann'
  and created_at > '2026-04-01'
order by created_at desc;

-- See all manual admin actions across all time
select created_at, actor, event_type, reason
from v2_integrity_events
where actor like 'manual:%'
order by created_at desc;
```

This query is available to any user via the Supabase dashboard, given appropriate credentials. An auditor or acquirer can see the full admin action history with no additional tooling.

---

## 9 · Contacts + escalation

| Role | Contact | When to use |
|---|---|---|
| Primary security contact | antwannmitchell0@gmail.com | Vulnerability reports, security questions |
| Legal / compliance | (counsel TBD) | Subpoenas, regulatory inquiries, DMCA |
| Vercel support | https://vercel.com/support | Hosting / edge / deployment issues |
| Supabase support | https://supabase.com/support | Database / auth issues |
| Alpaca support | support@alpaca.markets | Broker-side issues |

---

*This document is public and versioned. A linkable URL will be provided once the custom domain is provisioned. Until then, the latest version is at `docs/SECURITY.md` in the GitHub repo.*
