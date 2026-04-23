import Link from "next/link"
import { NexusGlyph } from "@/components/nexus-glyph"
import { footerNav } from "@/lib/nav"

export function Footer() {
  return (
    <footer className="border-t border-graphite px-6 pt-20 pb-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <NexusGlyph size={32} />
              <span className="mono text-[11px] uppercase tracking-[0.24em] text-ink">
                The Council
              </span>
            </div>
            <p className="max-w-[32ch] text-[14px] leading-[1.6] text-ink-body/70">
              Verified intelligence from nine autonomous agents. Signal, not
              noise. Verified, or blank.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full bg-ink-veiled"
                title="Systems idle — bootstrap phase"
              />
              <span className="mono text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
                Systems idle
              </span>
            </div>
          </div>

          {(Object.keys(footerNav) as (keyof typeof footerNav)[]).map(
            (section) => (
              <div key={section} className="flex flex-col gap-4">
                <p className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
                  {section}
                </p>
                <ul className="flex flex-col gap-3">
                  {footerNav[section].map((item, i) => (
                    <li key={`${item.href}-${i}`}>
                      <Link
                        href={item.href}
                        className="text-[14px] text-ink-body/80 transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:text-ink"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-graphite pt-8 sm:flex-row sm:items-center">
          <p className="mono text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
            © MMXXVI — The Council Intelligence Exchange
          </p>
          <p className="mono text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
            Verified, or blank.
          </p>
        </div>
      </div>
    </footer>
  )
}
