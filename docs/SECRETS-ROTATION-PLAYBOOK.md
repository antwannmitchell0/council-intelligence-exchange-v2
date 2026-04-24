# Secrets Rotation Playbook

> How to add, verify, and rotate every secret in this project — without the mistakes we made the first time around.

## Why this doc exists

Over the course of Phase 4 setup, we hit every common secret-management failure mode:
- Alpaca keys added to Production + Preview (bad — Preview deploys would have fired real paper orders)
- `vercel env rm <name> <scope>` nuked the entire record when it was cross-scope
- `vercel env add` interactive prompts silently accepted empty values
- Dashboard "Add" form let us paste the **value** into the **Key (name)** field — storing the secret as a variable name, effectively exposing it
- Clipboard got stepped on by other apps mid-paste
- `openssl | vercel env add` pipe stored a truncated 46-char value instead of 64

This playbook encodes the workarounds.

## Core rules

1. **Production scope only** for anything with cost or mutation impact (broker keys, service-role keys, webhook secrets). Preview deploys should NEVER inherit these.
2. **Always verify length after add.** Never trust "Added" confirmation alone.
3. **The CLI interactive prompt lies.** If the add completes in <50ms with no value echo, assume empty.
4. **The dashboard has a field-order trap.** Key (top) = variable NAME. Value (bottom, bigger) = the secret. They are NOT labeled clearly enough — check twice.
5. **Paste-then-save requires a click-outside.** Some dashboard forms commit the input on blur. Click somewhere neutral before Save.
6. **Never let a secret touch shell history.** Use stdin pipes or tempfiles, never `export FOO=<secret>`.

## Current secrets inventory

| Variable | Scope | Length | Generator | Rotation trigger |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | 40 | Supabase dashboard | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | ~200 (JWT) | Supabase | On JWT secret rotation |
| `SUPABASE_SERVICE_ROLE_KEY` | **Not set yet** | ~200 (JWT) | Supabase | Add + rotate simultaneously |
| `CRON_SECRET` | Production | 32+ | `openssl rand -hex 32` | Every 6 months or on compromise |
| `SEC_USER_AGENT` | Production | ~40 | Plain string | — |
| `ALPACA_API_KEY_ID` | Production | 20 (starts `PK`) | Alpaca dashboard (Paper) | On compromise or every 6 months |
| `ALPACA_API_SECRET` | Production | 40 | Same generation as Key ID (shown once) | With `ALPACA_API_KEY_ID` |
| `ALPACA_WEBHOOK_SECRET` | Production | 64 | `openssl rand -hex 32` | On compromise |
| `ALPACA_BASE_URL` | Production | 32 | `https://paper-api.alpaca.markets` | Only when flipping to live |

## Add procedure — three battle-tested methods

### Method A — `openssl | vercel env add` (generators only)

Use when the secret is **machine-generated and interchangeable** (webhook secrets, CRON_SECRET). The value never touches your eyes or clipboard.

```bash
cd "/Users/antwannmitchellsr/The Council Intelligence Exchange/The Council Intelligence Exchange v2"

openssl rand -hex 32 | vercel env add ALPACA_WEBHOOK_SECRET production
```

**⚠️ Known failure mode:** `vercel env add` may ask follow-up questions mid-stream (environments, scope). The piped stdin gets partially consumed by those prompts, producing a truncated value. If verification shows a length you didn't expect, remove and use Method B instead.

**Verify immediately:**
```bash
vercel env pull .env.check --environment=production
awk -F= '/^ALPACA_WEBHOOK_SECRET/ {gsub(/"/,"",$2); print "len=" length($2)}' .env.check
rm .env.check
```
Target: `len=64`. Anything else = redo.

### Method B — Tempfile pipe (for values you need to see to trust)

Use for **values copied from an external source** — Alpaca keys, API tokens, anything you only have access to through a UI.

```bash
# 1. Get the value onto your clipboard (click the copy icon on the source page)
# 2. Dump to tempfile
pbpaste > /tmp/secret-value

# 3. Verify length WITHOUT printing the value
wc -c < /tmp/secret-value
#    If length is off by 1 (trailing newline), strip it:
tr -d '\n\r' < /tmp/secret-value > /tmp/secret-value.clean && mv /tmp/secret-value.clean /tmp/secret-value
wc -c < /tmp/secret-value

# 4. Also verify the prefix without revealing full value:
head -c 2 /tmp/secret-value
#    (e.g. 'PK' for Alpaca paper Key ID)

# 5. Pipe to Vercel
cat /tmp/secret-value | vercel env add ALPACA_API_KEY_ID production

# 6. IMMEDIATELY delete the tempfile
rm /tmp/secret-value
```

