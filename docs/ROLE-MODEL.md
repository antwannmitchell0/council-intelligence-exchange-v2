# Role Model — RBAC + Table Sensitivity Matrix

> The complete access-control design for The Council Intelligence Exchange v2. Implemented fully in **Phase D**; documented now so the architecture is deterministic when it ships.

**Document version:** 1.0 (2026-04-24)

---

## 1 · Why this doc exists now

Today the product has one operator (Antwann Mitchell, Demm LLC) and no user accounts. No RBAC is implemented. But:

- The investor due-diligence checklist asks extensively about role-based access (`docs/DUE-DILIGENCE.md` §1).
- We WILL hire employees; when we do, access boundaries must be designed, not improvised under pressure.
- Investors and acquirers need to see the plan, not discover it's absent.

**Commitment:** this design ships as code in Phase D. No scope creep; no surprises. Any deviation is logged as a change against this document.

---

## 2 · Role definitions

Six roles. Each is named for a real job function; permissions match the job, not the seniority.

| Role | Purpose | Primary users | Key permissions |
|---|---|---|---|
| `owner` | Supreme access. One human. | Antwann Mitchell (today). Transferable on acquisition. | ALL tables, ALL actions, including destructive |
| `admin` | Day-to-day engineering + ops | Senior engineers, CTO-equivalent | Everything except: cannot modify `owner`-only tables (billing, secrets references); cannot change roles |
| `manager` | Team oversight, no ops access | Non-technical manager / product lead | Read all agent + signal data; can invite users to the admin app; cannot run migrations or change RLS |
| `analyst` | Read-only data access for research | Data analysts, quants | Read-only on `v2_signals`, `v2_trade_tickets`, `v2_integrity_events`; cannot read subscriber PII; cannot write |
| `support` | Customer-facing operations | Support staff | Read + limited write on subscriber data (cancel, refund-request, reset-password); cannot read financial records |
| `auditor` | External compliance review | Contract auditor, counsel, acquirer's diligence team | Read-only on EVERYTHING including integrity events; time-limited access (90-day default) |

**Role exclusions:** `owner` does NOT have a separate "operator" role. Same person can hold multiple Clerk profiles if needed for separation-of-duties, but the system treats `owner` as singular.

**Multiple roles per user:** not supported in v1. A user has exactly one role.

---

## 3 · Table sensitivity tiers

Every table in the database is assigned ONE sensitivity tier. Tiers drive RLS policies.

| Tier | Definition | Example tables |
|---|---|---|
| `public` | Intended for public read (RLS: `status='verified'` filter for anon) | `v2_agents`, `v2_signals`, `v2_leaderboard_snapshots`, `v2_integrity_events` (SELECT-public by design) |
| `internal` | Non-public but non-sensitive; employees can read | `v2_sources`, `v2_agent_heartbeats`, `v2_hive_events` |
| `restricted` | Employee-tier access with role gates | `v2_abuse_events` (restricted to admin+), future `v2_user_actions` |
| `confidential` | Admin+ role; contains operational + partial PII | `v2_trade_tickets` (after Phase D subscriber attribution), future `v2_subscribers` minus PII |
| `owner-only` | Only `owner` role; contains sensitive PII or financial data | Future `v2_subscribers` PII columns, `v2_financial_records`, `v2_secret_audit` |

---

## 4 · Access matrix

Role × Tier. `R` = read, `W` = write, `—` = no access.

| | public | internal | restricted | confidential | owner-only |
|---|:---:|:---:|:---:|:---:|:---:|
| **owner** | RW | RW | RW | RW | RW |
| **admin** | RW | RW | RW | R (no-PII columns) | — |
| **manager** | R | R | R (read only) | — | — |
| **analyst** | R | R | — | R (aggregated / non-PII only) | — |
| **support** | R | R | R | R (subscriber scope only, limited W) | — |
| **auditor** | R | R | R | R | R (read-only, time-limited) |
| **anonymous** (public site) | R (verified only) | — | — | — | — |

