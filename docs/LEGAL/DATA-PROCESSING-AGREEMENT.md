# Data Processing Agreement

> **⚠️ Template — pending counsel review before execution with any B2B customer.** This DPA is designed for GDPR Article 28 compliance and CCPA service-provider framing. Do not execute without a qualified attorney's review.

**Parties:**
- **Controller:** [Customer Name] — the entity contracting for The Council's services
- **Processor:** Demm LLC — operator of The Council Intelligence Exchange

**Effective date:** Upon execution by both parties.
**Document version:** 1.0 (2026-04-24)

---

## 1 · Background + purpose

Customer ("**Controller**") has engaged Demm LLC ("**Processor**") to provide intelligence-exchange services described in the Master Services Agreement ("**MSA**") between the parties.

As part of delivering those services, Processor may process personal data on Controller's behalf ("**Customer Data**"). This DPA governs that processing to comply with applicable data-protection laws, including:
- **GDPR** (Regulation (EU) 2016/679)
- **UK GDPR** (equivalent UK law)
- **CCPA / CPRA** (California Consumer Privacy Act / California Privacy Rights Act)

This DPA is incorporated into and forms part of the MSA.

---

## 2 · Definitions

Terms defined here or in Article 4 of GDPR have the meanings given there. Specifically:

- **Customer Data** — personal data provided by Controller or its authorized users to Processor in connection with the Service.
- **Data Subject** — the individual whose personal data is processed.
- **Sub-processor** — any third party Processor engages to process Customer Data on its behalf.
- **Processing** — any operation performed on Customer Data (collection, storage, use, disclosure, deletion, etc.).

---

## 3 · Subject matter + duration

**Subject matter:** Processing of Customer Data in connection with the Service.
**Duration:** For the term of the MSA plus any retention period required by law.
**Nature + purpose:** Providing intelligence-exchange services as described in the MSA.

### Categories of data processed

| Category | Examples |
|---|---|
| Contact data | Name, email, company affiliation |
| Authentication data | Clerk user ID, session tokens, MFA state |
| Billing reference | Stripe customer ID (no card data — Stripe holds that) |
| Usage data | Login timestamps, features accessed, signals viewed |
| Technical data | Hashed IP address, hashed user-agent |

### Categories of Data Subjects

- Controller's authorized users (employees, agents, or end-users granted access)

### Special categories of data

**None.** Processor does NOT process:
- Health data
- Race, ethnicity, political opinions, religious beliefs
- Biometric data
- Children's data (under 18)
- Payment card data (handled by Stripe as PCI processor)

If Controller introduces special-category data, both parties must agree in writing to additional safeguards first.

---

## 4 · Processor obligations

Processor shall:

### 4.1 Process only on instructions

Process Customer Data only on documented instructions from Controller, including for transfers (documented in the MSA + this DPA + the Service configuration). Processor shall notify Controller if it believes an instruction violates GDPR or other applicable law.

### 4.2 Confidentiality

Ensure personnel with access to Customer Data are bound by confidentiality obligations (contractual or statutory) and trained on data protection.

### 4.3 Security measures

Implement appropriate technical and organizational measures (Article 32 GDPR) to ensure a level of security appropriate to the risk, including those listed in **Annex A**.

### 4.4 Sub-processor engagement

Only engage Sub-processors under the terms of §5 below.

### 4.5 Assistance

Assist Controller in responding to Data Subject rights requests (access, rectification, erasure, portability, etc.) per Chapter III GDPR.

Assist Controller with GDPR Articles 32-36 compliance (security, breach notification, DPIAs, consultation with supervisory authority).

### 4.6 Deletion / return of data

At the end of the MSA, Processor shall — at Controller's election — delete or return all Customer Data within 30 days, except where retention is required by law (e.g., tax records). Data in integrity-audit logs (`v2_integrity_events`) may be retained in anonymized form (no Data Subject PII) for the product's ongoing integrity guarantees.

### 4.7 Audit rights

Make available to Controller all information necessary to demonstrate compliance, including:
- SOC 2 Type II reports of our vendors (Vercel, Supabase, Clerk, Stripe) upon request
- Our own SOC 2 Type II once certified (scheduled Phase E/F)
- Audit rights for Controller (at Controller's expense; 30 days' notice; no more than once per year unless for-cause)

---

## 5 · Sub-processors

Controller authorizes Processor to engage the Sub-processors listed in **Annex B**.

Processor shall:
- Impose data-protection obligations on Sub-processors no less strict than those in this DPA
- Remain fully liable to Controller for Sub-processor failures
- Give Controller 30 days' notice of any new Sub-processor, with right to object
- If Controller objects with reasonable grounds, Processor may either accommodate the objection OR terminate the affected Services with prorated refund

---

## 6 · International transfers

Customer Data may be transferred to and processed in the United States.

For Customer Data originating in the EU/UK:
- Transfer basis: **Standard Contractual Clauses** (EU Commission Implementing Decision 2021/914) — Module 2 (Controller to Processor), incorporated by reference
- Supplementary measures: encryption in transit (TLS 1.2+), encryption at rest (AES-256), access controls (see Annex A)
- Processor will not disclose Customer Data to government authorities except where legally compelled, and will challenge unlawful requests

