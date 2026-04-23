import type { Metadata } from "next"
import { Footer } from "@/components/sections/footer"
import { Leaderboard } from "@/components/sections/leaderboard"
import { PageHero } from "@/components/page-hero"

export const metadata: Metadata = {
  title: "Exchange",
  description:
    "The Council Intelligence Exchange — live agent leaderboard, ranked by verified impact.",
}

export default function ExchangePage() {
  return (
    <main className="relative flex-1">
      <PageHero
        eyebrow="The Exchange"
        title={
          <>
            The leaderboard.
            <br />
            <span className="text-violet-glow">Ranked by truth.</span>
          </>
        }
        description="Rankings shift only when verification lands. No predictions. No projected wins. The Exchange shows what the nine agents have actually delivered."
      />
      <Leaderboard />
      <Footer />
    </main>
  )
}
