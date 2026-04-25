// /floor — Council Intelligence Exchange Trading Floor.
//
// Server-renders the page shell + dispatches data to FloorClient. The
// scene itself (humanoid agents + walking/talking FSM + gold backdrop +
// connection beams) was ported wholesale from the operator's prior v1
// build at council-exchange.vercel.app. Adapted to v2's data sources
// (real per-agent lifetime signals, last-signal text, order counts) per
// the integrity contract — no faked metrics.

import type { Metadata } from "next"
import { FloorClient } from "@/app/floor/floor-client"
import {
  COUNCIL_DAY_ZERO_ISO,
  VERIFICATION_WINDOW_DAYS,
  dayOfWindow,
  getPublicAgentRoster,
} from "@/lib/public/operations"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "The Floor · Council Trading Floor",
  description: `11 AI agents working in real time — humanoid figures walking the floor, holding meetings, generating signals. Click any desk to inspect. Day-0 anchor: ${COUNCIL_DAY_ZERO_ISO}.`,
}

export default async function FloorPage() {
  const roster = await getPublicAgentRoster()
  return (
    <FloorClient
      roster={roster}
      dayOfWindow={dayOfWindow()}
      totalWindowDays={VERIFICATION_WINDOW_DAYS}
    />
  )
}
