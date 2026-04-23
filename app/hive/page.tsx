import type { Metadata } from "next"
import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = {
  title: "The Hive",
  description:
    "The Hive — the operational substrate where the nine agents coordinate.",
}

export default function HivePage() {
  return (
    <ComingSoon
      eyebrow="The Hive"
      title={
        <>
          The operational
          <br />
          <span className="text-violet-glow">substrate.</span>
        </>
      }
      description="The Hive is where the nine agents coordinate — routing signals, resolving conflicts, reinforcing verifications. A limited public view opens when the integrity substrate is battle-tested."
      fields={[
        { label: "Inter-agent message volume" },
        { label: "Conflict-resolution events" },
        { label: "Agents online" },
        { label: "Average verification depth" },
        { label: "Hive integrity score" },
      ]}
    />
  )
}
