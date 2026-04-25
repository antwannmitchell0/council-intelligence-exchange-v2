# Handoff — /floor 3D rework (in progress, paused mid-session 2026-04-25)

This is the resume-here doc for the next session that picks up the /floor 3D rebuild.

## What this is

Operator wants the v2 `/floor` 3D scene to match the v1 council-exchange.vercel.app/floor experience, specifically:

1. **Humanoid Roblox-style agent figures** (head, body, arms, legs, hair, eyes, skin tones) — replacing the current abstract pulsing primitive shapes
2. **Massive gold "THE COUNCIL · INTELLIGENCE EXCHANGE" backdrop wall** behind the agents
3. **Walking + talking animation** — agents walk to their desks on load, occasionally walk to a midpoint with another agent and talk
4. **Real per-agent data on click** — last signal body text, orders submitted/filled, lifetime signal count. No fake metrics.

The page chrome (header, sidebar, detail panel layout, nav button) is already correct in v2 — operator confirmed. **Don't touch those.**

## State at handoff

- ✅ **Plan written + approved** — full file at `/Users/antwannmitchellsr/.claude/plans/title-the-council-stays-cheeky-engelbart.md`
- ✅ **Audit complete** — every file path, line number, and reuse opportunity is documented in the plan
- 🟡 **One small change made + uncommitted** — `lib/public/types.ts` now has 3 new optional fields on `PublicAgentEntry` (`last_signal_body`, `orders_submitted_lifetime`, `orders_filled_lifetime`). They're optional so the existing fetcher still satisfies the type. **Promote to required once `getPublicAgentRoster()` is extended.**
- ❌ **Nothing else started** — no humanoid figure rebuild, no FSM port, no backdrop wall, no fetcher extension, no detail-panel update.

## Resume sequence

The plan file has the full detail. Quick map of execution order (from the plan):

1. **Real-data plumbing** (~30 min)
   - Extend `getPublicAgentRoster()` in `lib/public/operations.ts` lines 237–315 to fetch `last_signal_body` (extend the existing `lastSignalPromises` query to include `body`) + `orders_submitted_lifetime` + `orders_filled_lifetime` (new `orderCountPromises` querying `v2_trade_tickets` with `count: exact, head: true`)
   - Promote the 3 optional fields in `PublicAgentEntry` to required (drop the `?`)

2. **Detail panel update** (~15 min)
   - `components/floor/agent-detail-panel.tsx` — add a "Latest signal" block + Orders submitted/filled stat tile pair

3. **Humanoid figure rebuild** (~60–90 min)
   - **Rewrite** `components/floor/agent-figure.tsx`
   - Head sphere (skin-tone) · hair box · torso box (per-agent hex tint) · 2 arm boxes · 2 leg boxes · 2 eye spheres
   - Skin tones to vary across the 11 agents (5-tone palette in plan)
   - Hair colors from 3-color dark palette
   - Add new `state` prop driving walk/idle/talk poses

4. **Walking + talking FSM port** (~45 min)
   - **Copy from** `components/floor/floor-3d.tsx` lines 338–415 (state machine is already complete in that file but unused)
   - Adapt only the desk-position lookups (we use the horseshoe `desks` array in `trading-floor-3d.tsx` instead of grid positions)
   - Replace the static `SPEECH_POOL` (file lines 19–28) with the agent's real `last_signal_body` for the speech-bubble overlay

5. **Talking visual polish** (~45 min)
   - Reuse `ConnectionThread` component from `floor-3d.tsx` lines 244–277 (cyan line between paired agents)
   - `<Html>` speech bubble above one of the talking pair, recycles between both every 5s, shows truncated `last_signal_body`

6. **Backdrop wall** (~30 min)
   - Add `<Text>` (drei) in `components/floor/trading-floor-3d.tsx` at `[0, 4, -15]`, size 2.5, color `#c9a84c`, emissive `#c9a84c` at intensity 0.4
   - Optional dark plane mesh at `z = -15.1` for contrast

7. **Verification** (~30 min)
   - `npx tsc --noEmit` (must pass)
   - `vercel deploy --prod`
   - Visit `/floor`: agents are humanoid, backdrop is visible, walk-on animation runs, click-to-inspect shows real signal text

## Critical files to touch

| Path | Action |
|---|---|
| `lib/public/types.ts` | Promote optional fields to required (already scaffolded) |
| `lib/public/operations.ts` | Extend `getPublicAgentRoster()` lines 237–315 |
| `components/floor/agent-figure.tsx` | Full rewrite for humanoid |
| `components/floor/trading-floor-3d.tsx` | Add backdrop wall + walking/talking FSM |
| `components/floor/agent-detail-panel.tsx` | Display new fields |

## Files NOT to touch

| Path | Why |
|---|---|
| `components/floor/floor-header.tsx` | Title gradient already correct (audit confirmed) |
| `app/floor/floor-client.tsx` | Composition layer is fine |
| `app/floor/page.tsx` | Server-rendering shell stays |
| `components/floor/floor-sidebar.tsx` | Sidebar layout stays |
| `lib/floor/nicknames.ts` | Codenames + colors already match v1 |
| Top nav `Join Exchange` button | Stays violet (operator confirmed) |

## Reuse opportunities (don't reinvent)

- `summarizeSignal()` in `app/api/cron/daily-digest/route.ts` — already parses `v2_signals.body` into a human-readable snippet per agent type. Reuse for the detail panel + speech bubble. Don't duplicate the parser.
- `Avatar` component pattern in `components/floor/floor-3d.tsx` — has leg geometry + `useFrame`-driven walk cycle. Strong reference even though we're rewriting the figure.
- `<Text>` from `@react-three/drei` is already imported in `trading-floor-3d.tsx` for desk nameplates — reuse for the backdrop.

## Risks already documented in the plan

1. **Mobile 3D performance** — 11 humanoid agents × 6+ meshes each = 66+ extra meshes. May lag on weaker devices. Plan: shared geometry instances + simple materials.
2. **Pair-selection race** — two agents picking each other simultaneously. Plan: atomic partner reservation.
3. **Speech bubble z-fighting** — `<Html>` overlays clip on low-camera angles. Plan: `transform={false}` + absolute positioning.
4. **`v2_signals.body` is JSON in TEXT column** — needs the existing `summarizeSignal()` parser, not a new one.
5. **drei `<Text>` font** — defaults to a sans-serif that may not match v1 exactly. Acceptable for v1; tune later.

## What's NOT changing (scope guardrails)

- No win-rate %, no avg-return %, no version number on the detail panel — those gate on the 90-day verification math earning them. Operator's integrity-contract stance: never fake numbers.
- No page chrome / nav / sidebar / detail panel layout changes.
- Time budget for the full rebuild: ~4 hours of focused work. Single PR. Single deploy.
