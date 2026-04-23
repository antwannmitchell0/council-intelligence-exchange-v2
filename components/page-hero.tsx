import { cn } from "@/lib/utils"

type PageHeroProps = {
  eyebrow: string
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}

export function PageHero({
  eyebrow,
  title,
  description,
  className,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative border-b border-graphite px-6 pt-32 pb-20 sm:pt-40 sm:pb-24",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-[320px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.12),transparent_70%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          {eyebrow}
        </p>
        <h1 className="max-w-[22ch] text-[48px] font-semibold leading-[1.02] tracking-[-0.03em] text-ink sm:text-[72px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-8 max-w-[56ch] text-[18px] leading-[1.55] text-ink-body/85">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  )
}
