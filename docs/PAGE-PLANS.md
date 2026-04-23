# Per-Page Game Plan

Every route gets a specific target, design spec, data model, code spec, and success bar. This doc is the contract — ship meets spec, or we iterate.

**Global rules that apply to every page:**
- Council design language (palette, motion, typography, verified-only rule)
- `<Nav />` at top, `<Footer />` at bottom, both already wired in layout
- Server Component by default; only add `'use client'` where interactivity demands it
- Every field passes through `renderIfVerified()` — never a hardcoded number
- Each page has unique `metadata` (title + description)
- Lighthouse (mobile): LCP < 1.8s, CLS < 0.05, a11y ≥ 95, best-practices ≥ 95
- `prefers-reduced-motion` respected; `:focus-visible` consistent across CTAs

Phases below reference the master plan: Phase 0–2 (scaffold, design, static sections) = **shipped**. Phase 3 = live data islands. Phase 4 = ingestion workflows. Phase 5 = polish.

---

## `/` — Landing

**Purpose:** Convert a first-time visitor into "I understand what this is and I want to see more." Seven scrollable sections already composed.

**Target outcome:** Visitor hits the hero within 2s, reads `Verified intelligence, hourly.`, clicks one of three CTAs (`Browse the Marketplace`, `View the Leaderboard`, `⚡ Enter the Floor`).

**Design spec (shipped):**
1. Hero with Nexus Glyph + 3 stat counters (blank until live)
2. Problem: 0% → "Until now."
3. How It Works (3 cards)
4. Signal Sources (9-agent grid, blank statuses)
5. Leaderboard (blank values)
6. Live Feed (idle state)
7. Minimal cryptic footer (now replaced by expanded footer)

**Data model (Phase 3):** Hero stats pull from `SELECT count(*) FROM agents WHERE status='online'`, `SELECT count(*) FROM signals WHERE created_at >= current_date`, `SELECT avg(verified::int) FROM signals WHERE created_at >= now() - interval '24h'`.

**Code spec:**
- `app/page.tsx` — composes 7 sections
- All sections server components
- `Leaderboard` and `LiveFeed` will become client islands in Phase 3 with `'use client'`
- Cache: `cacheTag('leaderboard')` + `cacheTag('feed')` on the data-fetching wrappers

**Success:**
- [ ] LCP < 1.5s on cold load (hero is mostly text + one SVG)
- [ ] No layout shift on the stat counters when they populate (reserve space via min-width on mono digits)
- [ ] Three CTAs all route correctly

**Phase:** 1–2 shipped. Phase 3 wires live stats.

---

## `/exchange` — The Leaderboard

**Purpose:** The public scoreboard of the 9 agents. When a client asks "which agent is actually performing?" this is the answer.

**Target outcome:** Visitor scans the table in under 10s and knows who's leading, by how much, and the trend direction.

**Design spec (shipped + Phase 3 targets):**
- PageHero: *"The leaderboard. Ranked by truth."*
- Sortable table columns: `#`, `Agent`, `Signals 24h`, `Verified %`, `Trend`
- Row hover: `obsidian` background, 120ms ease
- Top-3 ranks colored in violet; rest in `ink-muted`
- **Phase 3 add:** 40×16 SVG sparkline per row, stroke 1.5px, color by trend direction (cyan up, danger down, ink-muted flat)
- **Phase 3 add:** delta-flash animation — when a value updates, pulse the cell cyan for 200ms, then fade to ink over 800ms

**Data model:**
```sql
create table leaderboard_snapshots (
  agent_id text references agents(id),
  captured_at timestamptz default now(),
  rank smallint,
  signals_24h int,
  verified_pct numeric(5,2),
  trend_7d numeric(5,2)[],
  status verification_status default 'verified'
);
```
Realtime: Supabase `postgres_changes` on `leaderboard_snapshots`.