For Customer Data originating in the UK:
- Transfer basis: UK SCCs / International Data Transfer Agreement as applicable

---

## 7 · Security breach notification

If Processor becomes aware of a personal-data breach (per Article 4(12) GDPR) affecting Customer Data, Processor shall:

- Notify Controller without undue delay, and within **72 hours** of becoming aware
- Provide information reasonably necessary for Controller's Article 33 GDPR compliance
- Take steps to mitigate the breach and prevent recurrence
- Document the breach per Article 33(5) GDPR

Notification is not an admission of liability.

Full breach-response runbook: `docs/SECURITY.md` §6.

---

## 8 · Data Subject requests

If a Data Subject contacts Processor directly with a rights request, Processor shall:
- Forward the request to Controller within 5 business days
- Not respond to the Data Subject directly unless Controller instructs

Processor will assist Controller in responding to such requests at no additional cost, using automated export/deletion tools described in `docs/KNOWN-LIMITATIONS.md` Phase D workflow.

---

## 9 · Return + deletion of Customer Data

Upon MSA termination or Controller's written request:

- Within **30 days**, Processor shall return or delete Customer Data per Controller's election
- Processor shall provide written certification of deletion within 45 days of completion
- Exception: data in integrity-audit logs (stripped of Data Subject identifiers) may be retained indefinitely as described in §4.6
- Exception: data required by applicable law (tax, accounting, audit) may be retained for the legally required period, then deleted

---

## 10 · Liability

Each party's liability under this DPA is subject to the limitation of liability in the MSA, provided that:

- Nothing in this DPA or the MSA limits a Data Subject's rights under GDPR
- Joint and several liability between Controller and Processor for Article 82 GDPR damages, as apportioned by a court

---

## 11 · Modifications

This DPA may be modified only by written agreement of both parties. However, Processor may unilaterally update this DPA to reflect:
- Changes in applicable law
- New Sub-processors (per §5 notice procedure)
- Changes to Sub-processor security posture

Material changes require 30 days' notice to Controller.

---

## 12 · Governing law

This DPA is governed by the laws of [Jurisdiction of Demm LLC — to confirm], except where GDPR or other applicable law requires otherwise.

---

## Annex A — Security measures

Processor maintains the following technical and organizational measures:

### A.1 Access control
- Least-privilege access via role-based access control (`docs/ROLE-MODEL.md`)
- MFA enforced on all administrative accounts
- Service-role credentials isolated to Vercel encrypted env vars
- Session expiry + immediate revocation on employee offboarding

### A.2 Encryption
- TLS 1.2+ in transit
- AES-256 at rest (all Supabase Postgres storage)
- HSTS enforced

### A.3 Audit + monitoring
- Append-only `v2_integrity_events` for all integrity decisions
- Abuse events logged to `v2_abuse_events`
- Vercel logs capture all request activity
- (Post-Phase B) Sentry + Slack alerts on error events

### A.4 Backup + recovery
- Daily Supabase backups, 7-day retention (free tier) / 30-day + PITR (paid tier)
- RPO: 24 hours / RTO: 2 hours
- Full DR runbook in `docs/SECURITY.md` §6.3

### A.5 Vendor management
- All Sub-processors are SOC 2 Type II certified
- DPAs executed with each Sub-processor
- Annual vendor review

### A.6 Personnel
- Background checks for all employees handling Customer Data
- Confidentiality obligations in employment agreements
- Security awareness training at hire + annually

### A.7 Incident response
- Documented incident response plan (`docs/SECURITY.md` §6)
- 24/7 on-call (post-Phase D when subscriber count justifies)
- 72-hour breach notification SLA

---

## Annex B — Authorized Sub-processors

As of the Effective Date, Processor engages the following Sub-processors:

| Sub-processor | Service provided | Location | Certification |
|---|---|---|---|
| Vercel, Inc. | Hosting, edge, TLS termination | US (multi-region) | SOC 2 Type II, GDPR |
| Supabase, Inc. | Database (Postgres), realtime, storage | US (AWS) | SOC 2 Type II, GDPR |
| Alpaca Securities LLC | Broker (paper + future live trading) | US | FINRA/SEC regulated |
| Clerk, Inc. (post-Phase D) | Identity + authentication | US | SOC 2 Type II, GDPR |
| Stripe, Inc. (post-Phase D) | Payment processing | US + global | PCI-DSS Level 1, SOC 2 Type II, GDPR |
| Resend, Inc. (post-transactional email) | Transactional email delivery | US | SOC 2 Type II |
| Anthropic, PBC (internal dev only) | AI-assisted development (Claude Code); **no Customer Data is sent** | US | SOC 2 Type II |

Changes to this list are governed by §5.

---

## Signatures

**Controller:**

Name: __________________________
Title: __________________________
Company: __________________________
Date: __________________________

**Processor (Demm LLC):**

Name: Antwann Mitchell
Title: [Founder / Managing Member / etc. — confirm]
Company: Demm LLC
Date: __________________________

---

*This DPA supplements the MSA. If there is a conflict between this DPA and the MSA regarding personal-data protection, this DPA controls.*
