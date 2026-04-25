import Link from "next/link"
import { NexusGlyph } from "@/components/nexus-glyph"
import { primaryNav } from "@/lib/nav"

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-graphite/60 bg-void/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-3"
          aria-label="The Council — home"
        >
          <span className="transition-transform duration-[240ms] [transition-timing-function:var(--ease-council)] group-hover:rotate-[30deg]">
            <NexusGlyph size={26} ariaLabel="Council mark" />
          </span>
          <span className="mono text-[11px] uppercase tracking-[0.24em] text-ink">
            The Council
          </span>
        </Link>

        <nav className="hidden md:flex" aria-label="Primary">
          <ul className="flex items-center gap-1">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="mono rounded-[6px] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-ink-muted transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-obsidian hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-[8px] bg-violet px-4 py-2 text-[13px] font-medium text-ink transition-colors duration-[120ms] [transition-timing-function:var(--ease-council)] hover:bg-violet-glow"
        >
          Get Early Access
        </Link>
      </div>

      <nav className="md:hidden" aria-label="Primary mobile">
        <ul className="flex gap-1 overflow-x-auto border-t border-graphite/60 px-4 py-3">
          {primaryNav.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className="mono block rounded-[6px] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