**Code spec:**
- `app/exchange/page.tsx` — server component, `PageHero` + `<Leaderboard />`
- Promote `Leaderboard` to a client island when live data lands: `components/live/leaderboard.tsx`
- `useEffect` subscribes to `supabase.channel('leaderboard').on('postgres_changes', ...)`
- Cache: `cacheTag('leaderboard')`; workflow calls `updateTag('leaderboard')` after each write

**Success:**
- [ ] Row updates land in < 1s from Supabase insert
- [ ] Delta flash doesn't cause CLS
- [ ] Table is keyboard-sortable (Phase 5)
- [ ] AAA contrast on every number

**Phase:** 2 shipped (blank). Phase 3 wires realtime + sparklines.

---

## `/marketplace` — Licensed Signals

**Purpose:** Show sophisticated buyers that Council signals are a purchasable product. Until the product exists, this page demonstrates restraint via the integrity rule.

**Target outcome:** Visitor sees the ComingSoon treatment, respects the blanks, leaves thinking "serious operation."

**Design spec (shipped):** PageHero + ComingSoon card with 5 fields blank.

**Phase 2+ design spec (when product launches):**
- Channel cards grid — each signal channel as a card with: name, cadence, sample signal redacted-but-formatted, price
- Tiers: Per-channel, Bundle, Enterprise API
- Access flow: `Request access →` opens a drawer with form → routes to `/api/marketplace/request`

**Data model (Phase 2+):**
```sql
create table marketplace_channels (
  id text primary key,
  name text,
  cadence text,
  sample_signal_hash text,
  price_monthly numeric(10,2),
  status verification_status
);
```

**Code spec:**
- `app/marketplace/page.tsx` — currently uses `<ComingSoon />`
- Phase 2+: swap ComingSoon for `<ChannelGrid />`, `<TierTable />`, `<AccessRequestDialog />`
- Dialog: shadcn primitive restyled with Council tokens

**Success:**
- [ ] Current: page renders blank fields clearly, hero is crisp
- [ ] Launch: Request-access flow converts, no broken forms

**Phase:** ComingSoon shipped. Marketplace product is a separate post-v2 initiative.

---

## `/agents` — The Agent Roster

**Purpose:** Give each of the 9 agents a face so clients remember specific agents by name ("the Telemetry agent is the one that…"). Also: recruit future agents.

**Target outcome:** Visitor scans 9 cards, clicks one to learn more (Phase 3: agent detail pages), or submits a candidate via the register CTA.

**Design spec (shipped):**
- PageHero: *"Nine agents. One standard."*
- 3-column card grid (9 cards)
- Each card: color dot (with glow), agent name, one-sentence brief, `Signals 24h` blank row
- Register-candidate CTA card below the grid

**Phase 3+ design spec:**
- Cards become clickable → `/agents/[id]` detail pages
- Detail page: agent bio, signature signals, recent output log, grading history, specialty tags

**Data model (Phase 3):**
```sql
create table agents (
  id text primary key,      -- matches design/tokens.ts agent ids
  name text not null,
  hex text not null,
  brief text,
  bio_md text,              -- long-form markdown bio
  specialty text[],
  joined_at timestamptz,
  status verification_status
);
```

**Code spec:**
- `app/agents/page.tsx` — server component, iterates `council.agent` from tokens
- Phase 3: replace the static token list with `const agents = await supabase.from('agents').select(...)`; wrap with `cacheTag('agents')`
- Phase 3: add `app/agents/[id]/page.tsx` — dynamic route, `generateStaticParams`, `use cache`

**Success:**
- [ ] Each color dot reads as distinct (contrast check vs `obsidian` bg)
- [ ] Card hover state feels snappy (240ms)
- [ ] Register CTA routes to mailto or form (mailto currently — Phase 4: proper form)

**Phase:** 2 shipped (static). Phase 3 pulls real bios from Supabase + adds detail pages.

---

## `/hive` — Operational Substrate

**Purpose:** Signal that the Council has real operational telemetry behind it. When it opens, it's the most "backstage" of the public views — controlled glimpse, not a dashboard dump.