**Special rules:**
- `support` writes are limited to: cancel subscription, flag account, request password reset. Never delete.
- `auditor` access is time-bounded: the role is granted for 90 days, Clerk auto-expires the role claim. Renewable by owner.
- `analyst` can see aggregates but never individual subscriber PII (view-based projection).

---

## 5 · Per-table access map (phase-D-ready)

### Current tables (pre-subscriber schema)

| Table | Tier | Owner | Admin | Manager | Analyst | Support | Auditor | Anon |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `v2_agents` | public | RW | RW | R | R | R | R | R (verified) |
| `v2_signals` | public | RW | RW | R | R | R | R | R (verified) |
| `v2_trade_tickets` | confidential | RW | RW | — | R (agg) | — | R | R (filled/partial) |
| `v2_integrity_events` | public | RW | R (no write) | R | R | R | R | R (all rows) |
| `v2_agent_heartbeats` | internal | RW | RW | R | R | R | R | R (all rows) |
| `v2_leaderboard_snapshots` | public | RW | RW | R | R | R | R | R |
| `v2_sources` | internal | RW | RW | R | R | R | R | R (verified) |
| `v2_hive_events` | internal | RW | RW | R | R | R | R | R (verified) |
| `v2_early_access_requests` | owner-only | RW | — | — | — | R (support scope) | R | — (RPC write only) |
| `v2_abuse_events` | restricted | RW | RW | R | — | R | R | — |
| `v2_directional_signals` | public | RW | RW | R | R | R | R | R (verified) |

### Future tables (added in Phase D)

| Table | Tier | Notes |
|---|---|---|
| `v2_subscribers` | confidential (PII: owner-only) | split table: `v2_subscribers` (non-PII, confidential) + `v2_subscribers_pii` (owner-only, linked by id) |
| `v2_user_actions` | restricted | every authenticated user action; indefinite retention |
| `v2_staff_data_access` | owner-only | every staff query that touched subscriber PII |
| `v2_financial_records` | owner-only | revenue, payouts, tax-relevant rows |
| `v2_secret_audit` | owner-only | secret rotation history |
| `v2_subscriptions` | confidential | subscription tier + status |
| `v2_stripe_events` | confidential | Stripe webhook events |

---

## 6 · Implementation mechanics (Phase D deploy plan)

### 6.1 Auth provider choice

**Clerk.** Reasons:
- Native multi-provider SSO (Google, GitHub, Microsoft, SAML)
- Role claims in JWT (flows directly to Supabase RLS)
- Session invalidation propagates in seconds
- Free tier generous (10k monthly active users)
- No passwords to manage ourselves

Alternative considered: Supabase Auth. Pros: one fewer service. Cons: weaker SSO, less polished admin UX. **Decision: Clerk.**

### 6.2 JWT claim shape

When a user authenticates via Clerk, their role propagates to the Supabase JWT:

```json
{
  "sub": "user_clerk_id_here",
  "role": "admin",
  "organization_id": "demm-llc",
  "email": "jane@demm-llc.com",
  "aud": "authenticated",
  "exp": 1740000000
}
```

Supabase's JWT verifier validates the signature (Clerk's JWKS); RLS policies read `(auth.jwt() ->> 'role')::text` to make decisions.

### 6.3 Sample RLS policy

```sql
-- v2_trade_tickets — confidential tier, owner+admin can read, owner writes
create policy "v2_trade_tickets owner_admin select"
  on v2_trade_tickets for select
  using (
    (auth.jwt() ->> 'role')::text in ('owner', 'admin', 'auditor', 'analyst')
  );

create policy "v2_trade_tickets owner write"
  on v2_trade_tickets for insert
  with check ((auth.jwt() ->> 'role')::text = 'owner');

-- Public filled rows still visible to anon
create policy "v2_trade_tickets public read filled"
  on v2_trade_tickets for select
  using (order_status in ('filled', 'partially_filled'));
```

