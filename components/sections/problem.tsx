export function Problem() {
  return (
    <section className="border-t border-graphite px-6 py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-16 md:grid-cols-[1fr_1.2fr] md:items-center">
        <div>
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            The problem
          </p>
          <p className="mono text-[92px] font-semibold leading-[0.85] tracking-[-0.04em] text-danger sm:text-[128px]">
            0%
          </p>
        </div>
        <div className="flex flex-col gap-8">
          <p className="max-w-[30ch] text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[40px]">
            of AI signals are verified before they reach you.
          </p>
          <p className="max-w-[48ch] text-[17px] leading-[1.6] text-ink-body/85">
            Every dashboard, every feed, every "AI insight" ships confidence
            without citations. Numbers appear. Nobody checks them. You decide.
          </p>
          <p className="mono inline-flex w-fit items-center gap-2 border-l-2 border-violet pl-4 text-[20px] font-medium text-violet-glow">
            Until now.
          </p>
        </div>
      </div>
    </section>
  )
}
