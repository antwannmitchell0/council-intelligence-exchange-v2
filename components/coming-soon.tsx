import { Footer } from "@/components/sections/footer"
import { PageHero } from "@/components/page-hero"
import { BLANK } from "@/lib/render-if-verified"

type ComingSoonProps = {
  eyebrow: string
  title: React.ReactNode
  description: React.ReactNode
  fields: { label: string; hint?: string }[]
}

export function ComingSoon({
  eyebrow,
  title,
  description,
  fields,
}: ComingSoonProps) {
  return (
    <main className="relative flex-1">
      <PageHero eyebrow={eyebrow} title={title} description={description} />

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[8px] border border-dashed border-graphite bg-obsidian/20 p-10">
            <div className="mb-10 flex items-center gap-3">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full bg-ink-veiled"
              />
              <span className="mono text-[11px] uppercase tracking-[0.24em] text-ink-muted">
                Awaiting launch
              </span>
            </div>
            <ul className="grid gap-1">
              {fields.map((f) => (
                <li
                  key={f.label}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-graphite/40 py-5 last:border-b-0"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[15px] font-medium text-ink">
                      {f.label}
                    </span>
                    {f.hint ? (
                      <span className="text-[13px] text-ink-body/60">
                        {f.hint}
                      </span>
                    ) : null}
                  </div>
                  <span className="mono text-[13px] text-ink-veiled">
                    {BLANK}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-10 text-[13px] leading-[1.6] text-ink-body/60">
              Rather than filling this surface with marketing, the Council
              leaves it blank. When the feature ships, the blanks fill with
              verified data — and only then.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  )
}