Service-role writes bypass RLS entirely (order router, webhook) — that's correct and intentional.

### 6.4 Admin app structure

```
app/
  (public)/            # current public site — no auth
    page.tsx
    agents/
    ...
  (app)/               # NEW Phase D — subscriber app
    dashboard/
    signals/
    settings/
    middleware.ts      # Clerk auth required
  (admin)/             # NEW Phase D — employee admin
    users/
    agents/            # admin view of agents (edit bios, promote)
    audit/             # integrity events viewer
    billing/           # owner-only
    middleware.ts      # Clerk auth + role >= manager required
  api/
    ...                # existing routes
    admin/             # NEW admin-only endpoints
      users/
      data-export/
      data-delete/
```

**Middleware enforces role on every request.** Client-side role checks (React) are cosmetic — the DB is the source of truth.

### 6.5 Employee onboarding flow (Phase D)

1. Owner creates invite in admin dashboard: email + role
2. Clerk sends signup link; employee sets up MFA
3. On first login, middleware attaches role to JWT
4. Employee accesses `admin.councilexchange.com` (or internal path)
5. Every session start logs to `v2_integrity_events` (actor=`user:<clerk_id>`)

### 6.6 Employee offboarding flow (Phase D)

1. Owner clicks "Revoke" in admin dashboard
2. Clerk deletes the user + invalidates all sessions
3. Next query from the old JWT fails signature verification at Supabase → empty result set
4. Revocation event logged to `v2_integrity_events`

---

## 7 · What this design PREVENTS

| Attack / mistake | Prevented by |
|---|---|
| Employee runs rogue SQL in Supabase dashboard | Employees never get dashboard access. They operate via admin app with role-scoped JWT. |
| Leaked JWT → unauthorized table access | Supabase validates signature (rotates on JWT secret rotation). RLS additionally gates per-role. |
| Analyst sees subscriber email addresses | PII columns are split into owner-only table; RLS denies analyst SELECT. |
| Support accidentally deletes a customer | Support role has write policies limited to explicit allowed fields (cancel, flag) — no DELETE policy. |
| Ex-employee keeps access after leaving | Clerk session revocation + JWT signature invalidation cascade to Supabase within seconds. |
| Auditor reviews beyond their engagement | Auditor role has time-limited JWT; Clerk auto-expires. |
| Admin accidentally writes to integrity log | Integrity log has NO insert/update/delete policies for admin role. Only service-role + triggers. |

---

## 8 · Known gaps in this design (honest list)

- **Multi-tenancy for B2B customers**: not in Phase D v1; `organization_id` column added to key tables but not enforced. Ships in Phase D v2.
- **Just-in-time access escalation**: owner-approval flow for highly sensitive queries is designed but not ticketed. Ships in Phase D v3 or E.
- **Comprehensive field-level access control**: some columns in `confidential` tier should be owner-only; today's schema doesn't split them. Phase D migration will.
- **Session hijacking protection**: Clerk's JWT can't be revoked in-flight without a new JWT. Mitigated by short TTL (1 hour default). Acceptable for MVP; revisit on enterprise customer requirement.
- **No formal SOC 2**: rely on Vercel (SOC 2 Type II) + Supabase (SOC 2 Type II) + Clerk (SOC 2 Type II) inherited compliance. Own SOC 2 scheduled for after $500k ARR (industry bar).

All listed in `docs/KNOWN-LIMITATIONS.md` with target phases.

---

## 9 · Cross-references

- `docs/OPERATING-MANUAL.md` §6 — executive summary of access model
- `docs/DUE-DILIGENCE.md` §1, §3 — investor-facing answers referencing this design
- `docs/SECURITY.md` — responsible disclosure + incident response
- `docs/SUPABASE-REFERENCE.md` — current RLS policies per table
- `docs/ROADMAP.md` Phase D — implementation schedule
