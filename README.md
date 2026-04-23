# The Council Intelligence Exchange v2

Verified AI intelligence from nine autonomous agents. Signal, not noise. Verified, or blank.

**Production:** https://council-intelligence-exchange-v2.vercel.app

---

## Morning checklist

If you've just woken up and you're looking at this repo:

1. **Open Supabase → SQL Editor → paste [`supabase/morning.sql`](supabase/morning.sql) → Run.**
   One file. Applies everything built overnight. "Done — Floor v2 and early-access RPC are live." confirms it landed.

2. **Open https://council-intelligence-exchange-v2.vercel.app/floor** — watch the agents drift, hover one to see its current claim, click to open its detail drawer. This is the Wall Street mode you asked for.

3. **Open https://council-intelligence-exchange-v2.vercel.app/agents/telemetry** — per-agent detail page, wired to realtime signal streaming.

4. **Try the Marketplace form** — https://council-intelligence-exchange-v2.vercel.app/marketplace → scroll to "Request access" → submit. After `morning.sql` has run, it posts through the server-side API route, which calls the `v2_submit_early_access` RPC. Verify rows land with `select * from v2_early_access_requests order by created_at desc;`

---

## What shipped overnight

| Area | Details |
|---|---|
| **Floor v2** | Canvas-based 60fps animated agent floor: Brownian drift, pulse on signal publish, trace lines + spark propagation between agents on corroboration, hover-focus + click-into-drawer, reduced-motion fallback |
| **Agent detail pages** | `/agents/[id]` — 9 pre-rendered SSG pages, each with stats, verified sources, realtime per-agent signal feed, CTA into Marketplace |
| **Early-access API** | Server-side route `/api/marketplace/early-access` → calls `v2_submit_early_access` RPC (security-definer, bypasses the anon-insert RLS quirk cleanly) |
| **Copy polish** | Tighter voice on `/hive` and `/trading` ComingSoon descriptions |
| **One SQL bundle** | `supabase/morning.sql` — Floor v2 schema, 3 auto-emit triggers, RPC, cleanup of redundant policies, verification notice |

## Tech stack

- Next.js 16 App Router, React 19.2, TypeScript strict
- Tailwind v4, shadcn-structure + custom hero components
- Supabase (Postgres + Realtime + RLS)
- Vercel (Node.js runtime, Fluid Compute)
- Framer Motion, Canvas 2D for the Floor

## Key files

```
app/
  page.tsx                 # Landing (hero + 7 sections)
  floor/page.tsx           # The Floor — canvas-based live agent floor
  agents/page.tsx          # Roster grid (cards link to [id])
  agents/[id]/page.tsx     # Per-agent detail (9 pre-rendered SSG)
  exchange/page.tsx        # Leaderboard
  marketplace/page.tsx     # Agent product cards + drawer + early-access form
  intelligence/page.tsx    # Methodology + grading algorithm
  hive/page.tsx            # ComingSoon
  trading/page.tsx         # ComingSoon
  api/marketplace/early-access/route.ts  # POST → RPC

components/
  floor/floor-canvas.tsx        # Canvas-based floor (60fps, drift, traces)
  floor/floor-with-drawer.tsx   # Reuses Marketplace drawer
  marketplace/*                 # Cards, drawer, form, grid
  agents/agent-live-feed.tsx    # Per-agent realtime signal feed
  live/*                        # Leaderboard, LiveFeed, FloorTelemetry, HeroStats
  sections/*                    # Landing page composition

lib/
  supabase/server.ts        # Server-side client (falls back to anon)
  supabase/client.ts        # Browser client singleton
  supabase/types.ts         # Database type + row types
  render-if-verified.ts     # Single source of truth for the integrity rule
  cache/tags.ts
  nav.ts

design/
  tokens.ts                 # Palette, motion curves, 9 agent colors

supabase/
  morning.sql               # ← Everything overnight, one paste
  migrations/               # Numbered migrations (already applied)
  seed/                     # Seeds (already applied)

docs/
  PAGE-PLANS.md             # Per-page game plan
  PHASE-3-HANDOFF.md        # Phase 3 env setup
  FLOOR-V2-SPEC.md          # Floor v2 specification
```

## Integrity rule

> Every renderable field has a `status: 'verified' | 'pending' | 'unverified'`.
> Only `verified` renders the value; the other two render `—`.

Enforced by `lib/render-if-verified.ts`. No exceptions.

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL           # required
NEXT_PUBLIC_SUPABASE_ANON_KEY      # required
SUPABASE_SERVICE_ROLE_KEY          # optional; server falls back to anon
```

## Scripts

```bash
npm run dev    # local dev
npm run build  # production build
npm run start  # run production build locally
npm run lint
```
