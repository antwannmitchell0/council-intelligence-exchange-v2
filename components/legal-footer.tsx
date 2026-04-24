import Link from "next/link"

const YEAR = 2026

const quickLinks: { href: string; label: string; external?: boolean }[] = [
  { href: "/intelligence", label: "Methodology" },
  { href: "/agents", label: "Agents" },
  { href: "/marketplace", label: "Marketplace" },
  {
    href: "https://github.com/antwannmitchell0/council-intelligence-exchange-v2",
    label: "GitHub",
    external: true,
  },
]

const legalLinks: { href: string; label: string }[] = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/security", label: "Security" },
]

export function LegalFooter() {
  return (
    <footer
      aria-label="Legal"
      className="border-t border-graphite bg-void/80 px-6 pt-16 pb-10"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Column 1 — Brand */}
          <div className="flex flex-col gap-3">
            <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink">
              The Council Intelligence Exchange
            </p>
            <p className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
              © {YEAR} — All rights reserved
            </p>
            <p className="mt-2 max-w-[34ch] text-[13px] leading-[1.6] text-ink-body/70">
              Verified intelligence. Math-gated promotions. Public retirements.
            </p>
          </div>

          {/* Column 2 — Quick links */}
          <div className="flex flex-col gap-4">
            <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
              Quick links
            </p>
            <ul className="flex flex-col gap-3">
              {quickLinks.map((item) =>
                item.external ? (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[14px] text-ink-body/80 transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:text-ink"
                    >
                      {item.label}
                      <span
                        aria-hidden
                        className="mono ml-1.5 text-[11px] text-ink-veiled"
                      >
                        ↗
                      </span>
                    </a>
                  </li>
                ) : (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-[14px] text-ink-body/80 transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Column 3 — Legal */}
          <div className="flex flex-col gap-4">
            <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
              Legal
            </p>
            <p className="max-w-[44ch] text-[13px] leading-[1.6] text-ink-body/70">
              Not investment advice. Educational research platform. All signals
              are subject to the{" "}
              <Link
                href="/intelligence"
                className="text-ink-body/90 underline decoration-ink-veiled underline-offset-[3px] transition-colors hover:text-ink hover:decoration-ink-muted"
              >
                Methodology
              </Link>{" "}
              integrity contract. Auto-retirement is active. Past performance
              is not indicative of future results.
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
              {legalLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="mono text-[11px] uppercase tracking-[0.18em] text-ink-muted transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Very bottom — fine-print row */}
        <div className="mt-14 border-t border-graphite pt-6">
          <p className="mono text-[10px] leading-[1.7] tracking-[0.08em] text-ink-veiled sm:text-[11px]">
            © {YEAR} The Council Intelligence Exchange. All rights reserved. ·
            The Council is not a registered investment adviser. Nothing on this
            site is a recommendation to buy or sell any security. See{" "}
            <Link
              href="/intelligence"
              className="text-ink-muted underline decoration-ink-veiled underline-offset-[3px] transition-colors hover:text-ink-body"
            >
              Methodology
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  )
}
