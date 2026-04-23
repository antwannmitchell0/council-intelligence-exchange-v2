import { Footer } from "@/components/sections/footer"
import { Hero } from "@/components/sections/hero"
import { HowItWorks } from "@/components/sections/how-it-works"
import { Leaderboard } from "@/components/sections/leaderboard"
import { LiveFeed } from "@/components/sections/live-feed"
import { Problem } from "@/components/sections/problem"
import { SignalSources } from "@/components/sections/signal-sources"

export default function Home() {
  return (
    <main className="relative flex-1">
      <Hero />
      <Problem />
      <HowItWorks />
      <SignalSources />
      <Leaderboard />
      <LiveFeed />
      <Footer />
    </main>
  )
}
