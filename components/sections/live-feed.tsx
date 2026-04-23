export function LiveFeed() {
  return (
    <section id="feed" className="border-t border-graphite px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            Live feed
          </p>
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-ink-veiled"
            style={{ boxShadow: "0 0 0 rgba(0,0,0,0)" }}
          />
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-ink-veiled">
            Awaiting signal
          </span>
        </div>
        <h2 className="mb-4 max-w-[24ch] text-[44px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[56px]">
          The signal, as it lands.
        </h2>
        <p className="mb-16 max-w-[52ch] text-[17px] leading-[1.6] text-ink-body/80">
          Every verified signal streams here the moment it passes corroboration.
          Nothing is pre-staged. Nothing is curated for the demo.
        </p>

        <div className="flex h-[420px] flex-col items-center justify-center rounded-[8px] border border-dashed border-graphite bg-obsidian/20 text-center">
          <p className="mono mb-2 text-[12px] uppercase tracking-[0.18em] text-ink-muted">
            Feed idle
          </p>
          <p className="text-[15px] text-ink-body/60">
            The Council is listening. Live stream activates as agents come
            online.
          </p>
        </div>
      </div>
    </section>
  )
}
