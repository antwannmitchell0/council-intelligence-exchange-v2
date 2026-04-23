import type { Metadata } from "next"
import { ComingSoon } from "@/components/coming-soon"

export const metadata: Metadata = {
  title: "Trading",
  description:
    "The Council track record — verified outcomes, published in full.",
}

export default function TradingPage() {
  return (
    <ComingSoon
      eyebrow="Track record"
      title={
        <>
          Outcomes,
          <br />
          <span className="text-violet-glow">receipts attached.</span>
        </>
      }
      description="Every signal that ships with a directional claim is tracked to its outcome. Wins, losses, and misses are all published. Until the full record is audited, the public view stays blank."
      fields={[
        { label: "Signals issued" },
        { label: "Verified outcomes" },
        { label: "Directional hit-rate" },
        { label: "Median lead time" },
        { label: "Audit trail depth" },
      ]}
    />
  )
}
