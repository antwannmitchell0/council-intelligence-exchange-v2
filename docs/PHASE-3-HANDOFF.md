# Phase 3 Handoff — Turning Live

The code is shipped. Three things need to happen on your side before the site goes from "blank" to "live":

1. **Add Supabase env vars to Vercel** (3 keys)
2. **Run the SQL migration + seed** (two files, paste into Supabase SQL editor)
3. **Redeploy** (automatic after env changes, or one git push)

Once those three are done, the Telemetry agent goes live:
- Hero stats show real numbers (1 agent online, 0 signals today, 100% verified)
- Leaderboard shows Telemetry at rank #01
- Floor page shows Telemetry as `online` (green)
- Live Feed stays idle until a signal inserts — then it streams in realtime

---

## Step 1 — Add Supabase env to Vercel

From your existing Supabase project settings (Project → Settings → API), grab:
- Project URL (e.g. `https://xyz.supabase.co`)
- `anon` public key
- `service_role` secret key

Set them in the Vercel project. Fastest via CLI (run from the project root):

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# paste URL when prompted, then repeat for preview + development if you want

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# paste anon key

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# paste service role key — this one is server-only, never exposed to the browser
```

Or via the Vercel dashboard → Project → Settings → Environment Variables.

**Also mirror locally** so `pnpm dev` works:
```bash
vercel env pull .env.local
```

---

## Step 2 — Run the SQL

In your Supabase project → SQL Editor, run these two files **in order**:

1. `supabase/migrations/0001_init.sql` — creates the 5 v2 tables, enums, RLS policies, realtime publication, and the `v2_hero_stats()` RPC. Safe to re-run (idempotent).
2. `supabase/seed/0001_telemetry.sql` — seeds the 9-agent roster. Only Telemetry is `verified` + `online`; the other 8 are `pending` + `offline` until their pipelines ship. Also seeds one leaderboard snapshot for Telemetry.

After the migration, verify the realtime publication includes the three live tables:

```sql
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename like 'v2_%';
-- should return 3 rows: v2_signals, v2_leaderboard_snapshots, v2_agent_heartbeats
```

---

## Step 3 — Redeploy

Env changes trigger an automatic Vercel rebuild. If it doesn't pick up:
```bash
git commit --allow-empty -m "chore: rebuild for env" && git push
```

Or from the Vercel dashboard → Deployments → latest → "Redeploy".

---

## Verify live

Once deployed:

1. Open the production URL — hero stats should show real numbers now (not blanks).
2. Open `/exchange` — Telemetry should appear at rank #01 with `0 signals 24h / 100% verified`.
3. Open `/floor` — Telemetry's row should show `online` in green.
4. Open `/` and scroll to Live Feed. To see it go live, insert a signal from the Supabase SQL editor:

```sql
insert into v2_signals (agent_id, body, confidence, status)
values ('telemetry', 'First verified signal — ingestion loop active.', 92.5, 'verified');
```

The signal should appear in the Live Feed on the landing page within ~1 second, no refresh.

Try a second one a few seconds later:
```sql
insert into v2_signals (agent_id, body, confidence, status)
values ('telemetry', 'Telemetry baseline established.', 88.0, 'verified');
```

If the feed updates live, **Phase 3 pipeline is proven**. From there, we wire the actual Telemetry ingestion (Phase 4) and add the other 8 agents one at a time.

---

## Troubleshooting

**Build succeeds but stats stay blank:**
- Check Vercel → Deployments → latest → Runtime Logs for Supabase errors.
- Verify env vars are set for the `production` environment (not just preview).
- Run `vercel env ls` to confirm.

**Realtime doesn't update:**
- Run the pub-check query above. If the tables aren't in `supabase_realtime`, re-run the migration's `alter publication` lines manually.
- Check browser console for websocket errors — Supabase's anon key must allow realtime.

**RLS blocks reads:**
- The migration grants public SELECT on verified rows and full read on `v2_leaderboard_snapshots` + `v2_agent_heartbeats`. If you get 0 rows back from the browser, check that your anon key matches the project and that RLS policies exist (Supabase → Auth → Policies).

---

## What comes next (Phase 4 preview)

- Vercel Workflow ingests Telemetry signals from their real source on a cadence, writes to `v2_signals`, triggers `v2_leaderboard_snapshots` recalc
- BotID middleware on `/api/ingest`
- Agent detail pages under `/agents/[id]`
- Eight more agents added one at a time, same ingestion pattern
