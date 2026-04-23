import type { Metadata } from "next"
import { PageHero } from "@/components/page-hero"

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How the Council knows what it knows — and how it proves it. The integrity contract: five stages, math-gated promotions, public auto-retirement.",
}

type StageKey =
  | "pending"
  | "backtest-verified"
  | "broker-paper-tracking"
  | "live-verified"
  | "live-trading"

const stages: {
  key: StageKey
  index: string
  label: string
  summary: string
  criteria: string
  publicBadge: string
}[] = [
  {
    key: "pending",
    index: "01",
    label: "pending",
    summary: "In verification. No performance claims.",
    criteria:
      "No broker-attested data yet. Bios may document thesis, source, and academic evidence, but no IC, Sharpe, or return figures render anywhere on the site.",
    publicBadge: "In verification",
  },
  {
    key: "backtest-verified",
    index: "02",
    label: "backtest-verified",
    summary:
      "Passed IC ≥ 0.10 + t-stat > 2 + n ≥ 50 on historical paper-traded data.",
    criteria:
      "Labeled with the exact date range and sample size used. Backtest figures are never aggregated with live numbers — each stage is reported separately.",
    publicBadge: "Backtest-verified",
  },
  {
    key: "broker-paper-tracking",
    index: "03",
    label: "broker-paper-tracking",
    summary: "Signals flowing through Alpaca paper. Day X of 90 clock.",
    criteria:
      "Every signal is stamped with a broker fill receipt. The 90-day clock cannot be compressed, retroactively credited, or manually advanced.",
    publicBadge: "Broker-paper · Day X of 90",
  },
  {
    key: "live-verified",
    index: "04",
    label: "live-verified",
    summary:
      "Passed the same bar on ≥ 90 days of broker-attested data. Attribution from real fills.",
    criteria:
      "IC and t-stat computed only from broker-paper signals. Fills, slippage, and post-cost returns are included. No survivorship adjustment, no post-hoc filtering.",
    publicBadge: "Live-verified",
  },
  {
    key: "live-trading",
    index: "05",
    label: "live-trading",
    summary: "Real customer money. Deferred pending RIA registration.",
    criteria:
      "Not claimed today. Will not be claimed until the Council or an affiliate is registered under the Investment Advisers Act of 1940. Operating today strictly under the publisher's exemption.",
    publicBadge: "Deferred",
  },
]

const mathBar: { term: string; plainEnglish: string; whyItMatters: string }[] =
  [
    {
      term: "IC ≥ 0.10",
      plainEnglish:
        "Information Coefficient — the rank correlation between what the agent predicts and what actually happens.",
      whyItMatters:
        "An IC of 0.10 is a meaningful edge in liquid markets. Most equity-factor research considers anything above 0.05 publishable; 0.10 is the bar we refuse to lower.",
    },
    {
      term: "t-stat > 2",
      plainEnglish:
        "The agent's average signal is more than two standard errors from zero — roughly 95% confidence the edge is real, not luck.",
      whyItMatters:
        "A positive backtest with t-stat below 2 is indistinguishable from noise. We filter it out before anything touches a bio.",
    },
    {
      term: "n ≥ 50",
      plainEnglish: "At least fifty independent signals in the sample.",
      whyItMatters:
        "Below fifty observations, IC and t-stat are unstable. Small samples generate big numbers that collapse under replication.",
    },
  ]

const notNot = [
  "Investment advice",
  "A trading platform",
  "A registered broker-dealer",
  "A recommendation to buy or sell any security",
  "A guarantee of future performance",
]

const references: { label: string; detail: string; href?: string }[] = [
  {
    label: "CFA Institute — on Information Coefficient",
    detail:
      "Reference source for IC as a measure of forecast skill in quantitative investing.",
    href: "https://www.cfainstitute.org/",
  },
  {
    label:
      "Marcos López de Prado — Advances in Financial Machine Learning (Wiley, 2018)",
    detail:
      "Canonical reference for meta-labeling, purged k-fold cross-validation, and deflated Sharpe — the defenses against overfitting we inherit.",
  },
  {
    label: "SEC — Investment Advisers Act of 1940",
    detail:
      "The statute that defines the line between journalism/research and regulated investment advice. Our publisher's-exemption posture is grounded here.",
    href: "https://www.sec.gov/about/laws/iaa40.pdf",
  },
]

