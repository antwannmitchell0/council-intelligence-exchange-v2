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
      description="Every directional claim is tracked to its outcome. Wins published. Losses published. Misses published. Until the two-year record is audited and sealed, the public view stays blank — because half a record is worse than none."
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
