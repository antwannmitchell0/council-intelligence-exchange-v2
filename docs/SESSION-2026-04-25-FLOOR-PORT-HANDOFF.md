# Session Handoff — 2026-04-25 — /floor v1 port broke prod

**Owner:** Antwann Mitchell (antwannmitchell0@gmail.com)
**Branch state at handoff:** `feat/revenue-v1` tip is broken; v1 port code is parked on `wip/floor-v1-port`
**Operator's words:** *"lets do a handoff we overly loaded here"* — stop active work, document, resume next session.

---

## TL;DR

1. We tried to wholesale-port the v1 council-exchange `/floor` scene into v2.
2. The build compiles and the server returns HTTP 200, but the **page errors client-side** during hydration. Operator reported "page still didn't load" after the first suspected fix (removing `<Environment preset="night" />`).
3. Two commits on `feat/revenue-v1` are responsible: `0bfa9d3` (the port) and `c4a5bd8` (the failed Environment-removal fix).
4. The last known-good `/floor` is commit **`4ec573d`** — gold humanoid scene with backdrop wall + walking/talking FSM. Operator confirmed via screenshot it was rendering correctly before the v1 port.
5. The v1 port code is **safely parked on `wip/floor-v1-port`** (also pushed to origin) so we can resume debugging without fear of losing it.
6. **Production rollback was not completed** in-session — `vercel rollback` failed with "Deployment belongs to a different team" (CLI bug or perms drift). Path forward: redeploy from `4ec573d` floor files, or merge a revert commit on `feat/revenue-v1` and `vercel deploy --prod`.

---

## 1. What was attempted

**Goal:** mirror v1 (council-exchange.vercel.app/floor — operator owns it) wholesale into v2 instead of reverse-engineering. Source repo on local disk: `/Users/antwannmitchellsr/The Council Intelligence Exchange/council-exchange/`.

**Files ported / rewritten on `feat/revenue-v1`:**

| Path | What it does |
|---|---|
| `app/floor/page.tsx` | Server shell — calls `getPublicAgentRoster()` + `dayOfWindow()` and passes a `CouncilAgent[]` shaped to v1 |
| `app/floor/floor-client.tsx` | Page chrome — Zap-icon header, gradient title, LIVE pill, info/maximize toggles, help bar, Canvas + Suspense, AgentDetailPanel overlay top-left, NetworkStats sidebar 280px right |
| `components/floor/trading-floor-3d.tsx` | Scene — FloorGrid, BackWall with massive gold "THE COUNCIL" + "INTELLIGENCE EXCHANGE", Walls, CeilingLights, WorkStations (with lane labels), DataParticles, DataStreams, Stars, ActiveBeams. Originally had `<Environment preset="night" />` but `c4a5bd8` removed it. |
| `components/floor/agent-figure.tsx` | Humanoid character — capsule limbs, sphere head, eyes, billboard nameplate, 4-state FSM (DESK / MOVING / TALKING / RETURNING), per-agent personality table (P/U/E for PRIME/PULSE/ECHO codenames). |
| `components/floor/agent-detail-panel.tsx` | Click-to-inspect panel — real lifetime signals + orders submitted/filled, "—" placeholder for win-rate with "Day N/90" subscript, single $49/mo /pricing CTA. |
| `components/floor/floor-sidebar.tsx` | NetworkStats — Total Agents = 11, sum of real lifetime signals, "—" for Avg Win Rate. |
| `components/floor/connection-beams.tsx` | Traveling-particle beams between proximity-detected pairs. |
| `lib/floor/agents-data.ts` | `buildCouncilAgents(roster)` adapter — `PublicAgentEntry[] → CouncilAgent[]`. Includes DESK_POSITIONS (Row 1: APEX BOLT NOVA FLUX PULSE CIPHER · Row 2: PRIME ECHO HERALD SAGE WAVE), CODE_LETTERS, SCHEDULE, DATA_SOURCE, `deriveStatus()`. |

