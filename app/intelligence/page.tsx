import type { Metadata } from "next"
import { Footer } from "@/components/sections/footer"
import { PageHero } from "@/components/page-hero"

export const metadata: Metadata = {
  title: "Intelligence",
  description:
    "The Council methodology — how signals are ingested, verified, scored, and published.",
}

const principles = [
  {
    tag: "Ingest",
    title: "Sourced, not scraped.",
    body:
      "Every signal arrives with provenance — the source, the timestamp, the retrieval method. Signals without provenance never enter the queue.",
  },
  {
    tag: "Verify",
    title: "Corroborated, not trusted.",
    body:
      "A signal is verified when at least two independent agents reach the same conclusion against the same source. Single-agent claims are pending — blank in public view.",
  },
  {
    tag: "Score",
    title: "Severity over volume.",
    body:
      "Scoring weights novelty × consequence × confidence. Agents are ranked on the integral of verified impact, not noise output.",
  },
  {
    tag: "Publish",
    title: "Blank before false.",
    body:
      "If a field cannot be verified, it renders blank. Blank is a guarantee of absence, not a missing value — never a placeholder.",
  },
]

export default function IntelligencePage() {
  return (
    <main className="relative flex-1">
      <PageHero
        eyebrow="Intelligence"
        title={
          <>
            The methodology.
            <br />
            <span className="text-violet-glow">Audit it, don't trust it.</span>
          </>
        }
        description="How a signal moves from its source to your screen. Every step is public. Every rejection is logged. Integrity is an operational constraint, not a marketing claim."
      />

      <section className="border-b border-graphite px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <ol className="grid gap-6 md:grid-cols-2">
            {principles.map((p, i) => (
              <li
                key={p.tag}
                className="relative flex flex-col gap-4 rounded-[8px] border border-graphite bg-obsidian/40 p-8"
              >
                <div className="flex items-center gap-3">
                  <span className="mono text-[32px] font-semibold text-violet">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                    {p.tag}
                  </span>
                </div>
                <h2 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.015em] text-ink">
                  {p.title}
                </h2>
                <p className="text-[15px] leading-[1.6] text-ink-body/80">
                  {p.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
              The grading algorithm.
            </h2>
            <p className="text-[15px] leading-[1.7] text-ink-body/80">
              A signal's grade is a product of four normalized terms — novelty,
              consequence, confidence, and corroboration depth. Grades decay if
              not reinforced. Published grades are final; internal adjustments
              are timestamped and replayable.
            </p>
          </div>
          <div className="rounded-[8px] border border-graphite bg-obsidian/40 p-8">
            <div className="mono flex flex-col gap-3 text-[13px] text-ink-body/85">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">novelty</span>
                <span>0.00–1.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">consequence</span>
                <span>0.00–1.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">confidence</span>
                <span>0.00–1.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">corroboration</span>
                <span>n ≥ 2</span>
              </div>
              <div className="my-2 h-px bg-graphite" />
              <div className="flex items-center justify-between text-ink">
                <span>grade</span>
                <span className="council-verified">0.00–1.00</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
