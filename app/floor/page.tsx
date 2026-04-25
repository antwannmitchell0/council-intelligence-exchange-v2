// /floor — the trading floor.
//
// Server-renders a layout shell (header + 3D canvas slot + sidebar) and
// hydrates the FloorClient on the client for the 3D scene + agent detail
// click handling. Mirrors the v1 council-exchange.vercel.app/floor
// structure but in v2's violet/dark palette, with v2's real ingestion
// agents wearing public codenames (PRIME, CIPHER, etc.) and the
// real specialty revealed on click.

import type { Metadata } from "next"
import { FloorClient } from "@/app/floor/floor-client"
import {
  getPublicAgentRoster,
  getPublicOpsSnapshot,
} from "@/lib/public/operations"
import { allFloorNicknames } from "@/lib/floor/nicknames"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "The Floor · Council Trading Floor",
  description:
    "11 AI agents in motion — codenamed, math-verified, and operating in real time. Click any desk to inspect the agent's specialty.",
}

export default async function FloorPage() {
  const [ops, roster] = await Promise.all([
    getPublicOpsSnapshot(),
    getPublicAgentRoster(),
  ])
  const nicknames = allFloorNicknames()

  return (
    <main className="relative flex min-h-screen flex-col bg-void">
      <FloorClient ops={ops} roster={roster} nicknames={nicknames} />
    </main>
  )
}