**Two commits on `feat/revenue-v1` are the broken ones:**

```
c4a5bd8 fix(floor): drop Environment HDR preset (third-party CDN fetch)
0bfa9d3 feat(floor): port v1 council-exchange floor wholesale + wire v2 real data
```

The previous good commit (target for rollback): **`4ec573d`** — `feat(floor): humanoid agents + walk/talk FSM + gold backdrop wall + real data`.

---

## 2. What works vs what doesn't

| Symptom | Status |
|---|---|
| `vercel build` succeeds | ✅ |
| `GET /api/health` returns 200 (Supabase + Alpaca + SEC all green) | ✅ |
| `GET /floor` server-renders HTTP 200 | ✅ |
| Page renders in browser | ❌ **Errors during/after hydration. Page does not load.** |
| Sentry catches the error | ✅ (assumed — Sentry is wired at `instrumentation-client.ts`; check the dashboard) |

The first hypothesis — `<Environment preset="night" />` from drei fetching an HDR file from a third-party CDN at runtime — was patched in `c4a5bd8`. **Operator reported the page still didn't load after that deploy.** So the actual cause is something else.

---

## 3. Suspected causes (next-session debug shortlist)

In rough probability order based on what changed:

1. **`posRef.current.set(...)` on a null Map** — the v1 scene uses a shared ref'd Map for agent positions used by `<ActiveBeams>` to draw connections. If the Map isn't initialized before children mount, `.set()` crashes.
2. **`<Stars />` from drei** — known to throw in some Three.js versions if mounted outside `<Suspense>` or if WebGL context isn't ready.
3. **`useFrame` invoked outside `<Canvas>` context** — if any component (e.g. `AgentFigure` mounted in a sidebar preview) accidentally calls `useFrame` while rendered outside the Canvas tree.
4. **Dynamic import resolving the wrong export shape** — `floor-client.tsx` does a `dynamic(() => import(...).then((m) => ({ default: m.TradingFloor3D })), { ssr: false })`. If we accidentally exported the component as default instead of named (or vice-versa) the resolved module will be `undefined`.
5. **Codename-letter map missing a code** — the personality table P only had keys for the original 11 codenames; if `agent_id` resolves to a nickname not in CODE_LETTERS, the figure throws on `code.toUpperCase()`.

**How to confirm next session:**
- Open https://demm.sentry.io/issues — click into the most recent /floor issue, copy the stack trace into the next session's first message.
- OR open production /floor in incognito Chrome, open DevTools console, paste any red error into the next session.

---

## 4. Rollback — what's left to do

Production was **not** rolled back successfully in-session. The /floor scene currently deployed is the broken v1 port.

### Option A — `vercel deploy --prod` from a revert commit (recommended)

```bash
# from any clean worktree on feat/revenue-v1
git checkout feat/revenue-v1
git pull origin feat/revenue-v1

# Revert the two broken commits as a single new commit (DO NOT --no-commit; let it land)
git revert c4a5bd8 0bfa9d3 -m 1   # if either is a merge — they aren't, but be safe
# (They're regular commits, so plain revert works:)
git revert c4a5bd8
git revert 0bfa9d3
git push origin feat/revenue-v1

# Re-deploy
vercel deploy --prod --yes
```

If `git revert 0bfa9d3` produces a conflict (it did last session — the file was already partially reverted by the `c4a5bd8` revert), use `git checkout 4ec573d -- app/floor components/floor lib/floor lib/public` to surgically restore the floor files instead. Then commit + push + deploy.

### Option B — `vercel rollback` (failed last session, but worth retrying)

```bash
vercel ls --prod  # find the deploy hash from before 0bfa9d3
vercel rollback <deploy-url>
```

Last attempt errored with `Error: Deployment belongs to a different team` even though the project is in the right team. This may be a transient CLI bug — worth one retry next session.

### Option C — Merge the parking branch's revert (cleanest)

