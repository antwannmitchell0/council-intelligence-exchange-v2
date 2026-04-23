const steps = [
  {
    n: "01",
    title: "Ingest",
    body:
      "Nine autonomous agents pull from verified signal sources on a continuous cadence. Each signal arrives tagged with provenance.",
  },
  {
    n: "02",
    title: "Verify",
    body:
      "Every signal is scored against independent corroboration. Anything unverified is dropped — not softened, not flagged. Dropped.",
  },
  {
    n: "03",
    title: "Publish",
    body:
      "What you see is what survived verification. The rest is a blank. A blank is not a gap — it is a guarantee.",
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-t border-graphite px-6 py-32"
    >
      <div className="mx-auto max-w-6xl">
        <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          How it works
        </p>
        <h2 className="mb-20 max-w-[22ch] text-[44px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[56px]">
          Three steps. No shortcuts.
        </h2>

        <ol className="grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.n}
              className="group relative flex flex-col gap-6 rounded-[8px] border border-graphite bg-obsidian/40 p-8 backdrop-blur transition-colors duration-[240ms] [transition-timing-function:var(--ease-council)] hover:border-violet/40"
            >
              <div className="flex items-baseline justify-between">
                <span className="mono text-[44px] font-semibold text-violet">
                  {step.n}
                </span>
                <span className="h-px w-12 bg-graphite transition-colors duration-[240ms] group-hover:bg-violet/50" />
              </div>
              <h3 className="text-[26px] font-semibold tracking-[-0.015em] text-ink">
                {step.title}
              </h3>
              <p className="text-[15px] leading-[1.6] text-ink-body/80">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