**Target outcome:** Visitor treats this as the proof-of-infrastructure page. Currently ComingSoon. When it ships: visitor sees real inter-agent message volume, confidence resolution events, hive integrity score.

**Design spec (shipped):** ComingSoon with 5 blank fields.

**Phase 3+ design spec (when opened):**
- Hero: minimal, NexusGlyph secondary visual
- Live gauge: Hive integrity score (0.00–1.00) — updated live
- Agent-to-agent message heatmap (9×9 grid, low-intensity by default, cell brightens on message)
- Timeline of the last 20 conflict-resolution events
- Never shows specific signal contents — only metadata

**Data model (Phase 3+):**
```sql
create table hive_events (
  id uuid primary key,
  kind text,                -- 'message' | 'conflict' | 'resolution' | 'heartbeat'
  from_agent text,
  to_agent text,
  at timestamptz default now(),
  metadata jsonb,
  status verification_status
);
```

**Code spec:**
- `app/hive/page.tsx` — currently `<ComingSoon />`
- Phase 3+: `components/live/hive-heatmap.tsx` (client island), `components/live/hive-integrity-gauge.tsx`
- Realtime: subscribe to `hive_events` inserts; shape into heatmap + gauge

**Success:**
- [ ] Current: blank fields feel intentional, not broken
- [ ] Launch: zero PII or signal-content leakage in the heatmap

**Phase:** ComingSoon shipped. Post-v2 cycle.

---

## `/intelligence` — Methodology & Grading

**Purpose:** Win the trust argument. Anyone who wants to challenge "verified" has to read this page; it converts skeptics into believers or at least respectful critics.

**Target outcome:** Technical-leaning visitor reads the 4 principles + grading formula and can explain the Council's method to a colleague in 30s.

**Design spec (shipped):**
- PageHero: *"The methodology. Audit it, don't trust it."*
- 4 principle cards in a 2-column grid: Ingest / Verify / Score / Publish
- Grading algorithm: left side copy, right side formula card with mono breakdown

**Phase 3+ design spec:**
- Add a "Live integrity incidents" section — transparent log of rejected signals (with source + reason)
- Add a downloadable methodology PDF (cached, versioned)

**Data model (Phase 3+):**
```sql
create table integrity_incidents (
  id uuid primary key,
  occurred_at timestamptz default now(),
  signal_source text,
  rejection_reason text,
  auto_detected bool default true,
  status verification_status
);
```

**Code spec:**
- `app/intelligence/page.tsx` — server component, static content
- Phase 3+: `<IntegrityIncidentsLog />` client island — reads from `integrity_incidents` view
- Phase 4+: versioned methodology doc under `/intelligence/v/[version]`

**Success:**
- [ ] Hero line + 4 principles load instantly (no images)
- [ ] Formula card uses `council-verified` dot treatment on the final grade output
- [ ] Copy passes `marketing:brand-review` for Council voice

**Phase:** 2 shipped. Phase 3+ adds incidents log.

---

## `/trading` — Track Record

**Purpose:** Radical honesty about directional outcomes. Wins, losses, misses — all public. This page either builds the most trust or exposes that the system isn't ready yet.

**Target outcome:** Visitor sees a full audit — hit-rate, lead time, biggest hits, biggest misses — and walks away knowing the Council ships receipts.

**Design spec (shipped):** ComingSoon with 5 blank fields.

**Phase 3+ design spec (when opened):**
- Hero: large mono hit-rate number + lead-time median
- Timeline of directional signals, each with: signal text, called-at, outcome-at, delta
- Filter: by agent, by signal class, by time range
- Graph: cumulative verified-impact over time (simple line chart)
- Every row clickable → modal with provenance trail

**Data model (Phase 3+):**
```sql
create table directional_signals (
  id uuid primary key,
  agent_id text,
  claim text,
  direction text,           -- 'bull' | 'bear' | 'neutral'
  called_at timestamptz,
  resolved_at timestamptz,
  outcome text,             -- 'hit' | 'miss' | 'partial' | 'pending'
  impact_score numeric,
  status verification_status
);
```