**Why tempfile > direct paste to prompt:** `vercel env add` reads stdin until EOF. Interactive paste can drop characters on long values, terminals with weird clipboard bridging (VS Code, tmux) corrupt pastes, and there's no visual feedback. A tempfile is byte-exact.

### Method C — Vercel Dashboard (fallback when CLI won't cooperate)

Use ONLY if methods A and B fail. The dashboard has the field-order trap that burned us once.

1. Open https://vercel.com/antwanns-projects/council-intelligence-exchange-v2/settings/environment-variables
2. Click **Add Environment Variable**
3. **KEY field (top, short, single-line)** → type the variable NAME (e.g. `ALPACA_API_KEY_ID`). NOT the secret.
4. **VALUE field (below Key, bigger, may have eye icon)** → paste the secret with Cmd+V. **Verify you see characters appear** before proceeding. An empty-looking field = paste didn't land.
5. Click somewhere neutral on the page to blur the field. This commits the input on some form versions.
6. Check **Production** only. Uncheck Preview + Development.
7. Click **Save**.
8. Watch for a success toast. If none appears and the row doesn't show in the list, the save didn't go through.

**Verify from CLI:**
```bash
vercel env pull .env.check --environment=production
awk -F= '/^ALPACA_/ {gsub(/"/,"",$2); print $1 " len=" length($2)}' .env.check
rm .env.check
```

## Rotation procedure

### Step 1 — Generate / regenerate the new value at the source

- **Alpaca keys:** Alpaca dashboard → Paper → API Keys → **Regenerate**. Old keys die immediately.
- **CRON_SECRET / WEBHOOK_SECRET:** `openssl rand -hex 32`
- **Supabase JWT:** Supabase → Settings → API → Generate new JWT secret. **This is destructive** — old anon + service_role keys die; you must update both in Vercel within the same deploy.

### Step 2 — Remove the old Vercel entry

⚠️ **Gotcha:** `vercel env rm <name> <scope>` removes the entire record, not just the scope, when the var is stored cross-scope. The record gets deleted everywhere.

```bash
vercel env rm ALPACA_API_KEY_ID production --yes
```

### Step 3 — Add the new entry (Method A, B, or C above)

### Step 4 — Verify

```bash
vercel env pull .env.check --environment=production
awk -F= '/^ALPACA_/ {gsub(/"/,"",$2); print $1 " len=" length($2)}' .env.check
rm .env.check
```

Expected lengths from the inventory table above.

### Step 5 — Redeploy

```bash
vercel --prod
```

Env changes don't reach running functions until the next deploy. Until then, old instances keep using the old values from their boot-time env.

### Step 6 — Audit log entry (for sensitive rotations)

Log the rotation into `v2_integrity_events` manually via Supabase SQL Editor:

```sql
insert into v2_integrity_events (
  agent_id, event_type, old_value, new_value, reason, actor, context
) values (
  null,
  'secret_rotation',
  'redacted',
  'redacted',
  'Rotated ALPACA_API_KEY_ID on 2026-XX-XX',
  'manual:antwann',
  jsonb_build_object('variable', 'ALPACA_API_KEY_ID', 'method', 'regenerate')
);
```

## Verify-all command

Run this anytime to print the length of every Alpaca + CRON + Supabase secret in prod:

```bash
cd "/Users/antwannmitchellsr/The Council Intelligence Exchange/The Council Intelligence Exchange v2"
vercel env pull .env.check --environment=production
awk -F= '/^(ALPACA_|CRON_|SUPABASE_|NEXT_PUBLIC_SUPABASE_)/ {gsub(/"/,"",$2); print $1 " len=" length($2)}' .env.check
rm .env.check
```

Sanity-check against the inventory table.

## 🔴 Compromised-secret response (emergency)

If a secret leaks (published to a public repo, screenshot shared, pasted into wrong field, etc.):

1. **Treat as live leak even for paper.** Future you will thank you for the discipline.
2. Regenerate at source IMMEDIATELY (Step 1 above) — old value invalidated within seconds.
3. If it was committed to git: rotate AND rewrite history with `git filter-repo` (out of scope for this doc; use the GitHub Secret Scanning alert link if GitHub flagged it).
4. Remove from Vercel (Step 2).
5. Add the new value (Step 3).
6. Redeploy (Step 5).
7. Log the rotation as a `secret_rotation` integrity event (Step 6) with `context.reason='compromise:<brief description>'`.

## Related docs

- `docs/ALPACA-REFERENCE.md` — Alpaca-specific setup + account-separation rule
- `docs/SUPABASE-REFERENCE.md` — Supabase JWT rotation
- `docs/VERCEL-PROJECT-REFERENCE.md` — full env var registry
- `docs/NEXT-SESSION-HANDOFF.md` §3 — outstanding Supabase JWT rotation