The v1 port code lives on `wip/floor-v1-port`. To restore prod cleanly, branch off main and pull only the **non-floor** changes from `feat/revenue-v1`:

```bash
git checkout main
git checkout -b fix/floor-rollback
git checkout feat/revenue-v1 -- '*.ts' '*.tsx' ':!app/floor/*' ':!components/floor/*' ':!lib/floor/*'
# review, commit, push, PR, merge, deploy
```

This is the cleanest because it preserves all the revenue/Sentry/admin work on `feat/revenue-v1` while excising the broken floor port.

---

## 5. Where the v1 port code lives

- **Branch:** `wip/floor-v1-port` (local + origin)
- **Tip commit:** `c4a5bd8`
- **Files:** see the table in §1 above
- **Original v1 source on disk:** `/Users/antwannmitchellsr/The Council Intelligence Exchange/council-exchange/`
- **DO NOT delete this branch.** Resuming the port = `git checkout wip/floor-v1-port` and debug from there.

---

## 6. Pending operator pastes for revenue ship (from `feat/revenue-v1`)

The revenue MVP (Stripe Payment Link + daily-digest cron + subscriber table) is committed on `feat/revenue-v1` but cannot go live until the operator pastes 5 secrets/values:

| # | Item | Where to paste |
|---|---|---|
| 1 | **Migration 0016** (`supabase/migrations/0016_v2_subscribers.sql`) | Supabase SQL Editor |
| 2 | **`STRIPE_PAYMENT_LINK_URL`** ($49/mo) | `vercel env add STRIPE_PAYMENT_LINK_URL production` |
| 3 | **`STRIPE_SECRET_KEY`** | `vercel env add STRIPE_SECRET_KEY production` |
| 4 | **`STRIPE_WEBHOOK_SECRET`** | `vercel env add STRIPE_WEBHOOK_SECRET production` |
| 5 | **`RESEND_API_KEY`** | `vercel env add RESEND_API_KEY production` |

After all 5 are pasted, redeploy and the digest cron + Payment Link flow will be live. **None of these block the floor rollback** — they're independent.

---

## 7. Branch map at handoff

```
main                     5a0f7a4  PR #15 merged (admin + 13F diff + Discord alerts)
feat/revenue-v1          c4a5bd8  *** BROKEN /floor on tip *** — also has revenue MVP commits
wip/floor-v1-port        c4a5bd8  parking branch for the v1 port — same tip as feat/revenue-v1
feat/sentry              ...      Sentry instrumentation (PR #16 not merged)
docs/handoff-phase-abc   ...      docs branch — main repo currently checked out here
```

Production deploy at handoff: **broken v1 port** at `council-intelligence-exchange-v2-XXX-antwanns-projects.vercel.app` (look up via `vercel ls --prod`).

---

## 8. Suggested next-session order

1. **Open Sentry** at https://demm.sentry.io/issues — copy the actual stack trace for the /floor error. This is the single highest-value action; it tells us which of the §3 hypotheses is correct.
2. **Roll prod back** using Option A or C from §4. Get the gold-humanoid `/floor` back online before doing anything else.
3. **Resume the v1 port on `wip/floor-v1-port`** with the Sentry stack trace in hand. Likely a one-line fix once the cause is named.
4. **Land the revenue 5 pastes** (§6) in parallel — they're independent of /floor.
5. **Cherry-pick the working `wip/floor-v1-port` fix back onto `feat/revenue-v1`** and re-deploy.

---

## 9. Integrity reminders (operator's stance — do not violate)

- **No fake numbers.** Avg win rate stays "—" until 90-day broker-paper window earns it (Day 0 = 2026-04-24, so earliest is Day 90 = 2026-07-23).
- **No fake signals.** The detail panel's "Latest signal" pulls from real `v2_signals.body` via `summarizeSignalBody()`. Empty agents show "No signals yet."
- **No supplemental fields invented.** If a field can't come from a real bot, it doesn't exist.

---

*End of handoff. Resume next session with the Sentry stack trace.*