export default function IntelligencePage() {
  return (
    <main className="relative flex-1">
      <PageHero
        eyebrow="Methodology"
        title={
          <>
            Methodology.
            <br />
            <span className="text-violet-glow">
              How we know what we know.
            </span>
          </>
        }
        description="How we know what we know — and how we prove it. Every performance claim on this site belongs to exactly one stage. The math gates everything. There are no manual overrides."
      />

      {/* The Five Stages */}
      <section
        id="stages"
        className="border-b border-graphite px-6 py-24"
      >
        <div className="mx-auto max-w-6xl">
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            The integrity contract
          </p>
          <h2 className="mb-4 max-w-[22ch] text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[48px]">
            Five stages. No mixing.
          </h2>
          <p className="mb-14 max-w-[60ch] text-[15px] leading-[1.6] text-ink-body/75">
            Every agent on the Council lives in exactly one stage at a time.
            Numbers from one stage are never aggregated into another. If an
            agent cannot prove its stage, it renders blank.
          </p>

          <ol className="grid gap-4 md:grid-cols-2">
            {stages.map((stage) => (
              <li
                key={stage.key}
                className="relative flex flex-col gap-4 rounded-[8px] border border-graphite bg-obsidian/40 p-8"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="mono text-[28px] font-semibold text-violet">
                      {stage.index}
                    </span>
                    <code className="mono rounded-full border border-graphite bg-void/60 px-2.5 py-1 text-[11px] tracking-[0.04em] text-ink-body/85">
                      {stage.label}
                    </code>
                  </div>
                  <span className="mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                    {stage.publicBadge}
                  </span>
                </div>
                <p className="text-[16px] leading-[1.45] font-medium text-ink">
                  {stage.summary}
                </p>
                <p className="text-[14px] leading-[1.6] text-ink-body/75">
                  {stage.criteria}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The Math Bar */}
      <section id="math-bar" className="border-b border-graphite px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            The math bar
          </p>
          <h2 className="mb-4 max-w-[22ch] text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[48px]">
            Three numbers. Every promotion.
          </h2>
          <p className="mb-14 max-w-[60ch] text-[15px] leading-[1.6] text-ink-body/75">
            An agent does not advance a stage by vibes, narrative, or author
            preference. It passes three numeric gates, or it stays where it is.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {mathBar.map((m) => (
              <div
                key={m.term}
                className="flex flex-col gap-4 rounded-[8px] border border-graphite bg-obsidian/40 p-8"
              >
                <span className="mono text-[20px] font-semibold text-violet-glow">
                  {m.term}
                </span>
                <p className="text-[14px] leading-[1.6] text-ink-body/85">
                  {m.plainEnglish}
                </p>
                <div className="my-1 h-px bg-graphite" />
                <p className="text-[13px] leading-[1.6] text-ink-body/65">
                  <span className="mono mr-2 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                    Why
                  </span>
                  {m.whyItMatters}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Auto-promotion */}
      <section className="border-b border-graphite px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
                Auto-promotion
              </p>
              <h2 className="mb-6 max-w-[18ch] text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[44px]">
                The math gates everything.
              </h2>
              <p className="text-[15px] leading-[1.7] text-ink-body/80">
                A nightly cron recomputes every agent&apos;s rolling-window IC,
                t-stat, and sample size. If an agent crosses the bar for the
                next stage, it is promoted the next morning. There are no
                manual overrides, no author discretion, no marketing team with
                a finger on the scale. The cron runs. The numbers decide.
              </p>
            </div>

            <div className="rounded-[8px] border border-graphite bg-obsidian/40 p-8">
              <div className="mono flex flex-col gap-3 text-[13px] text-ink-body/85">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">cadence</span>
                  <span>nightly</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">rolling window</span>
                  <span>90 days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">ic threshold</span>
                  <span>≥ 0.10</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">t-stat threshold</span>
                  <span>&gt; 2</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">min sample</span>
                  <span>n ≥ 50</span>
                </div>
                <div className="my-2 h-px bg-graphite" />
                <div className="flex items-center justify-between text-ink">
                  <span>manual overrides</span>
                  <span className="text-danger">none</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Auto-retirement */}
      <section className="border-b border-graphite px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="rounded-[8px] border border-graphite bg-obsidian/40 p-8">
              <div className="mono flex flex-col gap-3 text-[13px] text-ink-body/85">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">ic decays below</span>
                  <span>0.05</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">t-stat drops below</span>
                  <span>2</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">consecutive failures</span>
                  <span>3 → degraded</span>
                </div>
                <div className="my-2 h-px bg-graphite" />
                <div className="flex items-center justify-between text-ink">
                  <span>public action</span>
                  <span className="text-council-amber">retire + log</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">logged to</span>
                  <span>v2_integrity_events</span>
                </div>
              </div>
            </div>

            <div>
              <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
                Auto-retirement
              </p>
              <h2 className="mb-6 max-w-[18ch] text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[44px]">
                Decay is a feature.
              </h2>
              <p className="text-[15px] leading-[1.7] text-ink-body/80">
                If an agent&apos;s IC decays below the threshold, it retires
                publicly. No quiet removal, no archive on a hidden page — the
                status change is logged to the integrity events table and
                rendered on the agent&apos;s detail page. Retirement is not a
                failure mode of the system; it is the system working. A
                roster that never retires anyone isn&apos;t a roster — it&apos;s
                a sales sheet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What this is NOT */}
      <section className="border-b border-graphite px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            What this is not
          </p>
          <h2 className="mb-4 max-w-[22ch] text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[48px]">
            Say what it isn&apos;t, out loud.
          </h2>
          <p className="mb-14 max-w-[64ch] text-[15px] leading-[1.6] text-ink-body/75">
            The Council is a signal-verification system operated in a
            journalism and research capacity under the Publisher&apos;s
            Exemption of the Investment Advisers Act of 1940. Nothing on this
            site is tailored to your circumstances. Specifically, the Council
            is NOT:
          </p>

          <ul className="grid gap-3 sm:grid-cols-2">
            {notNot.map((item) => (
              <li
                key={item}
                className="flex items-start gap-4 rounded-[8px] border border-graphite bg-obsidian/40 px-6 py-5"
              >
                <span
                  aria-hidden
                  className="mono mt-[3px] text-[14px] text-danger"
                >
                  ✕
                </span>
                <span className="text-[15px] leading-[1.5] text-ink-body/90">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* References */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="mono mb-6 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
            References
          </p>
          <h2 className="mb-4 max-w-[22ch] text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[48px]">
            Where the bar comes from.
          </h2>
          <p className="mb-14 max-w-[60ch] text-[15px] leading-[1.6] text-ink-body/75">
            The thresholds above aren&apos;t invented. They&apos;re the
            working floor of serious quantitative research and the statutory
            line drawn by federal law.
          </p>

          <ul className="flex flex-col gap-4">
            {references.map((ref) => (
              <li
                key={ref.label}
                className="flex flex-col gap-2 rounded-[8px] border border-graphite bg-obsidian/40 p-6 transition-colors duration-[240ms] [transition-timing-function:var(--ease-council)] hover:border-violet/40"
              >
                {ref.href ? (
                  <a
                    href={ref.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[16px] font-medium leading-[1.3] text-ink hover:text-violet-glow"
                  >
                    {ref.label}
                    <span className="mono ml-2 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                      ↗
                    </span>
                  </a>
                ) : (
                  <span className="text-[16px] font-medium leading-[1.3] text-ink">
                    {ref.label}
                  </span>
                )}
                <p className="text-[14px] leading-[1.6] text-ink-body/70">
                  {ref.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
