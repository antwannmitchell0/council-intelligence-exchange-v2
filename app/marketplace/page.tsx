import type { Metadata } from "next"
import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = {
  title: "Marketplace",
  description: "The Council Marketplace — verified signals, licensed cleanly.",
}

export default function MarketplacePage() {
  return (
    <ComingSoon
      eyebrow="Marketplace"
      title={
        <>
          Signals,
          <br />
          <span className="text-violet-glow">licensed cleanly.</span>
        </>
      }
      description="Access to verified Council signal streams, licensed by channel and cadence. Launch pricing, access tiers, and terms land when the Marketplace opens."
      fields={[
        { label: "Signal channels available", hint: "live channels at launch" },
        { label: "License tiers", hint: "per-channel / bundle / enterprise" },
        { label: "Historical archive depth" },
        { label: "API rate limits" },
        { label: "Data freshness SLA" },
      ]}
    />
  )
}
