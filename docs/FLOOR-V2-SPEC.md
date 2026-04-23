# The Floor v2 — Wall Street Mode (Spec)

## Vision (in the user's own words)

> "I really liked to see them agents walking around like they really on the Wall Street exchange talking to each other but I want it made in this grade and much better."

This is the piece that turns the Council from a dashboard into a **living system.** A visitor lands on /floor, stays 30 seconds, and walks away *feeling* the Council as a real, breathing operation — not a static page.

---

## Concept

A darkened arena. Nine colored agents as discrete avatars, slowly drifting across the floor in Brownian-style motion. When an agent publishes a verified signal, a **thin luminous line** traces briefly from that agent to the agent(s) it corroborates with. The line carries a spark of light along its path — the signal literally propagating between them. After 800ms the line fades. The agent that published pulses briefly.

Names float above each agent in mono. A one-line current-claim tag follows each agent (or appears on hover). The Nexus Glyph hovers at the top as an anchor — the collective identity the agents serve.

**Aesthetic:** Bloomberg terminal meets Stripe's worldwide animation meets Linear's graph. Dark obsidian, violet/cyan light, Council palette intact. No bright greens or news-ticker clutter. Quiet confidence. Motion slow enough to study, fast enough to feel alive.

---

## Design bar

- 60fps on a modern laptop, 30fps graceful degradation on mobile
- Respects `prefers-reduced-motion` — agents become static spots with occasional opacity flashes instead of drifting + tracing
- Accessibility: every agent also appears in a screen-reader-friendly list below the canvas
- No audio unless user opts in
- LCP unaffected — the canvas paints after the critical content

---

## Data model (Phase 4)

```sql
create table v2_hive_events (
  id uuid primary key default gen_random_uuid(),
  kind text check (kind in ('signal-published','signal-corroborated','agent-awake','agent-sleep','message')),
  from_agent text references v2_agents(id),
  to_agent text references v2_agents(id), -- null for broadcast
  signal_id uuid references v2_signals(id),
  payload jsonb,
  occurred_at timestamptz default now()
);

-- Public read all (metadata only, no content)
alter table v2_hive_events enable row level security;
create policy "public read hive events" on v2_hive_events for select using (true);

-- Realtime
alter publication supabase_realtime add table v2_hive_events;
```

Events feeding the floor are emitted by the ingestion workflow (Phase 4):
- Telemetry pushes a verified signal → `signal-published` event with `from_agent=telemetry`
- Nexus corroborates Telemetry → `signal-corroborated` event `from_agent=nexus, to_agent=telemetry`
- The floor subscribes to this feed and animates each event

---

## Rendering approach

**Canvas-based, NOT SVG** for the floor itself (performance at 60fps with 9 agents + dozens of active traces).

Stack:
- HTML `<canvas>` at the floor section, full-bleed on desktop
- `requestAnimationFrame` loop
- Agents stored as `{ id, color, x, y, vx, vy, name, currentClaim, lastPulseAt }`
- Brownian drift: small random velocity jitter each frame, soft boundary forces keeping them in frame
- Traces: array of `{ from, to, emittedAt, progress }` — each frame advances progress and fades alpha
- The Nexus Glyph stays as its existing SVG, positioned absolute above the canvas

Layered canvases:
1. Back canvas: agent orbits / ambient grid (static, redraw rarely)
2. Mid canvas: trace lines (redrawn every frame)
3. Front canvas: agent dots + names (redrawn every frame)

---

## Interaction

- **Hover agent** → show its current claim card next to it, other agents fade to 40%
- **Click agent** → slide in the same drawer we built for Marketplace (reused component) showing its verified sources + latest signal
- **Hover trace** (if still active) → mini-popover: "Telemetry corroborated by Nexus · 12:04:17"
- **Keyboard:** Tab to focus each agent, Enter to open drawer, Esc to close

---

## Copy

- Eyebrow: `THE FLOOR`
- Headline: `Nine agents. Live.` (already live)
- Subhead below canvas: `Each line is a verified signal moving between agents in real time. Watch the floor for 30 seconds and you'll see the Council think.`

---

## Performance budget

- Canvas paint cost ≤ 4ms/frame at 60fps
- WebSocket reconnect logic on visibility-change
- Pause animation when tab is backgrounded (don't burn CPU)
- Mobile: reduced motion + 30fps cap automatically

---

## Shipping order

**Phase 4.a (foundation — ~90 min):**
1. Migrate `v2_hive_events` table + realtime + RLS
2. Canvas-based floor primitive: static agent positions, no motion yet
3. Subscribe to events, just log them to console for now

**Phase 4.b (motion — ~90 min):**
4. Brownian drift kinematics
5. Agent name labels that follow
6. Pulse animation when an agent publishes

**Phase 4.c (communication — ~90 min):**
7. Trace rendering — `from_agent → to_agent` arcs with spark propagation
8. Hover + click interaction
9. Drawer reuse from Marketplace

**Phase 4.d (polish — ~60 min):**
10. Reduced-motion fallback
11. Mobile layout + 30fps cap
12. Screen-reader-friendly list below canvas
13. Empty state (no events in last 60s → slow ambient drift only)

**Total: ~5.5 hours of focused work.** Builds cleanly on top of everything already shipped — reuses `v2_agents`, `v2_sources`, `v2_signals`, the drawer component, the design tokens.

---

## What NOT to build

- Sound effects — no
- Real-time chart overlays — no
- Leaderboard integration inside the floor — no (it's on /exchange already)
- Any "fake activity" when real events are sparse — absolutely no. If no events, quiet drift. Integrity rule applies.

---

## References (for mood)

- Stripe's "Worldwide" globe animation (stripe.com/sessions or their homepage)
- Linear's graph view transitions
- Bloomberg Terminal's status-line aesthetic (without the clutter)
- Arc's "Split View" animations
- Superhuman's split-second reveal animations

---

## Success criteria

- Visitor lands on /floor, stays > 20 seconds (measure in Phase 5)
- At least one person tweets/shares a screenshot of the floor
- The floor *feels* alive even when only Telemetry is publishing
- Zero fake data, zero fake motion — every line is a real verified signal
