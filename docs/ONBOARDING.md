# Onboarding — New Engineer Day 1

> Zero-to-contributing walkthrough. A new engineer (or an acquirer's team) should be able to follow this start-to-finish and ship a first PR by end of day.

**Document version:** 1.0 (2026-04-24)

---

## 1 · Before you start — read these

In order:

1. **`docs/OPERATING-MANUAL.md`** §1-4 (~20 min)
2. **`docs/ARCHITECTURE.md`** (~25 min)
3. **`docs/STAGE-TAXONOMY.md`** (~15 min) — the integrity contract that shapes everything
4. **`docs/SUPABASE-REFERENCE.md`** (~15 min) — schema + RLS
5. This doc (~10 min)

Total: ~90 min of reading before touching code. It's worth it.

---

## 2 · Environment setup

### 2.1 Prerequisites

- macOS or Linux (tested on macOS; WSL2 should work but untested)
- Node.js 24 LTS
- Git
- Vercel CLI (`npm i -g vercel@latest`)
- Access credentials from the operator:
  - GitHub repo collab invite (or fork)
  - Supabase project invite
  - Vercel project invite

### 2.2 Clone + install

```bash
git clone https://github.com/antwannmitchell0/council-intelligence-exchange-v2.git
cd council-intelligence-exchange-v2
npm install
```

### 2.3 Link to Vercel

```bash
vercel link
# Select antwanns-projects / council-intelligence-exchange-v2
```

### 2.4 Pull env vars for local dev

```bash
vercel env pull .env.local --environment=development
```

This creates `.env.local` (gitignored) with all the env vars the app needs to run locally. It includes `SUPABASE_SECRET_KEY`, `ALPACA_*`, `CRON_SECRET`, `SEC_USER_AGENT` — the same ones production uses unless the operator configured a separate dev Supabase.

⚠️ **Do not commit `.env.local`.** It's in `.gitignore`. Delete it when you're done working.

### 2.5 Start the dev server

```bash
npm run dev
```

Opens on http://localhost:3000. You should see the public site load. If anything errors, check:
- Supabase URL + key in `.env.local` are correct
- `npm install` completed without errors (`npm ls` shows no UNMET PEER DEPENDENCY)

### 2.6 Verify Supabase connectivity

```bash
npx next build
```

This type-checks against the current DB schema. If types are out of date, update `lib/supabase/types.ts` (currently hand-maintained; see `docs/KNOWN-LIMITATIONS.md`).

---

## 3 · Your first task — add a new ingestion agent

This is the classic "hello world" for this codebase.

### 3.1 Understand the contract

Every agent extends `BaseIngestionAgent` and implements two methods:

```typescript
export abstract class BaseIngestionAgent {
  abstract readonly agentId: string
  abstract readonly sourceId: string

  // Pull raw rows from the upstream source.
  protected abstract fetch(): Promise<RawSignal[]>

  // Transform raw rows into NormalizedSignal rows ready for insert.
  protected abstract parse(raw: RawSignal[]): NormalizedSignal[]

  // run() is provided by the base — handles dedup, breaker, upsert, router.
}
```

Study `lib/ingestion/agents/insider-filing.ts` as the reference implementation.

### 3.2 Create the agent file

```bash
touch lib/ingestion/agents/my-test-agent.ts
```

Template:

```typescript
import "server-only"
import { BaseIngestionAgent } from "../base-agent"
import { buildExternalId } from "../dedup"
import { fetchWithRetry, RateLimiter } from "../http"
import type { NormalizedSignal, RawSignal } from "../types"

const SOURCE_ID = "my-test-source"
const AGENT_ID = "my-test-agent"

const limiter = new RateLimiter({ capacity: 5, refillPerSec: 5 })

export class MyTestAgent extends BaseIngestionAgent {
  readonly agentId = AGENT_ID
  readonly sourceId = SOURCE_ID

  protected async fetch(): Promise<RawSignal[]> {
    await limiter.take()
    const res = await fetchWithRetry("https://httpbin.org/json", {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const json = await res.json()
    // Return one RawSignal for demo purposes
    return [
      {
        source_id: SOURCE_ID,
        external_id: `demo-${Date.now()}`,
        fetched_at: new Date().toISOString(),
        payload: json,
      },
    ]
  }

  protected parse(raw: RawSignal[]): NormalizedSignal[] {
    return raw.map((r) => ({
      agent_id: AGENT_ID,
      source_id: SOURCE_ID,
      external_id: buildExternalId([SOURCE_ID, String(r.external_id)]),
      body: JSON.stringify(r.payload),
      confidence: null,
      source_url: "https://httpbin.org/json",
      status: "pending",
    }))
  }
}
```

### 3.3 Register the agent

Edit `lib/ingestion/registry.ts` and add a factory entry for `'my-test-agent'`.

### 3.4 Seed the agent + source rows

Create a migration:

```bash
touch supabase/migrations/00XX_seed_my_test_agent.sql
```

(Replace `XX` with the next number; current highest is `0013`.)

```sql
-- Add the agent
insert into v2_agents (id, name, hex, brief, status) values
  ('my-test-agent', 'My Test Agent', '#888888', 'Demo agent.', 'pending')
on conflict (id) do nothing;

-- Add the source
insert into v2_sources (id, agent_id, name, kind, category, description, cadence, endpoint_public, endpoint, status, verified_at) values
  ('my-test-source', 'my-test-agent', 'Demo httpbin', 'api', 'internal', 'Demo source', 'daily', true, 'https://httpbin.org/json', 'verified', now())
on conflict (id) do nothing;
```

Apply it via Supabase SQL Editor (see `docs/SUPABASE-REFERENCE.md` §"Running a migration"). The v2_agents and v2_sources rows must exist before ingestion will work (FK constraint).

### 3.5 Test locally

```bash
# Start the dev server
npm run dev

# In another terminal, invoke the cron handler
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/ingest/my-test-agent"
```

Expected: `{"ok": true, "result": {"status": "success", "ingested": 1, ...}}`.

### 3.6 Verify in Supabase

```sql
select id, agent_id, created_at, body
from v2_signals
where agent_id = 'my-test-agent'
order by created_at desc
limit 5;
```

You should see the signal you just ingested.

### 3.7 Ship it

```bash
git checkout -b feat/my-test-agent
git add lib/ingestion/agents/my-test-agent.ts lib/ingestion/registry.ts supabase/migrations/00XX_*.sql
git commit -m "feat(ingestion): add my-test-agent as a demo"
git push -u origin feat/my-test-agent
gh pr create --title "feat(ingestion): add my-test-agent" --body "Demo agent for onboarding walkthrough."
```

After PR approval + merge, Vercel auto-deploys. The daily cron (if added to `vercel.ts`) picks it up on schedule.

**First PR shipped. Welcome to the team.**

---

## 4 · Day 1 checklist

- [ ] Read all Section 1 docs
- [ ] Clone repo, install, run dev server
- [ ] Pull env vars, verify build passes
- [ ] Build + ship `my-test-agent` (Section 3)
- [ ] Read `docs/STAGE-TAXONOMY.md` in depth — the integrity contract is the soul of this product
- [ ] Skim `lib/ingestion/base-agent.ts`, `lib/alpaca/order-router.ts`, `lib/integrity/audit.ts` — these three files are 80% of the business logic
- [ ] Set up local Supabase type generation (optional — see `docs/KNOWN-LIMITATIONS.md`)
- [ ] Introduce yourself in whatever team channel exists

---

## 5 · Where to find things

| You want to... | Look in |
|---|---|
| Understand how stages work | `docs/STAGE-TAXONOMY.md` + `lib/integrity/math.ts` |
| Add an ingestion agent | `lib/ingestion/agents/*.ts` (see `insider-filing.ts` as the reference) |
| Change ingestion behavior across all agents | `lib/ingestion/base-agent.ts` |
| Add a new route | `app/api/*/route.ts` or `app/*/page.tsx` |
| Modify cron schedules | `vercel.ts` |
| Change RLS or add a migration | `supabase/migrations/` |
| Touch the UI | `app/**`, `components/**`, `design/tokens.ts` |
| Investigate Alpaca interaction | `lib/alpaca/` |
| Find a DB query for a specific check | Supabase SQL Editor + "Private" saved queries |

---

## 6 · Debugging a failing pipeline

### 6.1 Cron returns 500

```
{"ok":false,"result":{"status":"failed","errors":1,"warnings":["..."]}}
```

Read `warnings[0]`. Common:

- `upsert_failed: No suitable key or wrong key type` → unique constraint issue. See `docs/KNOWN-LIMITATIONS.md` (already fixed in migrations 0011/0012).
- `upsert_failed: Legacy API keys are disabled` → using JWT instead of `sb_secret_`. See `docs/SUPABASE-REFERENCE.md` §"Current env vars".
- `upsert_failed: violates foreign key constraint` → v2_sources or v2_agents row missing for this agent/source. See migration 0013 pattern.
- `fetch_failed: fetch failed` → upstream offline (check with direct curl).

### 6.2 Signal landed but no trade ticket

Likely the order router skipped it. Debug:

```sql
-- Check signal shape
select id, symbol, side, stage_tag
from v2_signals
where id = '<signal_id>';

-- Check integrity events for this signal
select event_type, reason, context
from v2_integrity_events
where signal_id = '<signal_id>';
```

If `symbol` is null → agent's parse() didn't resolve a symbol. Fix at the agent layer.
If `stage_tag` is still `pending` → router didn't run (check router breaker) or skipped (check integrity events).

### 6.3 Cron runs but logs say `alpaca_env_missing`

Missing `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET`, `ALPACA_WEBHOOK_SECRET`, or `ALPACA_BASE_URL` in Vercel env.

Verify:

```bash
vercel env pull .env.check --environment=production
grep ALPACA .env.check | awk -F= '{print $1, length($2)-2}'
rm .env.check
```

Lengths should be 26, 44, 64, 32 respectively. See `docs/ALPACA-REFERENCE.md`.

### 6.4 Alpaca returns 401

Keys don't authenticate. Most likely cause: bad paste during `vercel env add` (the interactive prompt sometimes stores empty values silently). Re-add using the temp-file method from `docs/SECRETS-ROTATION-PLAYBOOK.md`.

### 6.5 Integrity audit never promotes

Agent hasn't passed the math gate OR insufficient days. Check:

```sql
-- Which gate failed?
select created_at, event_type, reason, context
from v2_integrity_events
where agent_id = '<agent_id>'
  and event_type in ('math_gate_fail', 'math_gate_pass')
order by created_at desc
limit 5;

-- How many calendar days of data do we have?
select min(filled_at), max(filled_at), count(*)
from v2_trade_tickets
where agent_id = '<agent_id>' and order_status = 'filled';
```

If `days < 90` → patience. The 90-day bar is physics, not code.
If `IC < 0.05` → agent isn't passing. That's the math doing its job. Agent will eventually retire per `RETIRE_GATE` if it doesn't recover.

---

## 7 · Communication + ops

### Commits + PRs
- One commit per logical change. Squash on merge via `gh pr merge --squash`.
- Commit message format: `type(scope): message`. Types: `feat`, `fix`, `docs`, `chore`, `seed`.
- Every PR has a test plan in the description.
- Co-author tag retained for AI-assisted commits.

### Deploys
- `main` branch is production. Any merge to `main` triggers a prod deploy.
- Preview deploys on every PR; test there before merging.
- Emergency rollback: Vercel dashboard → Deployments → previous → Promote to Production.

### Runbook when things break
- `docs/SECURITY.md` §6 for security incidents
- `docs/SECRETS-ROTATION-PLAYBOOK.md` for key rotation
- `docs/SUPABASE-REFERENCE.md` for DB issues
- `docs/VERCEL-PROJECT-REFERENCE.md` for deploy / env / cron issues

---

## 8 · Style conventions (short version)

- TypeScript strict mode; no `any` without a comment explaining why
- Server-only code: add `import "server-only"` at the top
- No new dependencies without justification (minimize bundle + surface area)
- Prefer composition over inheritance, EXCEPT where we already inherit (like `BaseIngestionAgent`) — then follow the pattern
- Structured logging only: `console.log(JSON.stringify({ event, ...data }))`
- Never log secrets. Never log PII. If in doubt, hash first (`lib/anti-abuse/` has patterns)

---

## 9 · Questions?

- Technical: `antwannmitchell0@gmail.com`
- Architecture / design intent: read `docs/OPERATING-MANUAL.md` §1 first; if still unclear, ask

Welcome aboard.
