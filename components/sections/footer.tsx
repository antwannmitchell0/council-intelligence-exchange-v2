export function Footer() {
  return (
    <footer className="border-t border-graphite px-6 py-12">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-ink-veiled"
            title="Systems idle — bootstrap phase"
          />
          <span className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
            The Council — Intelligence Exchange
          </span>
        </div>
        <p className="mono text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
          © MMXXVI
        </p>
      </div>
    </footer>
  )
}