**Code spec:**
- `app/trading/page.tsx` — currently `<ComingSoon />`
- Phase 3+: `<TrackRecordTable />`, `<CumulativeImpactChart />`, `<SignalProvenanceModal />`
- Cache: aggressive — `cacheTag('track-record')`; workflow invalidates on outcome resolution only

**Success:**
- [ ] Current: blanks read as "not ready yet," not "we're hiding"
- [ ] Launch: filter UI keyboard-nav-complete, provenance modal loads under 300ms
- [ ] Hit-rate updated in real-time when a directional signal resolves

**Phase:** ComingSoon shipped. Post-v2 high-priority (this is the moat).

---

## `/floor` — The Live Agent Floor

**Purpose:** The theater piece. A visiting client sees the 9-agent operation as a single dynamic, live-rendered view and *feels* the Council.

**Target outcome:** Visitor stares at the Floor for 15–30s, sees at least one agent node pulse (signifying live activity), leaves with the impression of a living system.

**Design spec (shipped + Phase 3 targets):**
- Massive NexusGlyph (320px+ in hero)
- Per-agent status rows below (9 rows, each showing: color dot, name, "status" label, blank value)
- **Phase 3 add:** status value becomes real — `online` / `idle` / `offline` / `degraded`, color-coded
- **Phase 3 add:** when an agent pushes a verified signal, its glyph node brightens for 800ms (cyan ripple out from that node's position)
- **Phase 3 add:** "Now active" ticker at top right — shows the most-recent agent to publish
- **Phase 4 add:** click an agent node → drawer opens with that agent's last 10 verified signals

**Data model (Phase 3):**
```sql
create table agent_heartbeats (
  agent_id text references agents(id),
  last_seen timestamptz,
  status text,              -- 'online' | 'idle' | 'offline' | 'degraded'
  last_signal_id uuid references signals(id)
);
```

**Code spec:**
- `app/floor/page.tsx` — hero is server component; telemetry rows become a client island `<FloorTelemetry />` subscribed to `agent_heartbeats`
- NexusGlyph: extend component to accept an `activityMap` prop — `{ [agentId]: 'pulse' | 'idle' }` — and brighten matching nodes
- Realtime: two channels — `agent_heartbeats` (status) + `signals` filtered to latest per agent (activity pulse)
- Cache: none on this page — it's fully dynamic

**Success:**
- [ ] First paint in < 1.5s even with websocket pending
- [ ] Pulse animation never causes CLS
- [ ] Reduced-motion: pulses become opacity-only flashes, no translation
- [ ] At least 5% visitors scroll to telemetry rows (measure w/ analytics in Phase 5)

**Phase:** 2 shipped (static). Phase 3 wires live status + pulse. Phase 4 adds agent drawer.

---

## Global Phase Checklist

- [x] **Phase 1–2:** Nav, footer, 7 routes, Council design tokens, Nexus Glyph
- [ ] **Phase 3:** Supabase schema ✅ above; client islands for Leaderboard, LiveFeed, Floor; Hero stat counters live
- [ ] **Phase 4:** Ingestion workflow per agent (Vercel Workflow), BotID on `/api/ingest`, agent detail pages, register-candidate form
- [ ] **Phase 5:** Lighthouse mobile ≥ 95, AAA contrast audit, reduced-motion audit, prod deploy + custom domain

## Open decisions requiring input

1. **Which agent ships live first in Phase 3?** Pick one to validate the ingestion → verify → publish loop before wiring all nine. Recommendation: `telemetry` (cyan) — it has the simplest verification surface.
2. **Supabase project:** confirm reuse of the existing v1 project with a `v2_*` schema prefix, OR provision a dedicated v2 Supabase.
3. **Track-record depth for launch:** how far back do we backfill `directional_signals`? (Tradeoff: backfill depth vs. credibility risk if early calls look bad.)

These three decisions gate Phase 3 kickoff.
